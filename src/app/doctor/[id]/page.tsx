"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2, MapPin, Loader2, AlertCircle, Building2, Monitor, User,
  ChevronLeft, GraduationCap, Briefcase, Globe, Clock, Sparkles, ArrowRight, Heart,
  Stethoscope, Share2, Star,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { AvailabilityModal } from "@/components/availability-modal";
import { cleanEducation } from "@/components/doctor-card";
import type { ApiAvailabilitySlot } from "@/types/hospital";
import { formatMoneyCents } from "@/lib/money";
import { buildRollingOccurrences, formatDate, type WindowSlot } from "@/lib/availability";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Mirror the booking modal's booked-key normalisation so the rail and the modal agree.
function normalizeSlotTime(value: string) {
  return value.replace(/\s*-\s*/g, " - ").trim();
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
  return /^(dr\.?|prof\.?)/i.test(name.trim()) ? name : `Dr. ${name}`;
}

const cardCls = "bg-white border border-[rgba(20,33,29,0.07)] rounded-[20px]";

const AVATAR_GRAD = [
  "linear-gradient(140deg,#1C7A64,#0C6B57)",
  "linear-gradient(140deg,#CF6E83,#C0556B)",
  "linear-gradient(140deg,#9356A6,#7A3E8E)",
  "linear-gradient(140deg,#566B7A,#3C4742)",
];

// MOCK reviews — doctor-level reviews backend not built yet; wired in a later pass.
const MOCK_REVIEW_AVG = 4.9;
const MOCK_REVIEW_COUNT = 328;
const MOCK_BREAKDOWN = [
  { star: 5, pct: "88%" }, { star: 4, pct: "9%" }, { star: 3, pct: "2%" }, { star: 2, pct: "1%" }, { star: 1, pct: "0%" },
];
const MOCK_REVIEWS = [
  { initials: "RM", name: "Rajesh Maharjan", time: "3 days ago", rating: 5, text: "Dr. Sharma explained my angiogram results in plain Nepali and never rushed. The angioplasty went smoothly and I was home in two days. Truly grateful." },
  { initials: "SK", name: "Sita Karki", time: "2 weeks ago", rating: 5, text: "I came in with chest pain and high anxiety. She was calm, thorough, and ordered exactly the tests I needed — nothing extra. Honest and caring doctor." },
  { initials: "PG", name: "Prabin Gauchan", time: "1 month ago", rating: 4, text: "Excellent cardiologist. Booking through SewaSetu meant no waiting in line. Consultation started right on time." },
];

