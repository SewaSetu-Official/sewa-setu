"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  X, CheckCircle2, MapPin, Calendar,
  Loader2, AlertCircle, Building2, Monitor, User, ArrowLeft, GraduationCap, Languages,
} from "lucide-react";
import { AvailabilityModal } from "@/components/availability-modal";
import { cleanEducation } from "@/components/doctor-card";
import type { ApiAvailabilitySlot } from "@/types/hospital";
import { formatMoneyCents } from "@/lib/money";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function bookingSlotLabels(slot: ApiAvailabilitySlot) {
  const start = timeToMinutes(slot.startTime);
  const end = timeToMinutes(slot.endTime);
  const duration = Math.max(Number(slot.slotDurationMinutes) || 0, 5);
  if (start === null || end === null || end <= start) return [];

  const labels: string[] = [];
  for (let cursor = start; cursor + duration <= end; cursor += duration) {
    labels.push(`${minutesToTime(cursor)}-${minutesToTime(cursor + duration)}`);
  }
  return labels;
}


type DoctorData = {
  id: string;
  fullName: string;
  gender: string | null;
  experienceYears: number | null;
  education: string | null;
  bio: string | null;
  languages: string[];
  consultationModes: ("ONLINE" | "PHYSICAL")[];
  licenseNumber: string | null;
  feeMin: number | null;
  feeMax: number | null;
  currency: string;
  verified: boolean;
  image: string | null;
  specialties: { id: string; name: string; slug: string; isPrimary: boolean }[];
  hospitals: {
    id: string; slug: string; name: string;
    positionTitle: string | null; isPrimary: boolean;
    city: string; district: string; image: string | null;
  }[];
  availability: ApiAvailabilitySlot[];
};

function formatFee(min?: number | null, max?: number | null, currency?: string) {
  if (min == null) return null;
  return max != null && max !== min
    ? `${formatMoneyCents(min, currency)} - ${formatMoneyCents(max, currency)}`
    : formatMoneyCents(min, currency);
}

function withDr(name: string) {
  if (/^(dr\.?|prof\.?)/i.test(name.trim())) return name;
  return `Dr. ${name}`;
}

