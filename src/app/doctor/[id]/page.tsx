"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  X, CheckCircle2, MapPin, Calendar,
  Loader2, AlertCircle, Building2, Clock, Monitor, User, ArrowLeft,
} from "lucide-react";
import { AvailabilityModal } from "@/components/availability-modal";
import { cleanEducation } from "@/components/doctor-card";
import type { ApiAvailabilitySlot } from "@/types/hospital";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type DoctorData = {
  id: string;
  fullName: string;
  gender: string | null;
  experienceYears: number | null;
  education: string | null;
  bio: string | null;
  languages: string[];
  consultationModes: string[];
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
  const sym = (currency ?? "eur").toLowerCase() === "eur" ? "€" : "$";
  if (min == null) return null;
  const minW = Math.round(min / 100);
  const maxW = max != null ? Math.round(max / 100) : null;
  return maxW && maxW !== minW ? `${sym}${minW} – ${sym}${maxW}` : `${sym}${minW}`;
}

function withDr(name: string) {
  if (/^(dr\.?|prof\.?)/i.test(name.trim())) return name;
  return `Dr. ${name}`;
}

export default function DoctorProfilePage() {
  const params = useParams();
  const id = params?.id as string;

  const [doctor, setDoctor] = useState<DoctorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
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

  const byDay = doctor.availability.reduce<Record<number, typeof doctor.availability>>((acc, s) => {
    (acc[s.dayOfWeek] ??= []).push(s);
    return acc;
  }, {});

  const hasSchedule = Object.keys(byDay).length > 0;
  const canBook = doctor.availability.length > 0;

  return (
    <div className="min-h-screen" style={{ background: "#f0ece4" }}>

      {/* ── HERO ── */}
      <div style={{ background: "linear-gradient(160deg,#0a1628 0%,#0f1e38 60%,#1a2e50 100%)" }} className="pt-20 pb-32 relative">
        <button onClick={() => router.back()}
          className="absolute top-4 right-6 h-9 w-9 rounded-full flex items-center justify-center transition-all hover:scale-110"
          style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", color: "rgba(255,255,255,.6)" }}>
          <X size={16} />
        </button>

        <div className="max-w-4xl mx-auto px-6 mt-8 flex flex-col sm:flex-row items-start sm:items-end gap-6">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <img
              src={doctor.image ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(doctor.fullName)}&background=1a3059&color=c8a96e&size=160&bold=true`}
              alt={doctor.fullName}
              className="w-32 h-32 rounded-3xl object-cover"
              style={{ boxShadow: "0 0 0 3px rgba(200,169,110,.4), 0 20px 40px rgba(0,0,0,.3)" }}
            />
            {doctor.verified && (
              <div className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", boxShadow: "0 0 0 2.5px #0f1e38" }}>
                <CheckCircle2 size={16} className="text-white" />
              </div>
            )}
          </div>

          {/* Name block */}
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {doctor.verified && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(34,197,94,.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,.2)" }}>
                  ✓ Verified
                </span>
              )}
              {doctor.consultationModes.includes("ONLINE") && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
                  style={{ background: "rgba(59,130,246,.12)", color: "#93c5fd", border: "1px solid rgba(59,130,246,.2)" }}>
                  <Monitor size={10} /> Online
                </span>
              )}
              {doctor.consultationModes.includes("PHYSICAL") && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
                  style={{ background: "rgba(200,169,110,.12)", color: "#c8a96e", border: "1px solid rgba(200,169,110,.2)" }}>
                  <User size={10} /> In-Person
                </span>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">{withDr(doctor.fullName)}</h1>
            {primarySpecialty && (
              <p className="text-base font-medium mt-1" style={{ color: "#c8a96e" }}>{primarySpecialty}</p>
            )}
            {primaryHospital && (
              <p className="flex items-center gap-1.5 text-sm mt-1.5" style={{ color: "rgba(255,255,255,.4)" }}>
                <MapPin size={12} />
                {primaryHospital.positionTitle ? `${primaryHospital.positionTitle} · ` : ""}{primaryHospital.name}, {primaryHospital.city}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="max-w-4xl mx-auto px-6 -mt-14 relative z-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-lg text-center" style={{ border: "1px solid rgba(200,169,110,.15)" }}>
            <p className="text-2xl font-black" style={{ color: "#0f1e38" }}>
              {doctor.experienceYears != null ? `${doctor.experienceYears}+` : "—"}
            </p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mt-0.5">Yrs Exp</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-lg text-center" style={{ border: "1px solid rgba(200,169,110,.15)" }}>
            <p className="text-2xl font-black" style={{ color: "#0f1e38" }}>{doctor.hospitals.length}</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mt-0.5">Hospitals</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-lg text-center" style={{ border: "1px solid rgba(200,169,110,.15)" }}>
            <p className="text-2xl font-black" style={{ color: "#c8a96e" }}>{fee ?? "—"}</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mt-0.5">Fee</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-lg text-center" style={{ border: "1px solid rgba(200,169,110,.15)" }}>
            <p className="text-2xl font-black" style={{ color: "#0f1e38" }}>{hasSchedule ? Object.keys(byDay).length : "—"}</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mt-0.5">Days/Week</p>
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="max-w-4xl mx-auto px-6 pt-6 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

          {/* ── LEFT (2/3) ── */}
          <div className="sm:col-span-2 space-y-5">

            {/* Bio */}
            {doctor.bio && (
              <div className="bg-white rounded-3xl p-6 shadow-sm" style={{ border: "1px solid rgba(200,169,110,.12)" }}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: "#c8a96e" }}>About</p>
                <p className="text-sm text-gray-600 leading-relaxed">{doctor.bio}</p>
              </div>
            )}

            {/* Schedule */}
            {hasSchedule && (
              <div className="bg-white rounded-3xl p-6 shadow-sm" style={{ border: "1px solid rgba(200,169,110,.12)" }}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: "#c8a96e" }}>Weekly Schedule</p>
                <div className="space-y-2">
                  {[0,1,2,3,4,5,6].map((day) => {
                    const slots = byDay[day];
                    if (!slots) return null;
                    return (
                      <div key={day} className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: "#fdf9f5" }}>
                        <span className="text-xs font-black w-8 flex-shrink-0" style={{ color: "#0f1e38" }}>{DAYS[day]}</span>
                        <div className="flex flex-wrap gap-2 flex-1">
                          {slots.map((s) => (
                            <span key={s.id} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg"
                              style={{
                                background: s.mode === "ONLINE" ? "rgba(59,130,246,.08)" : "rgba(200,169,110,.1)",
                                color: s.mode === "ONLINE" ? "#2563eb" : "#a88b50",
                              }}>
                              <Clock size={10} />
                              {s.startTime}–{s.endTime}
                              <span className="opacity-60">· {s.mode === "ONLINE" ? "Online" : "In-Person"}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Hospitals */}
            {doctor.hospitals.length > 0 && (
              <div className="bg-white rounded-3xl p-6 shadow-sm" style={{ border: "1px solid rgba(200,169,110,.12)" }}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: "#c8a96e" }}>Works At</p>
                <div className="space-y-3">
                  {doctor.hospitals.map((h) => (
                    <Link key={h.id} href={`/hospital/${h.slug}`}
                      className="flex items-center gap-4 p-4 rounded-2xl group transition-all hover:-translate-y-0.5 hover:shadow-md"
                      style={{ border: "1.5px solid rgba(200,169,110,.15)", background: "#fdf9f5" }}>
                      <div className="h-12 w-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center">
                        {h.image
                          ? <img src={h.image} alt={h.name} className="h-full w-full object-cover" />
                          : <Building2 size={18} className="text-gray-300" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold group-hover:text-[#c8a96e] transition-colors" style={{ color: "#0f1e38" }}>{h.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                          <MapPin size={10} /> {h.city}, {h.district}
                          {h.positionTitle && <> · <span>{h.positionTitle}</span></>}
                        </p>
                      </div>
                      <ArrowLeft size={14} className="rotate-180 text-gray-300 group-hover:text-[#c8a96e] transition-all group-hover:translate-x-0.5 flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT (1/3) ── */}
          <div className="space-y-5">

            {/* Book CTA */}
            {canBook && (
              <div className="rounded-3xl p-6 text-center"
                style={{ background: "linear-gradient(135deg,#0f1e38,#1a3059)", border: "1px solid rgba(200,169,110,.2)" }}>
                <div className="h-12 w-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                  style={{ background: "rgba(200,169,110,.15)" }}>
                  <Calendar size={20} style={{ color: "#c8a96e" }} />
                </div>
                <p className="text-white font-bold text-base mb-1">Book an Appointment</p>
                {fee && <p className="text-2xl font-black mb-1" style={{ color: "#c8a96e" }}>{fee}</p>}
                <p className="text-white/35 text-xs mb-4">Consultation fee</p>
                <button onClick={() => setShowAvailability(true)}
                  className="w-full py-3 rounded-2xl text-sm font-black transition-all hover:-translate-y-0.5 hover:shadow-lg"
                  style={{ background: "linear-gradient(135deg,#e8d5b0,#c8a96e,#a88b50)", color: "#0f1e38" }}>
                  Check Availability
                </button>
              </div>
            )}

            {/* Details */}
            <div className="bg-white rounded-3xl p-6 shadow-sm space-y-0" style={{ border: "1px solid rgba(200,169,110,.12)" }}>
              <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: "#c8a96e" }}>Details</p>

              {[
                doctor.gender && { label: "Gender", value: doctor.gender },
                cleanEducation(doctor.education) && { label: "Education", value: cleanEducation(doctor.education) },
                doctor.languages.length > 0 && { label: "Languages", value: doctor.languages.join(", ") },
                doctor.licenseNumber && { label: "License", value: doctor.licenseNumber },
              ].filter(Boolean).map((row: any) => (
                <div key={row.label} className="py-3" style={{ borderBottom: "1px solid #f5f0e8" }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">{row.label}</p>
                  <p className="text-sm font-medium" style={{ color: "#0f1e38" }}>{row.value}</p>
                </div>
              ))}
            </div>

            {/* Modes */}
            {doctor.consultationModes.length > 0 && (
              <div className="bg-white rounded-3xl p-6 shadow-sm" style={{ border: "1px solid rgba(200,169,110,.12)" }}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: "#c8a96e" }}>Consultation</p>
                <div className="space-y-2">
                  {doctor.consultationModes.includes("ONLINE") && (
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={{ background: "rgba(59,130,246,.05)", border: "1px solid rgba(59,130,246,.12)" }}>
                      <Monitor size={15} style={{ color: "#2563eb" }} />
                      <p className="text-sm font-semibold" style={{ color: "#0f1e38" }}>Online</p>
                    </div>
                  )}
                  {doctor.consultationModes.includes("PHYSICAL") && (
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={{ background: "rgba(200,169,110,.06)", border: "1px solid rgba(200,169,110,.15)" }}>
                      <User size={15} style={{ color: "#c8a96e" }} />
                      <p className="text-sm font-semibold" style={{ color: "#0f1e38" }}>In-Person</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
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
            consultationModes: doctor.consultationModes as any,
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
