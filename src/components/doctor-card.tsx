// src/components/doctor-card.tsx
"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { AvailabilityModal } from "@/components/availability-modal";
import { CheckCircle2, ChevronDown, ChevronUp, GraduationCap } from "lucide-react";
import * as lucideReact from "lucide-react";
import type { ApiDoctor, ApiAvailabilitySlot } from "@/types/hospital";
import type { Occurrence } from "@/lib/availability";

type Props = {
  doctor: ApiDoctor;
  slots?: ApiAvailabilitySlot[];
  departmentName?: string;
  onSelectSlotAction?: (occ: Occurrence) => void;
};

/**
 * Remove council / registration noise.
 * Works for:
 * - Council Number: 10978
 * - Council No 390
 * - Nepal Medical Council: 1528
 * - NMC 12345
 * - Registration No: 12345
 */
function cleanEducation(raw?: string | null) {
  if (!raw) return null;

  let s = raw.replace(/\s+/g, " ").trim();
  if (!s) return null;

  // Truncate at scraper-injected biography / section-header markers
  const breakIdx = s.search(
    /\b(Professional Summary|Academic Background|Areas of Expertise|Profile\s*:|At Grande|Consultant\s*[–\-]|Memberships?(\s*&|\s*:)|\bTrainings?\s*(&|and)\s*Certifications?|Languages\s*Spoken|\b(He|She)\s+(is|was|has|completed|serves)\b)/i
  );
  if (breakIdx > 0) {
    s = s.slice(0, breakIdx).trim();
  }

  // Strip trailing name patterns e.g. "Assoc. Prof. Dr. Firstname Lastname"
  s = s
    .replace(/\s+(Assoc\.?\s*Prof\.?|Prof\.?|Dr\.?)\s+[A-Z][a-z]+(\s+[A-Z][a-z]+){1,4}\s*$/g, "")
    .trim();

  // Remove council / registration noise
  s = s
    .replace(
      /\b(nepal\s*medical\s*council|medical\s*council|council|nmc|registration)\b\s*(number|no\.?)?\s*[:\-]?\s*\d+\b/gi,
      ""
    )
    .replace(/\b(nepal\s*medical\s*council|medical\s*council|council|nmc|registration)\b\s*(number|no\.?)?\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,\s+/g, ", ")
    .replace(/[,\-|:]\s*(?=,|$)/g, "")
    .trim();

  if (!s || s.length < 2) return null;
  return s;
}

function withDrPrefix(name: string) {
  const n = (name ?? "").trim();
  if (!n) return "Dr.";
  if (/^(dr\.?|prof\.?|asst\.?|assoc\.?)\s/i.test(n)) return n;
  return `Dr. ${n}`;
}

/**
 * We store cents (Stripe-friendly) but we display whole euros only.
 * Since seed uses 500/600/.../1000, this becomes €5..€10.
 */
function formatFeeWholeEUR(amountCents?: number | null, currency?: string | null) {
  if (amountCents == null) return "—";

  const cur = (currency ?? "eur").toLowerCase();
  const symbol = cur === "eur" ? "€" : cur === "usd" ? "$" : `${cur.toUpperCase()} `;

  const whole = Math.round(amountCents / 100); // safe for 500..1000
  return `${symbol}${whole}`;
}

export function DoctorCard({ doctor, slots = [], departmentName, onSelectSlotAction }: Props) {
  const [showAvailability, setShowAvailability] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const doctorSlots = useMemo(() => {
    return slots.filter((s) => s.isActive && s.doctorId === doctor.id);
  }, [slots, doctor.id]);

  const primarySpecialty =
    departmentName ??
    doctor.specialties.find((s) => s.isPrimary)?.name ??
    doctor.specialties[0]?.name ??
    "Doctor";

  const hasExperience = doctor.experienceYears != null;

  const educationText = useMemo(() => {
    // Your API already uses `doctor.education` based on your schema.
    return cleanEducation((doctor as any).education ?? null);
  }, [doctor]);

  const feeText = formatFeeWholeEUR(doctor.feeMin ?? null, doctor.currency ?? "eur");

  return (
    <div className="group bg-white rounded-2xl border border-navy/10 shadow-sm hover:shadow-xl hover:border-gold transition-all duration-300 hover:-translate-y-1 overflow-hidden flex flex-col">
      {/* Subtle gradient decoration */}
      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-br from-gold/10 via-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
      
      <div className="relative p-5 flex gap-4 flex-1 items-stretch min-h-[220px]">
        {/* Photo */}
        <div className="relative">
          <img
            src={doctor.image ?? "https://picsum.photos/seed/doctor/200/200"}
            alt={doctor.fullName}
            className="h-20 w-20 rounded-xl object-cover border-2 border-navy/10 group-hover:border-gold transition-colors"
          />
          {doctor.verified && (
            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center border-2 border-white shadow-lg">
              <CheckCircle2 className="h-3 w-3 text-white" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {/* Name */}
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-navy truncate group-hover:text-gold-dim transition-colors">
                  {withDrPrefix(doctor.fullName)}
                </h3>
              </div>

              {/* Specialty */}
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-navy/70">{primarySpecialty}</p>
              </div>
            </div>

            {/* Fee */}
            <div className="text-right shrink-0">
              <p className="text-xs text-slate-500 font-medium">Fee</p>
              <p className="text-lg font-bold text-gold-dim">{feeText}</p>
            </div>
          </div>

          {/* Details + Action */}
          <div className="mt-auto pt-4 flex flex-col gap-3">
            {(hasExperience || educationText) && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowDetails((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-dim hover:text-navy transition-colors"
                  aria-expanded={showDetails}
                >
                  {showDetails ? "View less" : "View more"}
                  {showDetails ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>

                {showDetails && (
                  <div className="mt-2 space-y-2">
                    {hasExperience && (
                      <div className="text-sm text-slate-600">
                        <span className="font-semibold text-slate-600">Experience: </span>
                        <span className="text-slate-500">{doctor.experienceYears} yrs</span>
                      </div>
                    )}
                    {educationText && (
                      <div className="flex items-start gap-2 text-sm text-slate-500">
                        <GraduationCap className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-600">Education: </span>
                          <span className="text-slate-500">{educationText}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end">
            <Button
              onClick={() => setShowAvailability(true)}
              size="sm"
              className="rounded-full bg-navy hover:bg-navy-mid text-gold shadow-md hover:shadow-lg"
              disabled={doctorSlots.length === 0}
              title={doctorSlots.length === 0 ? "No availability available" : "Check Availability"}
            >
              <lucideReact.Calendar className="h-4 w-4 mr-1.5" />
              Check Availability
            </Button>
            </div>
          </div>
        </div>
      </div>

      <AvailabilityModal
        doctor={doctor}
        slots={doctorSlots}
        isOpen={showAvailability}
        onCloseAction={() => setShowAvailability(false)}
        daysToShow={7}
        onBookAction={(occ) => {
          onSelectSlotAction?.(occ);
          setShowAvailability(false);
        }}
      />
    </div>
  );
}