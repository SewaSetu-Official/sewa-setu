"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import {
  LayoutGrid, CalendarDays, Users, FileText, Settings as SettingsIcon,
  CheckCircle2, Clock, Mail, Phone,
  Pencil, Plus, ChevronRight, Navigation, XCircle,
  Heart, Trash2, MapPin, Building2,
} from "lucide-react";
import { BookingDetailPopup, type SerializedBooking } from "@/components/booking-detail-modal";
import { FamilyMemberModal, type FamilyMember } from "@/components/family-member-modal";
import { formatMoneyCents } from "@/lib/money";

type TabKey = "overview" | "appointments" | "saved" | "family" | "records" | "settings";

type ProfileUser = {
  fullName: string | null;
  imageUrl: string | null;
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  memberSince: string;
};

type SavedDoctor = {
  id: string;
  fullName: string;
  image: string | null;
  specialty: string;
  hospitalName: string | null;
  hospitalSlug: string | null;
  city: string | null;
  feeMin: number | null;
  currency: string | null;
};

type SavedHospital = {
  id: string;
  slug: string;
  name: string;
  type: string;
  image: string | null;
  city: string;
  district: string;
  fromPrice: number | null;
  currency: string;
};

type Props = {
  user: ProfileUser;
  bookings: SerializedBooking[];
  savedDoctors: SavedDoctor[];
  savedHospitals: SavedHospital[];
  familyMembers: FamilyMember[];
};

const GRAD = [
  "linear-gradient(140deg,#1C7A64,#0C6B57)",
  "linear-gradient(140deg,#9356A6,#7A3E8E)",
  "linear-gradient(140deg,#E89B47,#cf7f29)",
  "linear-gradient(140deg,#CF6E83,#C0556B)",
  "linear-gradient(140deg,#566B7A,#3C4742)",
];