export default function DoctorProfilePage() {
  const params = useParams();
  const id = params?.id as string;

  const [doctor, setDoctor] = useState<DoctorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAvailability, setShowAvailability] = useState(false);
  const [mode, setMode] = useState<"PHYSICAL" | "ONLINE">("PHYSICAL");
  const [dateIdx, setDateIdx] = useState(0);
  const [time, setTime] = useState<string | null>(null);
  const [saved, setSaved] = useState(false); // mocked — wired up in a later pass

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

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  // Same booked-slot source the booking modal uses, so the two stay in sync.
  const [bookedSet, setBookedSet] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!id) return;
    fetch(`/api/availability/booked?doctorId=${id}`)
      .then((r) => r.json())
      .then((data: { booked?: { slotId: string; date: string; slotTime?: string | null }[] }) => {
        const set = new Set<string>();
        for (const b of data.booked ?? []) set.add(`${b.slotId}::${b.date}::${normalizeSlotTime(b.slotTime ?? "")}`);
        setBookedSet(set);
      })
      .catch(() => {});
  }, [id]);

  // Build occurrences with the exact same lib the modal uses.
  const rolling = useMemo(
    () => buildRollingOccurrences((doctor?.availability ?? []) as WindowSlot[], today, 14, doctor?.id),
    [doctor, today]
  );

  // Next days that have a *bookable* slot (not expired, not already booked) — cap at 6 chips.
  const upcomingDays = useMemo(() => {
    const nowHour = new Date().getHours();
    const out: { date: Date; dow: string; dom: string; times: string[] }[] = [];
    for (const date of rolling.dates) {
      if (out.length >= 6) break;
      const dateStr = formatDate(date);
      const isToday = date.getTime() === today.getTime();
      const isPast = date.getTime() < today.getTime();
      const avail = (rolling.occurrencesByDate[dateStr] ?? []).filter((o) => {
        const slotHour = parseInt(o.startTime.split(":")[0], 10);
        const expired = isPast || (isToday && slotHour <= nowHour);
        const booked = bookedSet.has(`${o.windowId}::${o.date}::${normalizeSlotTime(`${o.startTime}-${o.endTime}`)}`);
        return !expired && !booked;
      });
      if (avail.length) {
        const times = Array.from(new Set(avail.map((o) => `${o.startTime}-${o.endTime}`)));
        out.push({ date, dow: isToday ? "Today" : WEEKDAY[date.getDay()], dom: String(date.getDate()), times });
      }
    }
    return out;
  }, [rolling, bookedSet, today]);

  if (loading) return (
    <main className="min-h-screen bg-page"><Navbar />
      <div className="flex items-center justify-center pt-40"><Loader2 className="h-8 w-8 animate-spin text-brand" /></div>
    </main>
  );

  if (error || !doctor) return (
    <main className="min-h-screen bg-page"><Navbar />
      <div className="flex flex-col items-center justify-center gap-4 pt-40">
        <AlertCircle className="h-10 w-10 text-[#C0556B]" />
        <p className="font-semibold text-ink">{error || "Doctor not found"}</p>
        <Link href="/search" className="rounded-[11px] bg-brand px-5 py-2.5 text-sm font-semibold text-white">Back to Search</Link>
      </div>
    </main>
  );

  const primarySpecialty = doctor.specialties.find((s) => s.isPrimary)?.name ?? doctor.specialties[0]?.name ?? "";
  const primaryHospital = doctor.hospitals.find((h) => h.isPrimary) ?? doctor.hospitals[0];
  const fee = formatFee(doctor.feeMin, doctor.feeMax, doctor.currency);
  const education = cleanEducation(doctor.education);
  const canBook = doctor.availability.length > 0;
  const selectedDay = upcomingDays[dateIdx];
  const times = selectedDay ? selectedDay.times : [];

  const heroStats = [
    { value: doctor.experienceYears != null ? `${doctor.experienceYears} yrs` : "—", label: "Experience" },
    { value: String(doctor.hospitals.length || "—"), label: doctor.hospitals.length === 1 ? "Affiliation" : "Affiliations" },
    { value: String(doctor.specialties.length || "—"), label: "Specialties" },
    { value: fee ?? "—", label: "Consultation", accent: true },
  ];

  const glance = [
    doctor.languages.length ? { label: "Languages", value: doctor.languages.join(", "), Icon: Globe, bg: "#E6EEF4", fg: "#3F6B8C" } : null,
    doctor.gender ? { label: "Gender", value: doctor.gender, Icon: User, bg: "#FAEBD9", fg: "#C0763A" } : null,
    doctor.consultationModes.length ? { label: "Consultation", value: doctor.consultationModes.map((m) => (m === "ONLINE" ? "Online" : "In-person")).join(" · "), Icon: Monitor, bg: "#E6F0EC", fg: "#0C6B57" } : null,
    upcomingDays[0] ? { label: "Next available", value: `${upcomingDays[0].dow}${upcomingDays[0].times[0] ? `, ${upcomingDays[0].times[0].split("-")[0]}` : ""}`, Icon: Clock, bg: "#F0E9F4", fg: "#7A3E8E" } : null,
  ].filter(Boolean) as { label: string; value: string; Icon: typeof Globe; bg: string; fg: string }[];

  const effectiveMode = doctor.consultationModes.includes(mode) ? mode : (doctor.consultationModes[0] ?? mode);
  const modeMeta = { PHYSICAL: { label: "In-person", Icon: Building2 }, ONLINE: { label: "Video consult", Icon: Monitor } };
  const aboutName = withDr(doctor.fullName).split(" ").slice(0, 2).join(" ");

  return (
    <main className="min-h-screen bg-page">
      <Navbar />
      <div className="mx-auto max-w-[1160px] px-5 pt-[88px] pb-14 sm:px-9">

        {/* back */}
        {primaryHospital ? (
          <Link href={`/hospital/${primaryHospital.slug}`} className="mb-4 inline-flex items-center gap-2 text-[13.5px] font-semibold text-ink-soft transition-colors hover:text-brand">
            <ChevronLeft className="h-4 w-4" /> Back to {primaryHospital.name}
          </Link>
        ) : (
          <Link href="/search" className="mb-4 inline-flex items-center gap-2 text-[13.5px] font-semibold text-ink-soft transition-colors hover:text-brand">
            <ChevronLeft className="h-4 w-4" /> Back to search
          </Link>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_348px] lg:items-start">
          {/* ── LEFT ── */}
          <div>
            {/* HERO CARD */}
            <div className="overflow-hidden rounded-[24px] border border-[rgba(20,33,29,0.07)] bg-white shadow-[0_22px_50px_-34px_rgba(20,33,29,0.5)]">
              <div className="relative h-32" style={{ background: "linear-gradient(140deg,#1C7A64,#0C6B57 55%,#0a5848)" }}>
                <Stethoscope className="absolute -bottom-6 right-7 h-24 w-24 text-white/15" strokeWidth={1.6} />
                {primaryHospital && (
                  <div className="absolute left-7 top-5 pr-24">
                    <div className="font-display text-[18px] font-bold tracking-[-0.01em] text-white">{primaryHospital.name}</div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-[#CFE0D8]">
                      <MapPin className="h-3.5 w-3.5" /> {primaryHospital.city}
                    </div>
                  </div>
                )}
                {/* Save / Share — mocked for now, wired up in a later pass */}
                <div className="absolute right-[18px] top-8 flex gap-2.5">
                  <button
                    type="button"
                    aria-label={saved ? "Remove from saved" : "Save doctor"}
                    aria-pressed={saved}
                    onClick={() => setSaved((s) => !s)}
                    className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/[0.16] backdrop-blur-sm transition-colors hover:bg-white/25"
                  >
                    <Heart className={`h-[18px] w-[18px] text-white ${saved ? "fill-white" : ""}`} />
                  </button>
                  <button
                    type="button"
                    aria-label="Share doctor"
                    className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/[0.16] backdrop-blur-sm transition-colors hover:bg-white/25"
                  >
                    <Share2 className="h-[18px] w-[18px] text-white" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-5 px-7 pb-6 pt-3.5">
                <span className="relative z-10 -mt-[72px] block h-[120px] w-[120px] shrink-0 overflow-hidden rounded-[28px] border-[5px] border-white shadow-[0_16px_34px_-16px_rgba(12,107,87,0.7)]">
                  <Image
                    loader={({ src }) => src} unoptimized
                    src={doctor.image ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(doctor.fullName)}&background=0C6B57&color=fff&size=160&bold=true`}
                    alt={doctor.fullName} width={120} height={120} className="h-full w-full object-cover object-top"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="font-display text-[28px] font-bold leading-[1.05] tracking-[-0.025em] text-ink sm:text-[30px]">{withDr(doctor.fullName)}</h1>
                    {doctor.verified && (
                      <span className="flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-[11.5px] font-bold text-brand">
                        <CheckCircle2 className="h-3 w-3" /> Verified
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 text-[15px] font-bold text-brand">
                    {[primaryHospital?.positionTitle, primarySpecialty].filter(Boolean).join(" · ") || "Doctor"}
                  </div>
                  {education && <div className="mt-1 text-[13px] font-medium text-ink-muted">{education}</div>}
                </div>
              </div>
              {/* stat strip */}
              <div className="grid grid-cols-4 border-t border-[rgba(20,33,29,0.07)]">
                {heroStats.map((s, i) => (
                  <div key={s.label} className="px-4 py-4 sm:px-5" style={{ borderRight: i < heroStats.length - 1 ? "1px solid rgba(20,33,29,.07)" : "none" }}>
                    <div className="font-display text-[18px] font-bold tracking-[-0.01em] sm:text-[20px]" style={{ color: s.accent ? "#0C6B57" : "#14211D" }}>{s.value}</div>
                    <div className="mt-1 text-[11.5px] font-semibold text-ink-muted">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ABOUT */}
            {(doctor.bio || doctor.specialties.length > 0) && (
              <div className={`${cardCls} mt-6 p-7`}>
                <h2 className="font-display text-[22px] font-bold tracking-[-0.02em] text-ink">About {aboutName}</h2>
                {doctor.bio && <p className="mt-3 text-[15px] leading-[1.65] text-ink-soft">{doctor.bio}</p>}
                {doctor.specialties.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    {doctor.specialties.map((t) => (
                      <span key={t.id} className="rounded-full border border-[rgba(12,107,87,0.15)] bg-brand-soft px-3 py-1.5 text-[12.5px] font-semibold text-brand">{t.name}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* EXPERIENCE & EDUCATION */}
            {(doctor.hospitals.length > 0 || education) && (
              <div className="mt-[18px] grid gap-[18px] sm:grid-cols-2">
                {doctor.hospitals.length > 0 && (
                  <div className={`${cardCls} p-6`}>
                    <div className="mb-4 flex items-center gap-2.5">
                      <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-brand-soft text-brand"><Briefcase className="h-[17px] w-[17px]" /></span>
                      <h3 className="font-display text-[17px] font-bold tracking-[-0.01em] text-ink">Affiliations</h3>
                    </div>
                    {doctor.hospitals.map((h, i) => (
                      <Link key={h.id} href={`/hospital/${h.slug}`} className="group relative block pb-[18px] pl-[22px] last:pb-0">
                        <span className="absolute left-0 top-1 h-[11px] w-[11px] rounded-full border-[2.5px] border-white bg-brand shadow-[0_0_0_1.5px_#0C6B57]" />
                        {i < doctor.hospitals.length - 1 && <span className="absolute left-[5px] top-[18px] bottom-0 w-[1.5px] bg-[rgba(20,33,29,0.1)]" />}
                        <div className="text-[14.5px] font-bold text-ink transition-colors group-hover:text-brand">{h.positionTitle ?? "Consultant"}</div>
                        <div className="mt-0.5 text-[13px] font-semibold text-brand">{h.name}</div>
                        <div className="mt-0.5 text-[12px] font-semibold text-[#9AA39E]">{h.city}</div>
                      </Link>
                    ))}
                  </div>
                )}
                {education && (
                  <div className={`${cardCls} p-6`}>
                    <div className="mb-4 flex items-center gap-2.5">
                      <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#F0E9F4] text-[#7A3E8E]"><GraduationCap className="h-[17px] w-[17px]" /></span>
                      <h3 className="font-display text-[17px] font-bold tracking-[-0.01em] text-ink">Education</h3>
                    </div>
                    {education.split(/[,;]\s*/).filter(Boolean).map((line, i, arr) => (
                      <div key={i} className="relative pb-[18px] pl-[22px] last:pb-0">
                        <span className="absolute left-0 top-1 h-[11px] w-[11px] rounded-full border-[2.5px] border-white bg-[#7A3E8E] shadow-[0_0_0_1.5px_#7A3E8E]" />
                        {i < arr.length - 1 && <span className="absolute left-[5px] top-[18px] bottom-0 w-[1.5px] bg-[rgba(20,33,29,0.1)]" />}
                        <div className="text-[14.5px] font-bold text-ink">{line}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* REVIEWS — MOCK data; doctor-level reviews backend not built yet, wired in a later pass */}
            <div className={`${cardCls} mt-[18px] rounded-[22px] p-6 sm:p-7`}>
              <div className="grid gap-8 lg:grid-cols-[230px_1fr] lg:items-start">
                {/* score panel */}
                <div className="text-center lg:border-r lg:border-[rgba(20,33,29,0.07)] lg:pr-6">
                  <div className="font-display text-[52px] font-bold leading-none tracking-[-0.03em] text-ink">{MOCK_REVIEW_AVG.toFixed(1)}</div>
                  <div className="mt-2 flex justify-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className="h-[17px] w-[17px]" style={{ fill: "#E0913A", color: "#E0913A", strokeWidth: 0 }} />
                    ))}
                  </div>
                  <p className="mt-2 text-[13px] text-ink-muted">{MOCK_REVIEW_COUNT} patient reviews</p>
                  <div className="mt-[18px] space-y-[7px]">
                    {MOCK_BREAKDOWN.map((b) => (
                      <div key={b.star} className="flex items-center gap-[9px]">
                        <span className="w-2.5 text-[12px] text-ink-muted">{b.star}</span>
                        <span className="h-[7px] flex-1 overflow-hidden rounded-full" style={{ background: "#EFEAE0" }}>
                          <span className="block h-full rounded-full" style={{ width: b.pct, background: "#E0913A" }} />
                        </span>
                        <span className="w-[30px] text-right text-[11.5px] text-[#9AA39E]">{b.pct}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* list */}
                <div className="min-w-0">
                  <h2 className="font-display mb-4 text-[20px] font-bold tracking-[-0.02em] text-ink">Patient reviews</h2>
                  <div className="flex flex-col gap-4">
                    {MOCK_REVIEWS.map((r, i) => (
                      <div key={r.name} className="border-b border-[rgba(20,33,29,0.06)] pb-4 last:border-b-0 last:pb-0">
                        <div className="flex items-start gap-[11px]">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-bold text-white" style={{ background: AVATAR_GRAD[i % AVATAR_GRAD.length], fontFamily: "var(--font-bricolage), sans-serif" }}>
                            {r.initials}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[14px] font-bold text-ink">{r.name}</span>
                              <span className="flex items-center gap-1 rounded-full bg-brand-soft px-[7px] py-0.5 text-[10.5px] font-bold text-brand">
                                <CheckCircle2 className="h-3 w-3" /> Verified patient
                              </span>
                            </div>
                            <div className="mt-[3px] flex items-center gap-2">
                              <span className="flex gap-px">
                                {Array.from({ length: r.rating }).map((_, j) => (
                                  <Star key={j} className="h-3 w-3" style={{ fill: "#E0913A", color: "#E0913A", strokeWidth: 0 }} />
                                ))}
                              </span>
                              <span className="text-[11.5px] text-[#9AA39E]">{r.time}</span>
                            </div>
                          </div>
                        </div>
                        <p className="mt-[11px] text-[13.5px] leading-[1.6] text-ink-soft">{r.text}</p>
                      </div>
                    ))}
                  </div>
                  <button className="mt-[18px] rounded-[11px] border border-[rgba(20,33,29,0.12)] bg-white px-5 py-2.5 text-[13.5px] font-bold text-ink transition-colors hover:bg-page">
                    Show all {MOCK_REVIEW_COUNT} reviews
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT RAIL ── */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-[88px]">
            {/* booking card */}
            <div className="rounded-[20px] border border-[rgba(20,33,29,0.07)] bg-white p-[22px] shadow-[0_18px_44px_-30px_rgba(20,33,29,0.6)]">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-[11.5px] font-semibold text-ink-muted">Consultation fee</div>
                  <div className="mt-0.5 flex items-baseline gap-1">
                    <span className="font-display text-[30px] font-bold tracking-[-0.02em] text-brand">{fee ?? "—"}</span>
                    {fee && <span className="text-[13px] font-medium text-ink-muted">/ visit</span>}
                  </div>
                </div>
                <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-bold" style={{ background: canBook ? "#E6F0EC" : "#F1EFE8", color: canBook ? "#0C6B57" : "#7B857F" }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: canBook ? "#3FA483" : "#9AA39E" }} />
                  {canBook ? "Available" : "No slots"}
                </span>
              </div>

              {/* mode toggle */}
              {doctor.consultationModes.length > 0 && (
                <div className="mt-[18px] flex gap-2.5">
                  {doctor.consultationModes.map((m) => {
                    const active = effectiveMode === m;
                    const Meta = modeMeta[m];
                    const Icon = Meta.Icon;
                    return (
                      <button key={m} onClick={() => setMode(m)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-[11px] border-[1.5px] px-3 py-2.5 text-[13px] font-semibold transition-colors"
                        style={{ background: active ? "#E6F0EC" : "#fff", color: active ? "#0C6B57" : "#46524D", borderColor: active ? "#0C6B57" : "rgba(20,33,29,.12)" }}>
                        <Icon className="h-4 w-4" /> {Meta.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {canBook ? (
                <>
                  {/* dates */}
                  <div className="mb-2.5 mt-[18px] text-[11.5px] font-bold uppercase tracking-[0.04em] text-ink-muted">Select date</div>
                  <div className="flex gap-1.5">
                    {upcomingDays.map((d, i) => {
                      const active = dateIdx === i;
                      return (
                        <button key={i} onClick={() => { setDateIdx(i); setTime(null); }}
                          className="flex-1 rounded-[12px] border-[1.5px] px-0.5 py-2.5 text-center transition-colors"
                          style={{ background: active ? "#0C6B57" : "#fff", color: active ? "#fff" : "#14211D", borderColor: active ? "#0C6B57" : "rgba(20,33,29,.12)" }}>
                          <div className="text-[10.5px] font-semibold" style={{ color: active ? "rgba(255,255,255,.7)" : "#9AA39E" }}>{d.dow}</div>
                          <div className="mt-0.5 text-[15px] font-bold">{d.dom}</div>
                        </button>
                      );
                    })}
                  </div>

                  {/* times */}
                  <div className="mb-2.5 mt-[18px] text-[11.5px] font-bold uppercase tracking-[0.04em] text-ink-muted">Available time</div>
                  <div className="grid grid-cols-3 gap-2">
                    {times.length ? times.map((t) => {
                      const active = time === t;
                      return (
                        <button key={t} onClick={() => setTime(t)}
                          className="rounded-[10px] border-[1.5px] px-1 py-2.5 text-[12.5px] font-semibold transition-colors"
                          style={{ background: active ? "#0C6B57" : "#fff", color: active ? "#fff" : "#14211D", borderColor: active ? "#0C6B57" : "rgba(20,33,29,.14)" }}>
                          {t.split("-")[0]}
                        </button>
                      );
                    }) : <div className="col-span-3 text-[12.5px] text-ink-muted">No times for this day.</div>}
                  </div>
                </>
              ) : (
                <p className="mt-[18px] rounded-[12px] bg-page px-4 py-3 text-[13px] text-ink-muted">This doctor hasn’t published a schedule yet. Check back soon.</p>
              )}

              <button onClick={() => canBook && setShowAvailability(true)} disabled={!canBook}
                className="mt-[18px] flex w-full items-center justify-center gap-2 rounded-[13px] py-3.5 text-[15px] font-semibold text-white transition-all disabled:cursor-not-allowed"
                style={{ background: canBook ? "#0C6B57" : "#9CB3AC" }}>
                {canBook ? (time ? "Book appointment" : "Check availability") : "Not available"}
                {canBook && <ArrowRight className="h-4 w-4" />}
              </button>
              {canBook && <div className="mt-2.5 text-center text-[11px] text-[#9AA39E]">Free cancellation up to 2 hours before</div>}
            </div>

            {/* good to know */}
            {glance.length > 0 && (
              <div className="rounded-[18px] border border-[rgba(20,33,29,0.07)] bg-white p-5">
                <div className="font-display mb-3 text-[15px] font-bold text-ink">Good to know</div>
                {glance.map((g, i) => {
                  const Icon = g.Icon;
                  return (
                    <div key={g.label} className="flex items-center gap-3 py-2.5" style={{ borderBottom: i < glance.length - 1 ? "1px solid rgba(20,33,29,.06)" : "none" }}>
                      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]" style={{ background: g.bg, color: g.fg }}><Icon className="h-[17px] w-[17px]" /></span>
                      <div>
                        <div className="text-[11px] font-semibold text-ink-muted">{g.label}</div>
                        <div className="text-[13.5px] font-bold text-ink">{g.value}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* AI nudge */}
            <div className="rounded-[18px] p-5 text-white" style={{ background: "linear-gradient(140deg,#14211D,#0a2620)" }}>
              <div className="font-display text-[15.5px] font-bold">Not sure who’s the right fit?</div>
              <p className="mt-2 text-[12.5px] leading-[1.5] text-[#9FB0AA]">Describe your symptoms and SewaSetu AI will confirm the right specialist for you.</p>
              <Link href="/?openAI=true" className="mt-3.5 flex items-center justify-center gap-2 rounded-[11px] py-2.5 text-[13.5px] font-semibold text-white" style={{ background: "linear-gradient(135deg,#E0913A,#cf7f29)" }}>
                <Sparkles className="h-[15px] w-[15px]" /> Ask Smart Search
              </Link>
            </div>
          </div>
        </div>
      </div>

      {showAvailability && (
        <AvailabilityModal
          doctor={{
            id: doctor.id, fullName: doctor.fullName, gender: doctor.gender ?? null,
            experienceYears: doctor.experienceYears ?? null, education: doctor.education ?? null,
            bio: doctor.bio ?? null, languages: doctor.languages, consultationModes: doctor.consultationModes,
            licenseNumber: doctor.licenseNumber ?? null, feeMin: doctor.feeMin ?? null, feeMax: doctor.feeMax ?? null,
            currency: doctor.currency, verified: doctor.verified, image: doctor.image ?? null, specialties: doctor.specialties,
          }}
          slots={doctor.availability}
          isOpen={showAvailability}
          onCloseAction={() => setShowAvailability(false)}
          daysToShow={7}
          onBookAction={() => setShowAvailability(false)}
        />
      )}
    </main>
  );
}
