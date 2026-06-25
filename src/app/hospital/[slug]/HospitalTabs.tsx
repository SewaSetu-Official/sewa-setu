"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search, ChevronDown, ChevronRight, CheckCircle2, ArrowRight, Sparkles, Star,
  Clock, Siren, Stethoscope, Building2, Heart, Brain, Bone, Baby, ScanLine, Eye, Smile,
  Phone, Mail, Globe, Navigation, Check, Calendar, Info, ShieldCheck, Users,
} from "lucide-react";
import type { ApiDoctor } from "@/types/hospital";
import type { ApiHospitalDetails } from "@/types/hospital-details";
import type { UiPackage } from "@/types/package";
import { ReviewsSection } from "@/components/reviews-section";
import { AvailabilityModal } from "@/components/availability-modal";
import { BookingModal } from "@/components/booking-modal";
import { formatMoneyCents } from "@/lib/money";

type TabKey = "overview" | "services" | "doctors" | "departments" | "contact";

type Props = {
  hospital: ApiHospitalDetails;
  packages: UiPackage[];
  onBookDoctorAction: (doctorId: string) => void;
  initialDepartmentId?: string | null;
  showAIBadge?: boolean;
  hospitalId?: string;
};

const GRAD = [
  "linear-gradient(140deg,#1C7A64,#0C6B57)",
  "linear-gradient(140deg,#CF6E83,#C0556B)",
  "linear-gradient(140deg,#9356A6,#7A3E8E)",
  "linear-gradient(140deg,#566B7A,#3C4742)",
  "linear-gradient(140deg,#E89B47,#cf7f29)",
];

function initialsOf(name: string): string {
  return name.replace(/^(dr\.?|prof\.?)\s*/i, "").trim().split(/\s+/).map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "DR";
}
function withDr(name: string) {
  return /^(dr\.?|prof\.?)/i.test(name.trim()) ? name : `Dr. ${name}`;
}
// MOCK rating — no doctor-level ratings backend yet. Stable per doctor (4.4–5.0), wired in a later pass.
function mockRating(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (4.4 + (h % 7) * 0.1).toFixed(1);
}
function feeText(cents?: number | null, currency?: string | null) {
  return cents == null ? null : formatMoneyCents(cents, currency ?? "EUR");
}

function deptVisual(name: string): { Icon: typeof Heart; bg: string; fg: string } {
  const n = name.toLowerCase();
  if (/cardio|heart/.test(n)) return { Icon: Heart, bg: "#FBEAEE", fg: "#C0556B" };
  if (/neuro|brain/.test(n)) return { Icon: Brain, bg: "#F0E9F4", fg: "#7A3E8E" };
  if (/ortho|bone|joint|spine/.test(n)) return { Icon: Bone, bg: "#E6EEF4", fg: "#3F6B8C" };
  if (/p(a)?edia|child|infant|neonat/.test(n)) return { Icon: Baby, bg: "#FAEBD9", fg: "#C0763A" };
  if (/radio|imaging|scan|mri|ct/.test(n)) return { Icon: ScanLine, bg: "#E6F0EC", fg: "#0C6B57" };
  if (/dental|oral|tooth/.test(n)) return { Icon: Smile, bg: "#EDEFE9", fg: "#5C6B4A" };
  if (/eye|ophthal|vision/.test(n)) return { Icon: Eye, bg: "#E6EEF4", fg: "#3F6B8C" };
  return { Icon: Stethoscope, bg: "#E6F0EC", fg: "#0C6B57" };
}

const cardCls = "bg-white border border-[rgba(20,33,29,0.07)] rounded-[18px]";