export default function DoctorProfilePage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [doctor, setDoctor] = useState<DoctorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAvailability, setShowAvailability] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/doctor/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Doctor not found");
        setDoctor(await res.json());
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f0ece4" }}>
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#c8a96e" }} />
    </div>
  );

  if (error || !doctor) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "#f0ece4" }}>
      <AlertCircle className="h-10 w-10 text-red-400" />
      <p className="font-semibold text-[#0f1e38]">{error || "Doctor not found"}</p>
      <Link href="/search" className="text-sm font-bold px-5 py-2.5 rounded-xl"
        style={{ background: "#0f1e38", color: "#c8a96e" }}>Back to Search</Link>
    </div>
  );

  const primarySpecialty = doctor.specialties.find((s) => s.isPrimary)?.name ?? doctor.specialties[0]?.name ?? "";
  const primaryHospital = doctor.hospitals.find((h) => h.isPrimary) ?? doctor.hospitals[0];
  const fee = formatFee(doctor.feeMin, doctor.feeMax, doctor.currency);
  const education = cleanEducation(doctor.education);

  const byDay = doctor.availability.reduce<Record<number, typeof doctor.availability>>((acc, s) => {
    (acc[s.dayOfWeek] ??= []).push(s);
    return acc;
  }, {});

  // Only show days that have at least one slot
  const activeDays = [0,1,2,3,4,5,6].filter((d) => byDay[d]?.length);
  const hasSchedule = activeDays.length > 0;
  const canBook = doctor.availability.length > 0;

  return (
    <div className="min-h-screen" style={{ background: "#f0ece4" }}>

      {/* HERO */}
      <div style={{ background: "linear-gradient(160deg,#0a1628 0%,#0f1e38 65%,#162540 100%)" }} className="relative overflow-hidden">
        {/* subtle texture */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
          backgroundSize: "60px 60px"
        }} />

        <div className="max-w-5xl mx-auto px-6 pt-14 pb-28">
          <div className="flex flex-col sm:flex-row items-start gap-7">

            {/* Avatar */}

            <div className="relative flex-shrink-0">
              <Image
                loader={({ src }) => src}
                unoptimized
                src={doctor.image ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(doctor.fullName)}&background=1a3059&color=c8a96e&size=160&bold=true`}
                alt={doctor.fullName}
                width={144}
                height={144}
                className="w-36 h-36 rounded-3xl object-cover"
                style={{ boxShadow: "0 0 0 3px rgba(200,169,110,.35), 0 24px 48px rgba(0,0,0,.35)" }}
              />
              {doctor.verified && (
                <div className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", boxShadow: "0 0 0 2.5px #0f1e38" }}>
                  <CheckCircle2 size={15} className="text-white" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pt-1">
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {doctor.verified && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(34,197,94,.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,.18)" }}>
                    Verified
                  </span>
                )}
                {doctor.consultationModes.includes("ONLINE") && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
                    style={{ background: "rgba(59,130,246,.1)", color: "#93c5fd", border: "1px solid rgba(59,130,246,.18)" }}>
                    <Monitor size={9} /> Online
                  </span>
                )}
                {doctor.consultationModes.includes("PHYSICAL") && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
                    style={{ background: "rgba(200,169,110,.1)", color: "#c8a96e", border: "1px solid rgba(200,169,110,.2)" }}>
                    <User size={9} /> In-Person
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-[2.5rem] font-extrabold text-white leading-tight tracking-tight">
                {withDr(doctor.fullName)}
              </h1>

              {primarySpecialty && (
                <p className="text-base font-semibold mt-1.5" style={{ color: "#c8a96e" }}>{primarySpecialty}</p>
              )}

              {/* Extra specialties */}
              {doctor.specialties.length > 1 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {doctor.specialties.filter((s) => !s.isPrimary).map((s) => (
                    <span key={s.id} className="text-[11px] px-2 py-0.5 rounded-md font-medium"
                      style={{ background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.45)" }}>
                      {s.name}
                    </span>
                  ))}
                </div>
              )}

              {primaryHospital && (
                <p className="flex items-center gap-1.5 text-sm mt-3" style={{ color: "rgba(255,255,255,.35)" }}>
                  <MapPin size={11} />
                  {primaryHospital.positionTitle ? `${primaryHospital.positionTitle} · ` : ""}
                  {primaryHospital.name}, {primaryHospital.city}
                </p>
              )}
            </div>

            {/* Close inline at the right end of the hero row */}
            <button
              onClick={() => router.back()}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(200,169,110,.18)"; e.currentTarget.style.borderColor = "rgba(200,169,110,.5)"; e.currentTarget.style.color = "#c8a96e"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.08)"; e.currentTarget.style.borderColor = "rgba(255,255,255,.12)"; e.currentTarget.style.color = "rgba(255,255,255,.55)"; }}
              className="ml-auto self-start flex-shrink-0 flex items-center gap-1.5 px-3 h-9 rounded-full transition-all duration-200"
              style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", color: "rgba(255,255,255,.55)" }}
            >
              <X size={13} />
              <span className="text-xs font-semibold">Close</span>
            </button>
          </div>
        </div>
      </div>

      {/* STAT CARDS (overlapping hero) */}
      <div className="max-w-5xl mx-auto px-6 -mt-14 relative z-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Experience", value: doctor.experienceYears != null ? `${doctor.experienceYears}+` : "-", sub: "Years" },
            { label: "Hospitals", value: doctor.hospitals.length, sub: "Affiliated" },
            { label: "Consultation", value: fee ?? "-", sub: "Fee", gold: true },
            { label: "Availability", value: hasSchedule ? `${activeDays.length}` : "-", sub: "Days/Week" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl px-4 py-4 shadow-lg text-center"
              style={{ border: "1px solid rgba(200,169,110,.12)" }}>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">{s.label}</p>
              <p className="text-2xl font-black leading-none" style={{ color: s.gold ? "#c8a96e" : "#0f1e38" }}>{s.value}</p>
              <p className="text-[10px] text-gray-400 mt-1">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div className="max-w-5xl mx-auto px-6 pt-5 pb-20">
        {/* TOP ROW: Education+Works At | Book */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

          {/* Left: Bio + Education + Works At */}
          <div className="lg:col-span-2 space-y-5">
            {doctor.bio && (
              <div className="bg-white rounded-3xl p-6 shadow-sm" style={{ border: "1px solid rgba(200,169,110,.1)" }}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: "#c8a96e" }}>About</p>
                <p className="text-sm text-gray-600 leading-relaxed">{doctor.bio}</p>
              </div>
            )}

            <div className="bg-white rounded-3xl p-6 shadow-sm" style={{ border: "1px solid rgba(200,169,110,.1)" }}>
              {/* Education */}
              {education && (
                <div className={doctor.hospitals.length > 0 ? "mb-5" : ""}>
                  <div className="flex items-center gap-2 mb-2">
                    <GraduationCap size={13} style={{ color: "#c8a96e" }} />
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#c8a96e" }}>Education</p>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{education}</p>
                </div>
              )}

              {/* Works At */}
              {doctor.hospitals.length > 0 && (
                <>
                  {education && <div style={{ borderTop: "1px solid #f0ece4", marginBottom: 16 }} />}
                  <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: "#c8a96e" }}>Works At</p>
                  <div className="space-y-2">
                    {doctor.hospitals.map((h) => (
                      <Link key={h.id} href={`/hospital/${h.slug}`}
                        className="flex items-center gap-3 p-3 rounded-2xl group transition-all hover:shadow-sm"
                        style={{ border: "1px solid rgba(200,169,110,.12)", background: "#fdf9f5" }}>
                        <div className="h-9 w-9 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center">
                          {h.image
                            ? <Image loader={({ src }) => src} unoptimized src={h.image} alt={h.name} width={36} height={36} className="h-full w-full object-cover" />
                            : <Building2 size={14} className="text-gray-300" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold group-hover:text-[#c8a96e] transition-colors truncate" style={{ color: "#0f1e38" }}>{h.name}</p>
                          <p className="text-xs text-gray-400 truncate">{h.city}{h.positionTitle ? ` · ${h.positionTitle}` : ""}</p>
                        </div>
                        <ArrowLeft size={12} className="rotate-180 text-gray-300 group-hover:text-[#c8a96e] transition-all flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right: Book CTA */}
          <div className="space-y-4">
            <div className="rounded-3xl p-5"
              style={{ background: "linear-gradient(145deg,#0f1e38,#1a3059)", border: "1px solid rgba(200,169,110,.18)" }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-white font-bold text-sm">Book Appointment</p>
                <div className="h-8 w-8 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(200,169,110,.12)" }}>
                  <Calendar size={14} style={{ color: "#c8a96e" }} />
                </div>
              </div>
              {fee && (
                <div className="mb-4">
                  <p className="text-3xl font-black" style={{ color: "#c8a96e" }}>{fee}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,.3)" }}>Consultation fee</p>
                </div>
              )}
              <button
                onClick={() => canBook && setShowAvailability(true)}
                disabled={!canBook}
                className="w-full py-3 rounded-2xl text-sm font-black transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: canBook ? "linear-gradient(135deg,#e8d5b0,#c8a96e,#a88b50)" : "#374151", color: canBook ? "#0f1e38" : "#6b7280" }}>
                {canBook ? "Check Availability" : "Not Available"}
              </button>
            </div>

            {/* Quick info */}
            {(doctor.gender || doctor.languages.length > 0 || doctor.consultationModes.length > 0) && (
              <div className="bg-white rounded-3xl p-5 shadow-sm space-y-3" style={{ border: "1px solid rgba(200,169,110,.1)" }}>
                {doctor.gender && (
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,169,110,.08)" }}>
                      <User size={12} style={{ color: "#c8a96e" }} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Gender</p>
                      <p className="text-sm font-semibold" style={{ color: "#0f1e38" }}>{doctor.gender}</p>
                    </div>
                  </div>
                )}
                {doctor.languages.length > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,169,110,.08)" }}>
                      <Languages size={12} style={{ color: "#c8a96e" }} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Languages</p>
                      <p className="text-sm font-semibold" style={{ color: "#0f1e38" }}>{doctor.languages.join(", ")}</p>
                    </div>
                  </div>
                )}
                {doctor.consultationModes.length > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,169,110,.08)" }}>
                      <Monitor size={12} style={{ color: "#c8a96e" }} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Consultation</p>
                      <p className="text-sm font-semibold" style={{ color: "#0f1e38" }}>
                        {doctor.consultationModes.map((m) => m === "ONLINE" ? "Online" : "In-Person").join(" · ")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* FULL WIDTH: Schedule */}
        {hasSchedule && (
          <div className="bg-white rounded-3xl p-6 shadow-sm" style={{ border: "1px solid rgba(200,169,110,.1)" }}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-5" style={{ color: "#c8a96e" }}>Weekly Schedule</p>
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${activeDays.length}, 1fr)` }}>
              {activeDays.map((day) => {
                const slots = byDay[day] ?? [];
                return (
                  <div key={day} className="flex flex-col gap-2">
                    <div className="text-center py-2.5 rounded-xl"
                      style={{ background: "linear-gradient(135deg,#0f1e38,#1a3059)" }}>
                      <span className="text-xs font-black text-white">{DAYS[day]}</span>
                    </div>
                    {slots.map((s) => {
                      const isOnline = s.mode === "ONLINE";
                      const bookableSlots = bookingSlotLabels(s);
                      return (
                        <div key={s.id} className="rounded-xl py-3 text-center"
                          style={{
                            background: isOnline ? "rgba(59,130,246,.07)" : "rgba(200,169,110,.08)",
                            border: `1px solid ${isOnline ? "rgba(59,130,246,.15)" : "rgba(200,169,110,.18)"}`,
                          }}>
                          <p className="text-xs font-bold leading-tight" style={{ color: isOnline ? "#2563eb" : "#a88b50" }}>
                            {s.startTime}-{s.endTime}
                          </p>
                          <p className="text-[10px] mt-0.5 opacity-55" style={{ color: isOnline ? "#2563eb" : "#a88b50" }}>
                            {s.slotDurationMinutes}-min {isOnline ? "Online" : "In-Person"}
                          </p>
                          {bookableSlots.length > 0 && (
                            <div className="mt-2 flex flex-wrap justify-center gap-1.5 px-2">
                              {bookableSlots.map((label) => (
                                <span
                                  key={label}
                                  className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold"
                                  style={{ color: isOnline ? "#2563eb" : "#a88b50" }}
                                >
                                  {label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {showAvailability && (
        <AvailabilityModal
          doctor={{
            id: doctor.id,
            fullName: doctor.fullName,
            gender: doctor.gender ?? null,
            experienceYears: doctor.experienceYears ?? null,
            education: doctor.education ?? null,
            bio: doctor.bio ?? null,
            languages: doctor.languages,
            consultationModes: doctor.consultationModes,
            licenseNumber: doctor.licenseNumber ?? null,
            feeMin: doctor.feeMin ?? null,
            feeMax: doctor.feeMax ?? null,
            currency: doctor.currency,
            verified: doctor.verified,
            image: doctor.image ?? null,
            specialties: doctor.specialties,
          }}
          slots={doctor.availability}
          isOpen={showAvailability}
          onCloseAction={() => setShowAvailability(false)}
          daysToShow={7}
          onBookAction={() => setShowAvailability(false)}
        />
      )}
    </div>
  );
}