function initials(name: string | null): string {
  if (!name) return "U";
  return name.trim().split(/\s+/).map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function appointmentDateTime(scheduledAt: string, slotTime: string | null): Date {
  const dt = new Date(scheduledAt);
  if (!slotTime) return dt;
  const start = slotTime.split("-")[0].trim();
  const [h, m = 0] = start.split(":").map(Number);
  if (Number.isFinite(h)) dt.setHours(h, m, 0, 0);
  return dt;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ageFromDob(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 ? age : null;
}

function fmtTime(scheduledAt: string, slotTime: string | null): string {
  if (slotTime) return slotTime.split("-")[0].trim();
  return new Date(scheduledAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const day = 86_400_000;
  if (diff < day && new Date(iso).toDateString() === new Date().toDateString())
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const days = Math.floor(diff / day);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusTone(status: string): { label: string; bg: string; fg: string } {
  const s = status.toUpperCase();
  if (s === "CONFIRMED") return { label: "Confirmed", bg: "#E6F0EC", fg: "#0C6B57" };
  if (s === "COMPLETED") return { label: "Completed", bg: "#F1EFE8", fg: "#7B857F" };
  if (s === "PENDING") return { label: "Pending", bg: "#FAEBD9", fg: "#C0763A" };
  if (s === "CANCELLED" || s === "CANCELED") return { label: "Cancelled", bg: "#FBEAEE", fg: "#C0556B" };
  if (s === "REFUNDED") return { label: "Refunded", bg: "#FBEAEE", fg: "#C0556B" };
  return { label: status, bg: "#F1EFE8", fg: "#7B857F" };
}

function mapsHref(b: SerializedBooking): string | null {
  const h = b.hospital;
  if (!h) return null;
  const loc = h.location;
  const q = [h.name, loc?.area, loc?.city].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

const card = "bg-white border border-[rgba(20,33,29,0.07)] rounded-[18px]";

export function ProfileClient({ user, bookings: initialBookings, savedDoctors, savedHospitals, familyMembers }: Props) {
  const [tab, setTab] = useState<TabKey>(() => {
    if (typeof window === "undefined") return "overview";
    const t = new URLSearchParams(window.location.search).get("tab");
    const valid: TabKey[] = ["overview", "appointments", "saved", "family", "records", "settings"];
    return valid.includes(t as TabKey) ? (t as TabKey) : "overview";
  });
  const [family, setFamily] = useState<FamilyMember[]>(familyMembers);
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const handleFamilySuccess = (m: FamilyMember) => {
    setFamily((prev) => (prev.some((x) => x.id === m.id) ? prev.map((x) => (x.id === m.id ? m : x)) : [...prev, m]));
    setShowFamilyModal(false);
    setEditingMember(null);
  };

  const removeFamilyMember = async (id: string) => {
    const prev = family;
    setFamily((p) => p.filter((m) => m.id !== id)); // optimistic
    setConfirmRemoveId(null);
    try {
      const res = await fetch(`/api/patients/${id}`, { method: "DELETE" });
      if (!res.ok) setFamily(prev); // revert (e.g. still has appointments)
    } catch {
      setFamily(prev);
    }
  };

  // The patient record that represents the account holder (created when booking for yourself).
  const isSelf = (m: FamilyMember) =>
    Boolean(user.fullName && m.fullName.trim().toLowerCase() === user.fullName.trim().toLowerCase());
  const [apptFilter, setApptFilter] = useState<"upcoming" | "past">("upcoming");
  const [saved, setSaved] = useState<SavedDoctor[]>(savedDoctors);
  const [savedH, setSavedH] = useState<SavedHospital[]>(savedHospitals);
  const [savedFilter, setSavedFilter] = useState<"doctors" | "hospitals">("doctors");

  const removeSaved = async (id: string) => {
    const prev = saved;
    setSaved((p) => p.filter((d) => d.id !== id)); // optimistic
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorId: id }),
      });
      if (!res.ok) setSaved(prev); // revert on failure
    } catch {
      setSaved(prev);
    }
  };

  const removeSavedHospital = async (id: string) => {
    const prev = savedH;
    setSavedH((p) => p.filter((h) => h.id !== id)); // optimistic
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hospitalId: id }),
      });
      if (!res.ok) setSavedH(prev); // revert on failure
    } catch {
      setSavedH(prev);
    }
  };
  const [toggles, setToggles] = useState([true, true, false]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Pick<SerializedBooking, "scheduledAt" | "slotTime" | "rescheduleCount">>>({});

  // Apply any in-session reschedule overrides on top of the server data.
  const bookings = useMemo(
    () => initialBookings.map((b) => ({ ...b, ...(overrides[b.id] ?? {}) })),
    [initialBookings, overrides]
  );
  const selected = useMemo(() => bookings.find((b) => b.id === selectedId) ?? null, [bookings, selectedId]);

  const handleReschedule = (id: string, newScheduledAt: string, newSlotTime: string) => {
    setOverrides((prev) => ({
      ...prev,
      [id]: {
        scheduledAt: newScheduledAt,
        slotTime: newSlotTime,
        rescheduleCount: (bookings.find((b) => b.id === id)?.rescheduleCount ?? 0) + 1,
      },
    }));
  };

  const [now] = useState(() => Date.now());
  const { upcoming, past } = useMemo(() => {
    const up: SerializedBooking[] = [];
    const pa: SerializedBooking[] = [];
    for (const b of bookings) {
      const when = appointmentDateTime(b.scheduledAt, b.slotTime).getTime();
      const cancelled = ["CANCELLED", "CANCELED", "REFUNDED"].includes(b.status.toUpperCase());
      if (when >= now && !cancelled) up.push(b);
      else pa.push(b);
    }
    up.sort((a, b) => appointmentDateTime(a.scheduledAt, a.slotTime).getTime() - appointmentDateTime(b.scheduledAt, b.slotTime).getTime());
    return { upcoming: up, past: pa };
  }, [bookings, now]);

  const nextAppt = upcoming[0] ?? null;
  const firstName = user.fullName?.trim().split(/\s+/)[0] ?? "there";

  const menu: { key: TabKey; label: string; icon: typeof LayoutGrid; badge?: string }[] = [
    { key: "overview", label: "Overview", icon: LayoutGrid },
    { key: "appointments", label: "Appointments", icon: CalendarDays, badge: upcoming.length ? String(upcoming.length) : undefined },
    { key: "saved", label: "Saved", icon: Heart, badge: saved.length + savedH.length ? String(saved.length + savedH.length) : undefined },
    { key: "family", label: "Family members", icon: Users },
    { key: "records", label: "Medical records", icon: FileText },
    { key: "settings", label: "Settings", icon: SettingsIcon },
  ];

  const stats = [
    { value: String(upcoming.length), label: "Upcoming visits", icon: CalendarDays, bg: "#E6F0EC", fg: "#0C6B57" },
    { value: String(family.length), label: "Family profiles", icon: Users, bg: "#FAEBD9", fg: "#C0763A" },
    { value: String(past.filter((b) => b.status.toUpperCase() === "COMPLETED").length), label: "Past consultations", icon: CheckCircle2, bg: "#F0E9F4", fg: "#7A3E8E" },
  ];

  const activity = bookings.slice(0, 4).map((b, i, arr) => {
    const who = b.doctor?.fullName ?? b.hospital?.name ?? "appointment";
    const s = b.status.toUpperCase();
    let title = `Appointment with ${who}`;
    let Icon = CheckCircle2;
    let bg = "#E6F0EC", fg = "#0C6B57";
    if (s === "CONFIRMED") title = `Appointment confirmed with ${who}`;
    else if (s === "COMPLETED") { title = `Visit completed with ${who}`; }
    else if (s === "PENDING") { title = `Appointment requested with ${who}`; Icon = Clock; bg = "#FAEBD9"; fg = "#C0763A"; }
    else if (s === "CANCELLED" || s === "CANCELED" || s === "REFUNDED") { title = `Appointment cancelled — ${who}`; Icon = XCircle; bg = "#FBEAEE"; fg = "#C0556B"; }
    return { title, time: relativeTime(b.createdAt ?? b.scheduledAt), Icon, bg, fg, last: i === arr.length - 1 };
  });

  return (
    <div className="mx-auto max-w-[1160px] px-5 pt-[92px] pb-14 sm:px-9">
      {/* Heading row */}
      <div className="mb-6 flex items-end justify-between gap-6">
        <div>
          <div className="text-[13.5px] font-semibold text-ink-muted">My account</div>
          <h1 className="font-display mt-1 text-[30px] font-bold leading-[1.1] tracking-[-0.025em] text-ink">
            Namaste, {firstName} 🙏
          </h1>
        </div>
        <Link
          href="/search"
          className="flex shrink-0 items-center gap-2 rounded-[11px] bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_-12px_rgba(12,107,87,0.8)] transition-all hover:-translate-y-0.5 hover:bg-brand-dark"
        >
          <Plus className="h-[15px] w-[15px]" />
          <span className="hidden sm:inline">New appointment</span>
          <span className="sm:hidden">Book</span>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr] lg:items-start">
        {/* ── LEFT RAIL ── */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-[92px]">
          {/* profile card */}
          <div className={`${card} rounded-[20px] p-[22px] text-center shadow-[0_18px_44px_-32px_rgba(20,33,29,0.6)]`}>
            <span className="mx-auto inline-block h-24 w-24 overflow-hidden rounded-full border-4 border-white shadow-[0_10px_24px_-12px_rgba(12,107,87,0.6),0_0_0_1px_rgba(20,33,29,0.06)]">
              {user.imageUrl ? (
                <Image loader={({ src }) => src} unoptimized src={user.imageUrl} alt={user.fullName ?? ""} width={96} height={96} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-brand text-2xl font-bold text-white" style={{ fontFamily: "var(--font-bricolage)" }}>{initials(user.fullName)}</span>
              )}
            </span>
            <div className="font-display mt-3.5 text-[19px] font-bold tracking-[-0.01em] text-ink">{user.fullName ?? "Your account"}</div>
            {user.emailVerified && (
              <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-[11.5px] font-bold text-brand">
                <CheckCircle2 className="h-3 w-3" /> Email verified
              </div>
            )}
            <div className="mt-4 flex flex-col gap-2.5 text-left">
              {user.email && (
                <div className="flex items-center gap-2.5 text-[13px] text-ink-soft">
                  <Mail className="h-[15px] w-[15px] shrink-0 text-ink-muted" /> <span className="truncate">{user.email}</span>
                </div>
              )}
              <div className="flex items-center gap-2.5 text-[13px] text-ink-soft">
                <Phone className="h-[15px] w-[15px] shrink-0 text-ink-muted" /> {user.phone ?? "No phone added"}
              </div>
            </div>
            <Link href="/profile/manage" className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-[11px] border border-[rgba(20,33,29,0.14)] bg-white py-2.5 text-[13.5px] font-bold text-ink transition-colors hover:bg-page">
              <Pencil className="h-3.5 w-3.5 text-ink-soft" /> Edit profile
            </Link>
          </div>

          {/* menu */}
          <div className={`${card} rounded-[18px] p-2`}>
            {menu.map((m) => {
              const active = tab === m.key;
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  onClick={() => setTab(m.key)}
                  className="flex w-full items-center gap-3 rounded-[11px] px-3.5 py-2.5 text-left text-sm transition-colors"
                  style={{ background: active ? "#0C6B57" : "transparent", color: active ? "#fff" : "#46524D", fontWeight: active ? 700 : 600 }}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="flex-1">{m.label}</span>
                  {m.badge && (
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: active ? "rgba(255,255,255,0.2)" : "#E6F0EC", color: active ? "#fff" : "#0C6B57" }}>
                      {m.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── MAIN ── */}
        <div>
          {/* OVERVIEW */}
          {tab === "overview" && (
            <div>
              <div className="grid grid-cols-3 gap-3.5">
                {stats.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className={`${card} rounded-[16px] p-4 sm:p-[18px]`}>
                      <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px]" style={{ background: s.bg, color: s.fg }}>
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <div className="font-display mt-3 text-[26px] font-bold tracking-[-0.02em] text-ink">{s.value}</div>
                      <div className="mt-0.5 text-[12.5px] font-semibold text-ink-muted">{s.label}</div>
                    </div>
                  );
                })}
              </div>

              {/* next appointment */}
              <div className="mb-3.5 mt-7 flex items-center justify-between px-0.5">
                <h2 className="font-display text-[19px] font-bold tracking-[-0.02em] text-ink">Next appointment</h2>
                <button onClick={() => setTab("appointments")} className="flex items-center gap-1 text-[13px] font-bold text-brand">
                  View all <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {nextAppt ? (
                <div className="relative overflow-hidden rounded-[20px] p-6 text-white" style={{ background: "linear-gradient(140deg,#14211D,#0a2620)" }}>
                  <div className="pointer-events-none absolute -right-8 -top-8 h-44 w-44 rounded-full" style={{ background: "radial-gradient(circle,rgba(12,107,87,.5),transparent 70%)" }} />
                  <div className="relative flex flex-wrap items-center gap-4">
                    <span className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-2xl text-[21px] font-bold text-white" style={{ background: "linear-gradient(140deg,#1C7A64,#0C6B57)", fontFamily: "var(--font-bricolage)" }}>
                      {initials(nextAppt.doctor?.fullName ?? nextAppt.hospital?.name ?? null)}
                    </span>
                    <div className="min-w-[160px] flex-1">
                      <div className="font-display text-[18px] font-bold">{nextAppt.doctor?.fullName ?? nextAppt.hospital?.name ?? "Appointment"}</div>
                      <div className="mt-0.5 text-[13px] text-[#9FB0AA]">
                        {[nextAppt.package?.title, nextAppt.hospital?.name && `${nextAppt.hospital.name}${nextAppt.hospital.location?.city ? `, ${nextAppt.hospital.location.city}` : ""}`].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <div className="flex gap-6">
                      <div>
                        <div className="text-[11px] font-semibold text-[#9FB0AA]">When</div>
                        <div className="mt-0.5 text-[14.5px] font-bold">{fmtDate(appointmentDateTime(nextAppt.scheduledAt, nextAppt.slotTime))} · {fmtTime(nextAppt.scheduledAt, nextAppt.slotTime)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold text-[#9FB0AA]">Status</div>
                        <div className="font-display mt-0.5 text-[16px] font-bold text-accent">{statusTone(nextAppt.status).label}</div>
                      </div>
                    </div>
                  </div>
                  <div className="relative mt-5 flex flex-wrap gap-2.5">
                    {mapsHref(nextAppt) && (
                      <a href={mapsHref(nextAppt)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-[11px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white">
                        <Navigation className="h-[15px] w-[15px]" /> Get directions
                      </a>
                    )}
                    <button type="button" onClick={() => setSelectedId(nextAppt.id)} className="rounded-[11px] border border-white/20 bg-white/[0.08] px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-white/[0.14]">Reschedule</button>
                    <button type="button" onClick={() => setSelectedId(nextAppt.id)} className="rounded-[11px] border border-white/20 bg-white/[0.08] px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-white/[0.14]">View details</button>
                  </div>
                </div>
              ) : (
                <div className={`${card} rounded-[20px] p-8 text-center`}>
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand"><CalendarDays className="h-5 w-5" /></span>
                  <p className="font-display mt-3 text-[16px] font-bold text-ink">No upcoming appointments</p>
                  <p className="mt-1 text-sm text-ink-muted">Book a visit and it’ll show up right here.</p>
                  <Link href="/search" className="mt-4 inline-flex rounded-[11px] bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark">Find care</Link>
                </div>
              )}

              {/* recent activity */}
              <h2 className="font-display mb-3.5 mt-7 px-0.5 text-[19px] font-bold tracking-[-0.02em] text-ink">Recent activity</h2>
              {activity.length ? (
                <div className={`${card} rounded-[18px] px-5`}>
                  {activity.map((a, i) => {
                    const Icon = a.Icon;
                    return (
                      <div key={i} className="flex items-center gap-3.5 py-3.5" style={{ borderBottom: a.last ? "none" : "1px solid rgba(20,33,29,.06)" }}>
                        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]" style={{ background: a.bg, color: a.fg }}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="flex-1">
                          <div className="text-[13.5px] font-semibold text-ink">{a.title}</div>
                          <div className="mt-px text-[12px] text-ink-muted">{a.time}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={`${card} rounded-[18px] p-6 text-center text-sm text-ink-muted`}>No activity yet.</div>
              )}
            </div>
          )}

          {/* APPOINTMENTS */}
          {tab === "appointments" && (
            <div>
              <div className="mb-[18px] flex gap-2">
                {([["upcoming", "Upcoming"], ["past", "Past"]] as const).map(([key, label]) => {
                  const active = apptFilter === key;
                  return (
                    <button key={key} onClick={() => setApptFilter(key)}
                      className="rounded-[10px] px-4 py-2.5 text-[13.5px] font-semibold transition-colors"
                      style={{ border: `1.5px solid ${active ? "#0C6B57" : "rgba(20,33,29,.14)"}`, background: active ? "#0C6B57" : "#fff", color: active ? "#fff" : "#46524D" }}>
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col gap-3.5">
                {(apptFilter === "upcoming" ? upcoming : past).map((b, i) => {
                  const tone = statusTone(b.status);
                  const isPast = apptFilter === "past";
                  const directions = mapsHref(b);
                  return (
                    <div key={b.id} className={`${card} flex flex-wrap items-center gap-4 rounded-[18px] p-5`}>
                      <span className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[15px] text-[18px] font-bold text-white" style={{ background: GRAD[i % GRAD.length], fontFamily: "var(--font-bricolage)" }}>
                        {initials(b.doctor?.fullName ?? b.hospital?.name ?? null)}
                      </span>
                      <div className="min-w-[170px] flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-[16px] font-bold text-ink">{b.doctor?.fullName ?? b.hospital?.name ?? "Appointment"}</span>
                          <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>
                        </div>
                        {b.package?.title && <div className="mt-1 text-[12.5px] font-semibold text-brand">{b.package.title}</div>}
                        {b.hospital?.name && <div className="mt-1 text-[12.5px] text-ink-muted">{b.hospital.name}{b.hospital.location?.city ? `, ${b.hospital.location.city}` : ""}</div>}
                        <div className="mt-2 flex flex-wrap items-center gap-3.5 text-[12.5px] font-semibold text-ink-soft">
                          <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-ink-muted" />{fmtDate(appointmentDateTime(b.scheduledAt, b.slotTime))}</span>
                          <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-ink-muted" />{fmtTime(b.scheduledAt, b.slotTime)}</span>
                          {b.patient?.fullName && <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-ink-muted" />For {b.patient.fullName}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col items-stretch gap-2">
                        {!isPast && directions && (
                          <a href={directions} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap rounded-[10px] bg-brand px-[18px] py-2.5 text-center text-[12.5px] font-semibold text-white">Get directions</a>
                        )}
                        {!isPast ? (
                          <button type="button" onClick={() => setSelectedId(b.id)} className="whitespace-nowrap rounded-[10px] border border-[rgba(20,33,29,0.14)] bg-white px-[18px] py-2.5 text-center text-[12.5px] font-semibold text-ink-soft transition-colors hover:bg-page">View details</button>
                        ) : (
                          <>
                            <button type="button" onClick={() => setSelectedId(b.id)} className="whitespace-nowrap rounded-[10px] border border-[rgba(20,33,29,0.14)] bg-white px-[18px] py-2.5 text-center text-[12.5px] font-semibold text-ink transition-colors hover:bg-page">View details</button>
                            {b.hospital?.slug && <Link href={`/hospital/${b.hospital.slug}`} className="whitespace-nowrap rounded-[10px] border border-[rgba(12,107,87,0.2)] bg-brand-soft px-[18px] py-2.5 text-center text-[12.5px] font-semibold text-brand">Book again</Link>}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                {(apptFilter === "upcoming" ? upcoming : past).length === 0 && (
                  <div className={`${card} rounded-[18px] p-10 text-center`}>
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand"><CalendarDays className="h-5 w-5" /></span>
                    <p className="font-display mt-3 text-[16px] font-bold text-ink">No {apptFilter} appointments</p>
                    <p className="mt-1 text-sm text-ink-muted">{apptFilter === "upcoming" ? "Book a visit to see it here." : "Your past visits will appear here."}</p>
                    {apptFilter === "upcoming" && <Link href="/search" className="mt-4 inline-flex rounded-[11px] bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark">Find care</Link>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SAVED — doctors & hospitals */}
          {tab === "saved" && (
            <div>
              {/* sub-toggle */}
              <div className="mb-[18px] flex gap-2">
                {([["doctors", "Doctors", saved.length], ["hospitals", "Hospitals", savedH.length]] as const).map(([key, label, n]) => {
                  const active = savedFilter === key;
                  return (
                    <button key={key} onClick={() => setSavedFilter(key)}
                      className="flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-[13.5px] font-semibold transition-colors"
                      style={{ border: `1.5px solid ${active ? "#0C6B57" : "rgba(20,33,29,.14)"}`, background: active ? "#0C6B57" : "#fff", color: active ? "#fff" : "#46524D" }}>
                      {label}
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: active ? "rgba(255,255,255,0.2)" : "#E6F0EC", color: active ? "#fff" : "#0C6B57" }}>{n}</span>
                    </button>
                  );
                })}
              </div>

              {/* DOCTORS */}
              {savedFilter === "doctors" && (saved.length ? (
                <div className="flex flex-col gap-3.5">
                  {saved.map((d, i) => (
                    <div key={d.id} className={`${card} flex flex-wrap items-center gap-4 rounded-[18px] p-5`}>
                      <span className="flex h-[54px] w-[54px] shrink-0 items-center justify-center overflow-hidden rounded-[15px] text-[18px] font-bold text-white" style={{ background: GRAD[i % GRAD.length], fontFamily: "var(--font-bricolage)" }}>
                        {d.image ? (
                          <Image loader={({ src }) => src} unoptimized src={d.image} alt={d.fullName} width={54} height={54} className="h-full w-full object-cover object-top" />
                        ) : initials(d.fullName)}
                      </span>
                      <div className="min-w-[170px] flex-1">
                        <div className="font-display text-[16px] font-bold text-ink">{d.fullName}</div>
                        <div className="mt-1 text-[12.5px] font-semibold text-brand">{d.specialty}</div>
                        {d.hospitalName && (
                          <div className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink-muted">
                            <MapPin className="h-3.5 w-3.5" />{d.hospitalName}{d.city ? `, ${d.city}` : ""}
                          </div>
                        )}
                        {d.feeMin != null && (
                          <div className="mt-1 text-[12.5px] text-ink-soft">Consultation <strong className="font-display text-[14px] text-ink">{formatMoneyCents(d.feeMin, d.currency ?? "EUR")}</strong></div>
                        )}
                      </div>
                      <div className="flex flex-col items-stretch gap-2">
                        <Link href={`/doctor/${d.id}`} className="whitespace-nowrap rounded-[10px] bg-brand px-[18px] py-2.5 text-center text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-dark">View profile</Link>
                        <button type="button" onClick={() => removeSaved(d.id)} className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border border-[rgba(192,85,107,0.3)] bg-[#FBEAEE] px-[18px] py-2.5 text-center text-[12.5px] font-semibold text-[#C0556B] transition-colors hover:bg-[#f7dde3]">
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`${card} flex flex-col items-center rounded-[18px] px-6 py-14 text-center`}>
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FBEAEE] text-[#C0556B]"><Heart className="h-6 w-6" /></span>
                  <p className="font-display mt-4 text-[17px] font-bold text-ink">No saved doctors yet</p>
                  <p className="mt-1.5 max-w-sm text-sm text-ink-muted">Tap the heart on any doctor’s profile to save them here for quick booking later.</p>
                  <Link href="/search" className="mt-4 inline-flex rounded-[11px] bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark">Browse doctors</Link>
                </div>
              ))}

              {/* HOSPITALS */}
              {savedFilter === "hospitals" && (savedH.length ? (
                <div className="flex flex-col gap-3.5">
                  {savedH.map((h, i) => (
                    <div key={h.id} className={`${card} flex flex-wrap items-center gap-4 rounded-[18px] p-5`}>
                      <span className="flex h-[54px] w-[54px] shrink-0 items-center justify-center overflow-hidden rounded-[15px] text-white" style={{ background: GRAD[i % GRAD.length], fontFamily: "var(--font-bricolage)" }}>
                        {h.image ? (
                          <Image loader={({ src }) => src} unoptimized src={h.image} alt={h.name} width={54} height={54} className="h-full w-full object-cover" />
                        ) : <Building2 className="h-6 w-6" />}
                      </span>
                      <div className="min-w-[170px] flex-1">
                        <div className="font-display text-[16px] font-bold text-ink">{h.name}</div>
                        <div className="mt-1 text-[12.5px] font-semibold capitalize text-brand">{h.type.toLowerCase()}</div>
                        <div className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink-muted">
                          <MapPin className="h-3.5 w-3.5" />{h.city}{h.district && h.district !== h.city ? `, ${h.district}` : ""}
                        </div>
                        {h.fromPrice != null && (
                          <div className="mt-1 text-[12.5px] text-ink-soft">From <strong className="font-display text-[14px] text-ink">{formatMoneyCents(h.fromPrice, h.currency)}</strong></div>
                        )}
                      </div>
                      <div className="flex flex-col items-stretch gap-2">
                        <Link href={`/hospital/${h.slug}`} className="whitespace-nowrap rounded-[10px] bg-brand px-[18px] py-2.5 text-center text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-dark">View hospital</Link>
                        <button type="button" onClick={() => removeSavedHospital(h.id)} className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border border-[rgba(192,85,107,0.3)] bg-[#FBEAEE] px-[18px] py-2.5 text-center text-[12.5px] font-semibold text-[#C0556B] transition-colors hover:bg-[#f7dde3]">
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`${card} flex flex-col items-center rounded-[18px] px-6 py-14 text-center`}>
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FBEAEE] text-[#C0556B]"><Heart className="h-6 w-6" /></span>
                  <p className="font-display mt-4 text-[17px] font-bold text-ink">No saved hospitals yet</p>
                  <p className="mt-1.5 max-w-sm text-sm text-ink-muted">Tap the heart on any hospital page to save it here for quick access.</p>
                  <Link href="/search" className="mt-4 inline-flex rounded-[11px] bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark">Browse hospitals</Link>
                </div>
              ))}
            </div>
          )}

          {/* FAMILY MEMBERS */}
          {tab === "family" && (
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-muted">Profiles for everyone you care for — book on their behalf without re-typing details.</p>
                {family.length > 0 && (
                  <button
                    onClick={() => { setEditingMember(null); setShowFamilyModal(true); }}
                    className="flex shrink-0 items-center gap-1.5 rounded-[11px] bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_-12px_rgba(12,107,87,0.8)] transition-colors hover:bg-brand-dark"
                  >
                    <Plus className="h-[15px] w-[15px]" /> Add member
                  </button>
                )}
              </div>

              {family.length ? (
                <div className="flex flex-col gap-3.5">
                  {family.map((m, i) => {
                    const age = ageFromDob(m.dateOfBirth);
                    const meta = [m.gender, age != null ? `${age} yrs` : null, m.phone].filter(Boolean).join(" · ");
                    return (
                      <div key={m.id} className={`${card} flex flex-wrap items-center gap-4 rounded-[18px] p-5`}>
                        <span className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[15px] text-[18px] font-bold text-white" style={{ background: GRAD[i % GRAD.length], fontFamily: "var(--font-bricolage)" }}>
                          {initials(m.fullName)}
                        </span>
                        <div className="min-w-[170px] flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-display text-[16px] font-bold text-ink">{m.fullName}</span>
                            {isSelf(m) && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10.5px] font-bold text-brand">You</span>}
                          </div>
                          {meta && <div className="mt-1 text-[12.5px] text-ink-soft">{meta}</div>}
                          {m.notes && <div className="mt-1 text-[12.5px] font-semibold text-brand">{m.notes}</div>}
                          {m.bookingCount > 0 && <div className="mt-1 text-[12px] text-ink-muted">{m.bookingCount} appointment{m.bookingCount !== 1 ? "s" : ""}</div>}
                        </div>

                        {isSelf(m) ? (
                          <div className="flex flex-col items-stretch gap-2">
                            <Link href="/profile/manage" className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border border-[rgba(20,33,29,0.14)] bg-white px-[18px] py-2.5 text-[12.5px] font-semibold text-ink transition-colors hover:bg-page">
                              <Pencil className="h-3.5 w-3.5" /> Edit profile
                            </Link>
                            <span className="text-center text-[11px] text-ink-muted">From your account</span>
                          </div>
                        ) : confirmRemoveId === m.id ? (
                          <div className="flex flex-col items-stretch gap-2">
                            <span className="text-center text-[12px] font-semibold text-ink-soft">Remove {m.fullName.split(" ")[0]}?</span>
                            {m.bookingCount > 0 && <span className="text-center text-[11px] text-ink-muted">Their appointments stay in your history.</span>}
                            <div className="flex gap-2">
                              <button type="button" onClick={() => setConfirmRemoveId(null)} className="rounded-[10px] border border-[rgba(20,33,29,0.14)] bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink-soft">Keep</button>
                              <button type="button" onClick={() => removeFamilyMember(m.id)} className="rounded-[10px] px-3.5 py-2 text-[12.5px] font-bold text-white" style={{ background: "#C0556B" }}>Remove</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-stretch gap-2">
                            <button type="button" onClick={() => { setEditingMember(m); setShowFamilyModal(true); }} className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border border-[rgba(20,33,29,0.14)] bg-white px-[18px] py-2.5 text-[12.5px] font-semibold text-ink transition-colors hover:bg-page">
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </button>
                            {(m.activeBookingCount ?? 0) > 0 ? (
                              <span className="text-center text-[11px] text-ink-muted">Upcoming appointment</span>
                            ) : (
                              <button type="button" onClick={() => setConfirmRemoveId(m.id)} className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border border-[rgba(192,85,107,0.3)] bg-[#FBEAEE] px-[18px] py-2.5 text-[12.5px] font-semibold text-[#C0556B] transition-colors hover:bg-[#f7dde3]">
                                <Trash2 className="h-3.5 w-3.5" /> Remove
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={`${card} flex flex-col items-center rounded-[18px] px-6 py-14 text-center`}>
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-[#C0763A]"><Users className="h-6 w-6" /></span>
                  <p className="font-display mt-4 text-[17px] font-bold text-ink">No family members yet</p>
                  <p className="mt-1.5 max-w-sm text-sm text-ink-muted">Add parents, children or dependents so you can book on their behalf in one tap.</p>
                  <button onClick={() => { setEditingMember(null); setShowFamilyModal(true); }} className="mt-4 inline-flex items-center gap-1.5 rounded-[11px] bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark">
                    <Plus className="h-[15px] w-[15px]" /> Add family member
                  </button>
                </div>
              )}
            </div>
          )}

          {/* RECORDS — no backend yet */}
          {tab === "records" && (
            <div>
              <p className="mb-4 text-sm text-ink-muted">Prescriptions, lab reports and visit summaries — all in one secure place.</p>
              <div className={`${card} flex flex-col items-center rounded-[18px] px-6 py-14 text-center`}>
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E6EEF4] text-[#3F6B8C]"><FileText className="h-6 w-6" /></span>
                <p className="font-display mt-4 text-[17px] font-bold text-ink">No medical records yet</p>
                <p className="mt-1.5 max-w-sm text-sm text-ink-muted">After your visits, prescriptions and lab reports shared by hospitals will show up here for download.</p>
              </div>
            </div>
          )}

          {/* SETTINGS */}
          {tab === "settings" && (
            <div className="flex flex-col gap-[18px]">
              <div className={`${card} rounded-[20px] p-6`}>
                <h2 className="font-display mb-[18px] text-[18px] font-bold tracking-[-0.02em] text-ink">Personal information</h2>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  {[
                    { label: "Full name", value: user.fullName ?? "" },
                    { label: "Phone", value: user.phone ?? "" },
                    { label: "Email", value: user.email ?? "" },
                    { label: "Member since", value: user.memberSince },
                  ].map((f) => (
                    <label key={f.label} className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-ink-soft">{f.label}</span>
                      <input value={f.value} readOnly className="w-full rounded-[11px] border border-[rgba(20,33,29,0.14)] bg-page px-3 py-2.5 text-[13.5px] text-ink outline-none" />
                    </label>
                  ))}
                </div>
                <Link href="/profile/manage" className="mt-[18px] inline-flex rounded-[11px] bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark">Manage account</Link>
              </div>

              <div className={`${card} rounded-[20px] p-6`}>
                <h2 className="font-display mb-1.5 text-[18px] font-bold tracking-[-0.02em] text-ink">Notifications</h2>
                {[
                  { title: "Appointment reminders", desc: "SMS & push before each visit" },
                  { title: "Live queue updates", desc: "Know exactly when to leave home" },
                  { title: "Health tips & offers", desc: "Occasional wellness content" },
                ].map((t, i, arr) => (
                  <button key={t.title} onClick={() => setToggles((p) => p.map((v, j) => (j === i ? !v : v)))}
                    className="flex w-full items-center justify-between py-3.5 text-left" style={{ borderBottom: i === arr.length - 1 ? "none" : "1px solid rgba(20,33,29,.06)" }}>
                    <div>
                      <div className="text-sm font-semibold text-ink">{t.title}</div>
                      <div className="mt-px text-[12.5px] text-ink-muted">{t.desc}</div>
                    </div>
                    <span className="relative h-6 w-[42px] shrink-0 rounded-full transition-colors" style={{ background: toggles[i] ? "#0C6B57" : "rgba(20,33,29,.16)" }}>
                      <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: toggles[i] ? "20px" : "2px" }} />
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/profile/manage" className="rounded-[11px] border border-[rgba(20,33,29,0.14)] bg-white px-[18px] py-2.5 text-[13.5px] font-semibold text-ink-soft">Privacy &amp; data</Link>
                <SignOutButton redirectUrl="/">
                  <button className="rounded-[11px] border border-[rgba(192,85,107,0.3)] bg-[#FBEAEE] px-[18px] py-2.5 text-[13.5px] font-semibold text-[#C0556B]">
                    Log out
                  </button>
                </SignOutButton>
              </div>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <BookingDetailPopup
          booking={selected}
          onClose={() => setSelectedId(null)}
          onReschedule={handleReschedule}
        />
      )}

      {showFamilyModal && (
        <FamilyMemberModal
          member={editingMember ?? undefined}
          onClose={() => { setShowFamilyModal(false); setEditingMember(null); }}
          onSuccess={handleFamilySuccess}
        />
      )}
    </div>
  );
}