export function HospitalTabs({ hospital, packages, initialDepartmentId, hospitalId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlTab = searchParams.get("tab") as TabKey | null;
  const validTabs: TabKey[] = ["overview", "services", "doctors", "departments", "contact"];
  const initialTab = initialDepartmentId ? "departments" : urlTab && validTabs.includes(urlTab) ? urlTab : "overview";
  const [tab, setTab] = useState<TabKey>(initialTab);

  const switchTab = useCallback((next: TabKey) => {
    setTab(next);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", next);
    router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
  }, [router]);

  const [highlightedDeptId, setHighlightedDeptId] = useState<string | null>(initialDepartmentId || null);

  useEffect(() => {
    if (!initialDepartmentId) return;
    const t = window.setTimeout(() => setHighlightedDeptId(null), 3000);
    return () => window.clearTimeout(t);
  }, [initialDepartmentId]);

  // ── filters (doctors tab) ──
  const [doctorQuery, setDoctorQuery] = useState("");
  const [specialty, setSpecialty] = useState<string>("ALL");
  const [sort, setSort] = useState<"FEE_ASC" | "FEE_DESC">("FEE_ASC");

  // ── booking modals ──
  const [bookDoctor, setBookDoctor] = useState<ApiDoctor | null>(null);
  const [bookPackage, setBookPackage] = useState<UiPackage | null>(null);
  const doctorSlots = useMemo(
    () => (bookDoctor ? hospital.availability.filter((s) => s.isActive && s.doctorId === bookDoctor.id) : []),
    [bookDoctor, hospital.availability]
  );
  const slotsFor = useCallback(
    (id: string) => hospital.availability.filter((s) => s.isActive && s.doctorId === id),
    [hospital.availability]
  );

  const doctorDeptMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const dept of hospital.departments ?? [])
      for (const link of dept.doctors ?? [])
        if (!map.has(link.doctorId)) map.set(link.doctorId, dept.name);
    return map;
  }, [hospital.departments]);

  const filteredDoctors = useMemo(() => {
    let docs = [...hospital.doctors];
    const q = doctorQuery.trim().toLowerCase();
    if (q) docs = docs.filter((d) => d.fullName.toLowerCase().includes(q));
    if (specialty !== "ALL") docs = docs.filter((d) => doctorDeptMap.get(d.id) === specialty);
    docs.sort((a, b) => (sort === "FEE_ASC" ? (a.feeMin ?? 0) - (b.feeMin ?? 0) : (b.feeMin ?? 0) - (a.feeMin ?? 0)));
    return docs;
  }, [hospital.doctors, doctorQuery, specialty, sort, doctorDeptMap]);

  const deptCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of hospital.doctors) {
      const dn = doctorDeptMap.get(d.id);
      if (dn) counts.set(dn, (counts.get(dn) ?? 0) + 1);
    }
    return counts;
  }, [hospital.doctors, doctorDeptMap]);

  const TABS: { k: TabKey; label: string }[] = [
    { k: "overview", label: "Overview" },
    { k: "services", label: "Services & Packages" },
    { k: "doctors", label: "Doctors" },
    { k: "departments", label: "Departments" },
    { k: "contact", label: "Contact" },
  ];

  const glance = [
    hospital.openingHours ? { label: "Opening hours", value: hospital.openingHours, Icon: Clock, bg: "#E6F0EC", fg: "#0C6B57" } : null,
    { label: "Emergency", value: hospital.emergencyAvailable ? "24/7 available" : "Not available", Icon: Siren, bg: "#FBEAEE", fg: "#C0556B" },
    hospital.verified ? { label: "Accreditation", value: "Verified hospital", Icon: ShieldCheck, bg: "#FAEBD9", fg: "#C0763A" } : null,
    { label: "Specialists", value: `${hospital.doctors.length} doctors`, Icon: Users, bg: "#E6EEF4", fg: "#3F6B8C" },
  ].filter(Boolean) as { label: string; value: string; Icon: typeof Clock; bg: string; fg: string }[];

  const topDoctors = hospital.doctors.slice(0, 3);

  // Pills under "Our vision": real tags first, else fall back to department names,
  // else primary specialties — so the section is never bare when there's data.
  const visionTags = (() => {
    if (hospital.tags.length) return hospital.tags.slice(0, 8);
    const fromDepts = (hospital.departments ?? []).map((d) => d.name);
    if (fromDepts.length) return Array.from(new Set(fromDepts)).slice(0, 8);
    const fromSpecs = hospital.doctors.flatMap((d) => d.specialties.map((s) => s.name));
    return Array.from(new Set(fromSpecs)).slice(0, 8);
  })();

  // detailed doctor card (doctors tab)
  const DoctorRow = ({ d, i }: { d: ApiDoctor; i: number }) => {
    const spec = doctorDeptMap.get(d.id) ?? d.specialties.find((s) => s.isPrimary)?.name ?? d.specialties[0]?.name ?? "Doctor";
    const edu = d.education ? d.education.split(/[,;]/)[0].trim() : null;
    const fee = feeText(d.feeMin, d.currency);
    const hasSlots = slotsFor(d.id).length > 0;
    return (
      <div className={`${cardCls} flex gap-4 p-[18px]`}>
        <span className="flex h-[60px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded-[15px] text-[20px] font-bold text-white" style={{ background: GRAD[i % GRAD.length], fontFamily: "var(--font-bricolage)" }}>
          {d.image ? <Image loader={({ src }) => src} unoptimized src={d.image} alt={d.fullName} width={60} height={60} className="h-full w-full object-cover object-top" /> : initialsOf(d.fullName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-display truncate text-[15.5px] font-bold text-ink">{withDr(d.fullName)}</span>
            {d.verified && <CheckCircle2 className="h-[15px] w-[15px] shrink-0 text-brand" />}
          </div>
          <div className="mt-0.5 text-[12.5px] font-semibold text-brand">{spec}</div>
          <div className="mt-1 text-[12px] text-ink-muted">{[edu, d.experienceYears != null ? `${d.experienceYears} yrs` : null].filter(Boolean).join(" · ")}</div>
          {/* rating is MOCK — doctor-level ratings backend not built yet */}
          <div className="mt-2.5 flex items-center gap-1.5 text-[12.5px] text-ink-soft">
            <span className="flex items-center gap-1">
              <Star className="h-[13px] w-[13px]" style={{ fill: "#E0913A", color: "#E0913A", strokeWidth: 0 }} />
              {mockRating(d.id)}
            </span>
            {fee && (
              <>
                <span className="text-[#D8D2C6]">·</span>
                Fee <strong className="font-display text-[15px] text-ink">{fee}</strong>
              </>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <Link href={`/doctor/${d.id}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-[rgba(20,33,29,0.14)] bg-white px-3 py-2 text-[12.5px] font-semibold text-ink">Profile</Link>
            <button onClick={() => setBookDoctor(d)} disabled={!hasSlots} title={hasSlots ? "Book" : "No availability"}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-brand px-3 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-40">
              Book <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* ── TABS ── */}
      <div className="sticky top-[68px] z-30 -mx-[var(--page-pad)] mb-6 border-b border-[rgba(20,33,29,0.1)] bg-page/90 px-[var(--page-pad)] pt-2.5 backdrop-blur">
        <div className="flex gap-7 overflow-x-auto overflow-y-hidden">
          {TABS.map(({ k, label }) => {
            const active = tab === k;
            return (
              <button key={k} onClick={() => switchTab(k)} className="relative whitespace-nowrap px-0.5 pb-3.5 pt-1.5 text-[14.5px] transition-colors"
                style={{ color: active ? "#0C6B57" : "#7B857F", fontWeight: active ? 700 : 600 }}>
                {label}
                <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-t-full transition-colors" style={{ background: active ? "#0C6B57" : "transparent" }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── OVERVIEW ── */}
      {tab === "overview" && (
        <div>
          <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
            <div>
              <div className={`${cardCls} rounded-[20px] p-7`}>
                <h2 className="font-display text-[23px] font-bold tracking-[-0.02em] text-ink">Our vision</h2>
                <p className="mt-3.5 text-[15px] leading-[1.65] text-ink-soft">{hospital.servicesSummary || "More details about this hospital will be added soon."}</p>
                {visionTags.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-2.5">
                    {visionTags.map((t) => (
                      <span key={t} className="rounded-full border border-[rgba(12,107,87,0.15)] bg-brand-soft px-3 py-1.5 text-[12.5px] font-semibold text-brand">{t}</span>
                    ))}
                  </div>
                )}
              </div>

              {topDoctors.length > 0 && (
                <>
                  <div className="mb-4 mt-7 flex items-center justify-between px-0.5">
                    <h2 className="font-display text-[21px] font-bold tracking-[-0.02em] text-ink">Top doctors</h2>
                    <button onClick={() => switchTab("doctors")} className="flex items-center gap-1 text-[13.5px] font-bold text-brand">
                      View all {hospital.doctors.length} <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {topDoctors.map((d, i) => {
                      const spec = doctorDeptMap.get(d.id) ?? d.specialties.find((s) => s.isPrimary)?.name ?? d.specialties[0]?.name ?? "Doctor";
                      return (
                        <Link key={d.id} href={`/doctor/${d.id}`} className={`${cardCls} p-[18px] text-center transition-all hover:-translate-y-1 hover:shadow-[0_24px_44px_-28px_rgba(20,33,29,0.5)]`}>
                          <span className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-full text-[22px] font-bold text-white" style={{ background: GRAD[i % GRAD.length], fontFamily: "var(--font-bricolage)" }}>
                            {d.image ? <Image loader={({ src }) => src} unoptimized src={d.image} alt={d.fullName} width={64} height={64} className="h-full w-full object-cover object-top" /> : initialsOf(d.fullName)}
                          </span>
                          <div className="font-display mt-3 text-[15.5px] font-bold text-ink">{withDr(d.fullName)}</div>
                          <div className="mt-0.5 text-[12.5px] font-semibold text-brand">{spec}</div>
                          {d.experienceYears != null && <div className="mt-1 text-[12px] text-ink-muted">{d.experienceYears} yrs exp</div>}
                        </Link>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* side rail */}
            <div className="flex flex-col gap-4 lg:sticky lg:top-[140px]">
              <div className={`${cardCls} p-5`}>
                <div className="font-display mb-3.5 text-[15px] font-bold text-ink">At a glance</div>
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
              <div className="rounded-[18px] p-5 text-white" style={{ background: "linear-gradient(140deg,#14211D,#0a2620)" }}>
                <div className="font-display text-[16px] font-bold">Not sure which doctor?</div>
                <p className="mt-2 text-[13px] leading-[1.5] text-[#9FB0AA]">Let SewaSetu AI match you to the right specialist based on your symptoms.</p>
                <Link href="/?openAI=true" className="mt-3.5 flex items-center justify-center gap-2 rounded-[11px] py-2.5 text-[13.5px] font-semibold text-white" style={{ background: "linear-gradient(135deg,#E0913A,#cf7f29)" }}>
                  <Sparkles className="h-[15px] w-[15px]" /> Ask Smart Search
                </Link>
              </div>
            </div>
          </div>

          {/* reviews */}
          <div className="mt-10">
            <ReviewsSection hospitalId={hospitalId ?? hospital.id} initialAverage={hospital.rating} initialCount={hospital.reviewCount} />
          </div>
        </div>
      )}

      {/* ── SERVICES ── */}
      {tab === "services" && (
        <div>
          <div className="mb-[18px]">
            <h2 className="font-display text-[24px] font-bold tracking-[-0.02em] text-ink">Health packages</h2>
            <p className="mt-1 text-sm text-ink-muted">Transparent pricing · book online · no hidden fees</p>
          </div>
          {packages.length ? (
            <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
              {packages.map((p, i) => {
                const featured = i === 1 && packages.length >= 3;
                const features = p.features.flatMap((f) => f.split("\n").map((l) => l.replace(/^-\s*/, "").trim()).filter(Boolean)).slice(0, 6);
                return (
                  <div key={p.id} className="relative flex flex-col rounded-[20px] border-[1.5px] bg-white p-[22px]" style={{ borderColor: featured ? "#0C6B57" : "rgba(20,33,29,.08)", boxShadow: featured ? "0 24px 50px -28px rgba(12,107,87,.6)" : "none" }}>
                    {featured && <span className="absolute -top-[11px] left-[22px] rounded-full bg-accent px-3 py-1 text-[11px] font-bold text-white">★ Most popular</span>}
                    <div className="font-display text-[18px] font-bold tracking-[-0.01em] text-ink">{p.name}</div>
                    <div className="mt-2.5 flex items-baseline gap-1">
                      <span className="font-display text-[34px] font-bold tracking-[-0.02em] text-brand">{formatMoneyCents(p.price, p.currency)}</span>
                      <span className="text-[13px] font-medium text-ink-muted">/ package</span>
                    </div>
                    <div className="my-4 h-px bg-[rgba(20,33,29,0.08)]" />
                    <div className="flex flex-1 flex-col gap-2.5">
                      {features.map((f, j) => (
                        <div key={j} className="flex items-center gap-2.5 text-[13px] text-ink-soft">
                          <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-brand-soft"><Check className="h-3 w-3 text-brand" /></span>
                          {f}
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setBookPackage(p)} className="mt-[18px] rounded-[12px] py-3 text-sm font-semibold transition-colors" style={{ background: featured ? "#0C6B57" : "#E6F0EC", color: featured ? "#fff" : "#0C6B57" }}>
                      Book now
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`${cardCls} flex flex-col items-center rounded-[18px] px-6 py-14 text-center`}>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand"><Calendar className="h-5 w-5" /></span>
              <p className="font-display mt-3 text-[16px] font-bold text-ink">No packages available yet</p>
              <p className="mt-1 text-sm text-ink-muted">Check back soon.</p>
            </div>
          )}

          {packages.length > 0 && (
            <div className="mt-[18px] grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { title: "Valid 3 months", text: "From your booking date", Icon: Calendar },
                { title: "Advance booking", text: "Reserve your preferred slot", Icon: Clock },
                { title: "Reports in 24–48h", text: "Delivered digitally", Icon: Info },
                { title: "Free follow-up", text: "Within 7 days of visit", Icon: Check },
              ].map((it) => {
                const Icon = it.Icon;
                return (
                  <div key={it.title} className={`${cardCls} rounded-[14px] p-4`}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-brand-soft text-brand"><Icon className="h-4 w-4" /></span>
                    <div className="mt-2.5 text-[13px] font-bold text-ink">{it.title}</div>
                    <div className="mt-0.5 text-[12px] leading-[1.45] text-ink-muted">{it.text}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── DOCTORS ── */}
      {tab === "doctors" && (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr] lg:items-start">
          <aside className={`${cardCls} p-[18px] lg:sticky lg:top-[140px]`}>
            <div className="font-display mb-3.5 text-[16px] font-bold text-ink">Find your doctor</div>
            <div className="mb-3.5 flex items-center gap-2.5 rounded-[11px] bg-page px-3 py-2.5">
              <Search className="h-4 w-4 text-ink-muted" />
              <input value={doctorQuery} onChange={(e) => setDoctorQuery(e.target.value)} placeholder="Search by name" className="w-full bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-muted" />
            </div>
            <div className="mb-2.5 text-[11.5px] font-bold uppercase tracking-[0.04em] text-ink-muted">Department</div>
            <div className="thin-scrollbar flex flex-col gap-1.5 lg:max-h-[calc(100vh-320px)] lg:overflow-y-auto lg:overflow-x-hidden lg:pr-1">
              <button onClick={() => setSpecialty("ALL")} className="flex items-center justify-between rounded-[9px] px-3 py-2 text-[13px] font-semibold transition-colors"
                style={{ background: specialty === "ALL" ? "#E6F0EC" : "transparent", color: specialty === "ALL" ? "#0C6B57" : "#46524D" }}>
                All departments <span className="text-[11.5px] text-ink-muted">{hospital.doctors.length}</span>
              </button>
              {(hospital.departments ?? []).filter((d) => deptCounts.get(d.name)).map((d) => {
                const active = specialty === d.name;
                return (
                  <button key={d.id} onClick={() => setSpecialty(d.name)} className="flex items-center justify-between rounded-[9px] px-3 py-2 text-[13px] font-semibold transition-colors"
                    style={{ background: active ? "#E6F0EC" : "transparent", color: active ? "#0C6B57" : "#46524D" }}>
                    <span className="truncate">{d.name}</span> <span className="text-[11.5px] text-ink-muted">{deptCounts.get(d.name)}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-ink-soft">{filteredDoctors.length} doctors{specialty !== "ALL" && <> · <strong className="text-ink">{specialty}</strong></>}</div>
              <button onClick={() => setSort((s) => (s === "FEE_ASC" ? "FEE_DESC" : "FEE_ASC"))} className="flex items-center gap-1.5 rounded-[10px] border border-[rgba(20,33,29,0.12)] bg-white px-3 py-2 text-[13px] font-bold text-ink">
                Fee: {sort === "FEE_ASC" ? "low to high" : "high to low"} <ChevronDown className="h-3.5 w-3.5 text-ink-muted" />
              </button>
            </div>
            {filteredDoctors.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {filteredDoctors.map((d, i) => <DoctorRow key={d.id} d={d} i={i} />)}
              </div>
            ) : (
              <div className={`${cardCls} flex flex-col items-center rounded-[18px] px-6 py-14 text-center`}>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand"><Search className="h-5 w-5" /></span>
                <p className="font-display mt-3 text-[16px] font-bold text-ink">No doctors match your filters</p>
                <p className="mt-1 text-sm text-ink-muted">Try a different search or department.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DEPARTMENTS ── */}
      {tab === "departments" && (
        <div id="departments-section">
          <h2 className="font-display mb-[18px] text-[24px] font-bold tracking-[-0.02em] text-ink">Medical departments</h2>
          {hospital.departments?.length ? (
            <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
              {hospital.departments.map((d) => {
                const { Icon, bg, fg } = deptVisual(d.name);
                const highlighted = d.id === highlightedDeptId;
                return (
                  <button key={d.id} onClick={() => { setSpecialty(d.name); switchTab("doctors"); }}
                    className={`${cardCls} group p-5 text-left transition-all hover:-translate-y-1 hover:shadow-[0_24px_44px_-24px_rgba(20,33,29,0.5)]`}
                    style={highlighted ? { borderColor: "#0C6B57", boxShadow: "0 0 0 2px #0C6B57" } : undefined}>
                    <div className="flex items-center justify-between">
                      <span className="flex h-12 w-12 items-center justify-center rounded-[14px]" style={{ background: bg, color: fg }}><Icon className="h-6 w-6" /></span>
                      <ChevronRight className="h-[18px] w-[18px] text-[#C4BFB4] transition-transform group-hover:translate-x-1" />
                    </div>
                    <div className="font-display mt-3.5 text-[17px] font-bold text-ink">{d.name}</div>
                    {d.overview && <div className="mt-1.5 line-clamp-2 text-[13px] leading-[1.5] text-ink-soft">{d.overview}</div>}
                    <div className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-muted"><Users className="h-3.5 w-3.5" />{d.doctorCount} specialists</div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={`${cardCls} flex flex-col items-center rounded-[18px] px-6 py-14 text-center`}>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand"><Building2 className="h-5 w-5" /></span>
              <p className="font-display mt-3 text-[16px] font-bold text-ink">No departments yet</p>
            </div>
          )}
        </div>
      )}

      {/* ── CONTACT ── */}
      {tab === "contact" && (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr] lg:items-start">
          <div className="flex flex-col gap-4">
            <div className={`${cardCls} p-[22px]`}>
              <div className="font-display mb-3.5 text-[16px] font-bold text-ink">Contact information</div>
              {[
                { label: "Phone", value: hospital.phone, Icon: Phone, bg: "#E6F0EC", fg: "#0C6B57", href: hospital.phone ? `tel:${hospital.phone}` : null },
                { label: "Email", value: hospital.email, Icon: Mail, bg: "#FAEBD9", fg: "#C0763A", href: hospital.email ? `mailto:${hospital.email}` : null },
                { label: "Website", value: hospital.website, Icon: Globe, bg: "#F0E9F4", fg: "#7A3E8E", href: hospital.website ?? null },
                { label: "Hours", value: hospital.openingHours, Icon: Clock, bg: "#E6EEF4", fg: "#3F6B8C", href: null },
              ].map((c, i, arr) => {
                const Icon = c.Icon;
                const inner = (
                  <>
                    <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px]" style={{ background: c.bg, color: c.fg }}><Icon className="h-[18px] w-[18px]" /></span>
                    <div className="min-w-0"><div className="text-[11px] font-semibold text-ink-muted">{c.label}</div><div className="truncate text-[13.5px] font-bold text-ink">{c.value || "Will be added soon"}</div></div>
                  </>
                );
                const style = { borderBottom: i < arr.length - 1 ? "1px solid rgba(20,33,29,.06)" : "none" };
                return c.href ? (
                  <a key={c.label} href={c.href} target={c.label === "Website" ? "_blank" : undefined} rel="noopener noreferrer" className="flex items-center gap-3 py-2.5" style={style}>{inner}</a>
                ) : (
                  <div key={c.label} className="flex items-center gap-3 py-2.5" style={style}>{inner}</div>
                );
              })}
            </div>
            <div className={`${cardCls} p-[22px]`}>
              <div className="font-display mb-2 text-[16px] font-bold text-ink">Address</div>
              <p className="text-[13.5px] leading-[1.6] text-ink-soft">
                {[hospital.location.addressLine, hospital.location.area, hospital.location.city, hospital.location.district, hospital.location.country, hospital.location.postalCode].filter(Boolean).join(", ") || "Will be added soon"}
              </p>
            </div>
          </div>

          <div className={`${cardCls} overflow-hidden`}>
            {hospital.location.lat != null && hospital.location.lng != null ? (
              <iframe
                src={`https://www.google.com/maps?q=${hospital.location.lat},${hospital.location.lng}&z=15&output=embed`}
                className="h-[380px] w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" title={`${hospital.name} location`}
              />
            ) : (
              <div className="relative h-[380px]" style={{ background: "linear-gradient(135deg,#DDE7E1,#C7D8CF)" }}>
                <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "linear-gradient(rgba(12,107,87,.18) 1px,transparent 1px),linear-gradient(90deg,rgba(12,107,87,.18) 1px,transparent 1px)", backgroundSize: "46px 46px" }} />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  <span className="relative block h-[18px] w-[18px]"><span className="ss-pulse absolute inset-0 rounded-full" style={{ background: "#C0556B" }} /><span className="absolute inset-0 rounded-full border-[3px] border-white" style={{ background: "#C0556B" }} /></span>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 p-5">
              <div className="text-[13px] text-ink-muted">{hospital.location.lat != null && hospital.location.lng != null ? `${hospital.location.lat.toFixed(4)}° N, ${hospital.location.lng.toFixed(4)}° E` : hospital.location.city}</div>
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([hospital.name, hospital.location.area, hospital.location.city].filter(Boolean).join(" "))}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 whitespace-nowrap rounded-[11px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-dark">
                <Navigation className="h-4 w-4" /> Get directions
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── booking modals ── */}
      {bookDoctor && (
        <AvailabilityModal
          doctor={bookDoctor}
          slots={doctorSlots}
          isOpen={!!bookDoctor}
          onCloseAction={() => setBookDoctor(null)}
          daysToShow={7}
          onBookAction={() => setBookDoctor(null)}
        />
      )}
      {bookPackage && (
        <BookingModal
          isOpen={!!bookPackage}
          onClose={() => setBookPackage(null)}
          hospitalName={hospital.name}
          hospitalId={hospital.id}
          selectedPackage={bookPackage}
          packageId={bookPackage.id}
        />
      )}
    </>
  );
}
