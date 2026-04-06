// src/components/doctor-card.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AvailabilityModal } from "@/components/availability-modal";
import { CheckCircle2, GraduationCap, ExternalLink } from "lucide-react";
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
export function cleanEducation(raw?: string | null) {
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

      <div className="p-5 flex flex-col gap-4 flex-1">

        {/* Top: photo + name + fee */}
        <div className="flex items-start gap-3">
          <div className="relative flex-shrink-0">
            <img
              src={doctor.image ?? "https://picsum.photos/seed/doctor/200/200"}
              alt={doctor.fullName}
              className="h-16 w-16 rounded-xl object-cover border-2 border-navy/10 group-hover:border-gold transition-colors"
            />
            {doctor.verified && (
              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center border-2 border-white">
                <CheckCircle2 className="h-2.5 w-2.5 text-white" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-navy text-sm leading-tight truncate group-hover:text-gold-dim transition-colors">
              {withDrPrefix(doctor.fullName)}
            </h3>
            <p className="text-xs text-navy/60 mt-0.5">{primarySpecialty}</p>
            {hasExperience && (
              <p className="text-xs text-slate-400 mt-1">{doctor.experienceYears} yrs experience</p>
            )}
          </div>

          <div className="text-right flex-shrink-0">
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Fee</p>
            <p className="text-base font-black text-gold-dim">{feeText}</p>
          </div>
        </div>

        {/* Education */}
        {educationText && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl" style={{ background: "#f8f5ef" }}>
            <GraduationCap className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-400" />
            <p className="text-xs text-slate-500 line-clamp-2">{educationText}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-auto">
          <Link href={`/doctor/${doctor.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors"
            style={{ color: "#a88b50", background: "rgba(200,169,110,.08)", border: "1px solid rgba(200,169,110,.2)" }}>
            <ExternalLink size={11} /> Profile
          </Link>
          <Button
            onClick={() => setShowAvailability(true)}
            size="sm"
            className="flex-1 rounded-xl bg-navy hover:bg-navy-mid text-gold shadow-sm hover:shadow-md"
            disabled={doctorSlots.length === 0}
            title={doctorSlots.length === 0 ? "No availability" : "Book"}
          >
            <lucideReact.Calendar className="h-3.5 w-3.5 mr-1.5" />
            Book
          </Button>
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