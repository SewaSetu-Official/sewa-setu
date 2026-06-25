"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Building2, Monitor, Lock, Calendar, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { ApiDoctor, ApiAvailabilitySlot } from "@/types/hospital";
import { formatMoneyCents } from "@/lib/money";
import {
  buildRollingOccurrences,
  formatDate,
  type WindowSlot,
  type Occurrence,
} from "@/lib/availability";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const BRAND_GRAD = "linear-gradient(140deg,#1C7A64,#0C6B57 55%,#0a5848)";

type BookingStep = "slots" | "details";

function normalizeSlotTime(value: string | null | undefined) {
  return value?.replace(/\s*-\s*/g, " - ").trim() ?? "";
}

function occurrenceKey(slotId: string, date: string, slotTime: string | null | undefined) {
  return `${slotId}::${date}::${normalizeSlotTime(slotTime)}`;
}

function initialsOf(name: string): string {
  return name.replace(/^(dr\.?|prof\.?)\s*/i, "").trim().split(/\s+/).map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "DR";
}

function createInitialFormData() {
  return {
    patientName: "",
    patientAge: "",
    patientPhone: "",
    buyerEmail: "",
    patientGender: "",
    patientDisability: "none",
  };
}

type Props = {
  doctor: ApiDoctor;
  slots: ApiAvailabilitySlot[]; // windows from DB
  isOpen: boolean;
  onCloseAction: () => void;

  // Not doing booking yet, but keep hook for future:
  onBookAction?: (occ: Occurrence) => void;
  daysToShow?: 3 | 4 | 7;
};

export function AvailabilityModal({
  isOpen,
  doctor,
  slots,
  onCloseAction,
  daysToShow = 7,
}: Props) {
  if (!isOpen || typeof document === "undefined") return null;

  return (
    <AvailabilityModalDialog
      key={doctor.id}
      doctor={doctor}
      slots={slots}
      isOpen={isOpen}
      onCloseAction={onCloseAction}
      daysToShow={daysToShow}
    />
  );
}

function AvailabilityModalDialog({
  doctor,
  slots,
  onCloseAction,
  daysToShow = 7,
}: Props) {
  // ✅ hooks must be unconditional
  const { isSignedIn } = useUser();
  const [selectedOcc, setSelectedOcc] = useState<Occurrence | null>(null);
  const [bookingStep, setBookingStep] = useState<BookingStep>("slots");
  const [isLoading, setIsLoading] = useState(false);
  // booked slot sets: keys are `${slotId}::${date}::${slotTime}`
  const [bookedSet, setBookedSet] = useState<Set<string>>(new Set());
  const [yourSet, setYourSet] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState(createInitialFormData);
  const [pageStart, setPageStart] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const close = () => {
    onCloseAction();
  };

  // Fetch booked slots for this doctor whenever modal opens or doctor changes
  useEffect(() => {
    fetch(`/api/availability/booked?doctorId=${doctor.id}`)
      .then((r) => r.json())
      .then((data: { booked?: { slotId: string; date: string; slotTime?: string | null; isYours: boolean }[] }) => {
        const booked = new Set<string>();
        const yours = new Set<string>();
        for (const b of data.booked ?? []) {
          const key = occurrenceKey(b.slotId, b.date, b.slotTime);
          booked.add(key);
          if (b.isYours) yours.add(key);
        }
        setBookedSet(booked);
        setYourSet(yours);
      })
      .catch(() => {/* fail silently, don't block UI */});
  }, [doctor.id]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseAction();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCloseAction]);

  // Convert API slot -> WindowSlot for availability.ts
  const windowSlots: WindowSlot[] = useMemo(() => {
    return slots.map((s) => ({
      id: s.id,
      doctorId: s.doctorId,
      hospitalId: s.hospitalId ?? null,
      mode: s.mode,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      slotDurationMinutes: s.slotDurationMinutes,
      isActive: s.isActive,
    }));
  }, [slots]);

  // Build rolling occurrences for doctor
  const rolling = useMemo(() => {
    return buildRollingOccurrences(windowSlots, pageStart, daysToShow, doctor.id);
  }, [windowSlots, pageStart, daysToShow, doctor.id]);

  const dateKeys = useMemo(() => rolling.dates.map((d) => formatDate(d)), [rolling.dates]);

  const hasAny = useMemo(() => {
    return dateKeys.some((k) => (rolling.occurrencesByDate[k]?.length ?? 0) > 0);
  }, [dateKeys, rolling.occurrencesByDate]);

  const goPrev = () => {
    const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
    if (pageStart.getTime() <= todayMidnight.getTime()) return;
    setPageStart((d) => new Date(d.getTime() - daysToShow * 24 * 60 * 60 * 1000));
  };
  const goNext = () => setPageStart((d) => new Date(d.getTime() + daysToShow * 24 * 60 * 60 * 1000));

  /* ── helpers ────────────────────────────────── */
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const primarySpec = doctor.specialties.find((s) => s.isPrimary) ?? doctor.specialties[0];
  const formValid = !!(formData.patientName && formData.patientAge && formData.patientPhone && formData.buyerEmail);

  const weekLabel = (() => {
    const start = rolling.dates[0];
    const end   = rolling.dates[rolling.dates.length - 1];
    if (!start || !end) return "";
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`;
  })();

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4"
      style={{ background: "rgba(20,33,29,0.5)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        className="flex w-full flex-col overflow-hidden"
        style={{
          maxWidth: 1200,
          maxHeight: "95vh",
          background: "#fff",
          borderRadius: 22,
          boxShadow: "0 40px 90px -30px rgba(0,0,0,.55)",
        }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── HEADER ─────────────────────────────────────────── */}
        <div
          className="flex flex-shrink-0 items-center gap-3.5 px-6 py-4"
          style={{ background: BRAND_GRAD }}
        >
          {/* doctor avatar */}
          <span
            className="flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-[13px] text-[16px] font-bold text-white"
            style={{ background: "rgba(255,255,255,.16)", border: "1.5px solid rgba(255,255,255,.28)", fontFamily: "var(--font-bricolage), sans-serif" }}
          >
            {initialsOf(doctor.fullName)}
          </span>

          {/* doctor info */}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,.72)" }}>
              {bookingStep === "slots" ? "Choose a time slot" : "Complete your booking"}
            </p>
            <h2 className="mt-0.5 truncate text-[17px] font-bold text-white" style={{ fontFamily: "var(--font-bricolage), sans-serif" }}>{doctor.fullName}</h2>
          </div>

          {/* week nav */}
          {bookingStep === "slots" && (
            <div className="flex flex-shrink-0 items-center gap-2">
              <button
                onClick={goPrev}
                disabled={pageStart <= today}
                className="flex items-center gap-1 rounded-[10px] px-3 py-1.5 text-xs font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-30"
                style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.25)" }}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <span
                className="hidden rounded-[10px] px-3 py-1.5 text-xs font-medium text-white sm:block"
                style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)" }}
              >
                {weekLabel}
              </span>
              <button
                onClick={goNext}
                className="flex items-center gap-1 rounded-[10px] px-3 py-1.5 text-xs font-semibold text-white transition-all"
                style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.25)" }}
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* close */}
          <button
            onClick={close}
            aria-label="Close"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white transition-all"
            style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.22)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#C0556B"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,.14)"; }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── BODY ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto" style={{ background: "#F6F4EE" }}>
          {bookingStep === "details" && selectedOcc ? (
            <div style={{ display: "flex", minHeight: "100%", height: "100%" }}>

              {/* ── LEFT: Summary panel (dark) ─────────────── */}
              <div
                className="hidden sm:flex"
                style={{
                  width: "38%",
                  flexShrink: 0,
                  background: "linear-gradient(160deg,#14211D,#0a2620)",
                  padding: "40px 36px",
                  flexDirection: "column",
                  gap: 0,
                }}
              >
                {/* doctor avatar */}
                <span
                  className="flex items-center justify-center text-[20px] font-bold text-white"
                  style={{
                    width: 56, height: 56, borderRadius: 16, marginBottom: 20,
                    background: "rgba(255,255,255,.1)", border: "1.5px solid rgba(255,255,255,.18)",
                    fontFamily: "var(--font-bricolage), sans-serif",
                  }}
                >
                  {initialsOf(doctor.fullName)}
                </span>

                <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#E0913A", marginBottom: 6 }}>
                  Booking summary
                </p>
                <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "#fff", lineHeight: 1.3, fontFamily: "var(--font-bricolage), sans-serif" }}>
                  {doctor.fullName}
                </p>
                {primarySpec ? (
                  <p style={{ fontSize: "0.88rem", fontWeight: 600, color: "#EBB36B", marginTop: 6, marginBottom: 28 }}>
                    {primarySpec.name}
                  </p>
                ) : <div style={{ marginBottom: 28 }} />}

                {/* detail rows */}
                {[
                  { label: "Mode",  value: selectedOcc.mode === "ONLINE" ? "Online" : "Physical" },
                  { label: "Date",  value: selectedOcc.date },
                  { label: "Time",  value: `${selectedOcc.startTime} – ${selectedOcc.endTime}` },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "13px 0",
                    borderBottom: "1px solid rgba(255,255,255,.08)",
                  }}>
                    <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,.5)" }}>{label}</span>
                    <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#fff" }}>{value}</span>
                  </div>
                ))}

                {/* fee highlight */}
                <div
                  style={{
                    marginTop: 28,
                    background: "rgba(224,145,58,.12)",
                    border: "1.5px solid rgba(224,145,58,.35)",
                    borderRadius: 14,
                    padding: "18px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#EBB36B", marginBottom: 4 }}>
                      Consultation fee
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,.4)" }}>One-time payment</p>
                  </div>
                  <span style={{ fontSize: "2.2rem", fontWeight: 700, color: "#E0913A", lineHeight: 1, fontFamily: "var(--font-bricolage), sans-serif" }}>
                    {doctor.feeMin != null ? formatMoneyCents(doctor.feeMin, doctor.currency ?? "EUR") : "—"}
                  </span>
                </div>

                {/* security note */}
                <div style={{ marginTop: "auto", paddingTop: 32, display: "flex", alignItems: "center", gap: 8 }}>
                  <Lock className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,.4)", flexShrink: 0 }} />
                  <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.4)", lineHeight: 1.5 }}>
                    Payments are processed securely via Stripe. Your card details are never stored.
                  </span>
                </div>
              </div>

              {/* ── RIGHT: Form ─────────────────────────────── */}
              <div style={{
                flex: 1,
                padding: "34px 40px",
                display: "flex",
                flexDirection: "column",
                background: "#fff",
              }}>
                <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#E0913A", marginBottom: 6 }}>
                  Step 2 of 2
                </p>
                <h3 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#14211D", marginBottom: 24, lineHeight: 1.3, fontFamily: "var(--font-bricolage), sans-serif", letterSpacing: "-0.02em" }}>
                  Your details
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 540 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#46524D", marginBottom: 6 }}>
                      Full name
                    </label>
                    <Input
                      value={formData.patientName}
                      onChange={(e) => setFormData(prev => ({ ...prev, patientName: e.target.value }))}
                      placeholder="Your full name"
                      required
                      style={{ background: "#fff", border: "1px solid rgba(20,33,29,.14)", borderRadius: 11, height: 44 }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#46524D", marginBottom: 6 }}>
                        Age
                      </label>
                      <Input
                        type="number"
                        value={formData.patientAge}
                        onChange={(e) => setFormData(prev => ({ ...prev, patientAge: e.target.value }))}
                        placeholder="30"
                        required
                        style={{ background: "#fff", border: "1px solid rgba(20,33,29,.14)", borderRadius: 11, height: 44 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#46524D", marginBottom: 6 }}>
                        Phone
                      </label>
                      <Input
                        value={formData.patientPhone}
                        onChange={(e) => setFormData(prev => ({ ...prev, patientPhone: e.target.value }))}
                        placeholder="98XXXXXXXX"
                        required
                        style={{ background: "#fff", border: "1px solid rgba(20,33,29,.14)", borderRadius: 11, height: 44 }}
                      />
                    </div>
                  </div>

                  {/* Gender + Special Needs */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#46524D", marginBottom: 6 }}>
                        Gender
                      </label>
                      <select
                        value={formData.patientGender}
                        onChange={(e) => setFormData(prev => ({ ...prev, patientGender: e.target.value }))}
                        style={{
                          width: "100%", height: 44, borderRadius: 11, padding: "0 12px",
                          border: "1px solid rgba(20,33,29,.14)",
                          background: "#fff", fontSize: "0.875rem", color: "#14211D",
                          outline: "none", cursor: "pointer",
                        }}
                      >
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#46524D", marginBottom: 6 }}>
                        Special needs
                      </label>
                      <select
                        value={formData.patientDisability}
                        onChange={(e) => setFormData(prev => ({ ...prev, patientDisability: e.target.value }))}
                        style={{
                          width: "100%", height: 44, borderRadius: 11, padding: "0 12px",
                          border: "1px solid rgba(20,33,29,.14)",
                          background: "#fff", fontSize: "0.875rem", color: "#14211D",
                          outline: "none", cursor: "pointer",
                        }}
                      >
                        <option value="none">None</option>
                        <option value="Visual impairment">Visual impairment</option>
                        <option value="Hearing impairment">Hearing impairment</option>
                        <option value="Mobility impairment">Mobility impairment</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#46524D", marginBottom: 6 }}>
                      Email address
                    </label>
                    <Input
                      type="email"
                      value={formData.buyerEmail}
                      onChange={(e) => setFormData(prev => ({ ...prev, buyerEmail: e.target.value }))}
                      placeholder="you@example.com"
                      required
                      style={{ background: "#fff", border: "1px solid rgba(20,33,29,.14)", borderRadius: 11, height: 44 }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : !hasAny ? (
            <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: "#E6F0EC", color: "#0C6B57" }}>
                <Calendar className="h-7 w-7" />
              </div>
              <p className="text-base font-bold" style={{ color: "#14211D", fontFamily: "var(--font-bricolage), sans-serif" }}>No availability scheduled</p>
              <p className="mt-1 text-sm" style={{ color: "#7B857F" }}>Try a different week using Prev / Next</p>
            </div>
          ) : (
            /* ── CALENDAR GRID ──────────────────────────────── */
            <div style={{ overflowX: "auto", overflowY: "hidden" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${daysToShow}, minmax(160px, 1fr))`,
                  gap: 0,
                  minWidth: daysToShow * 160,
                }}
              >
                {/* ── Day header row ── */}
                {rolling.dates.map((d) => {
                  const key = formatDate(d);
                  const occ = rolling.occurrencesByDate[key] ?? [];
                  const isToday = d.getTime() === today.getTime();
                  return (
                    <div
                      key={`hdr-${key}`}
                      style={{
                        padding: "18px 20px 14px",
                        borderBottom: `2px solid ${isToday ? "#0C6B57" : "rgba(20,33,29,.08)"}`,
                        borderRight: "1px solid rgba(20,33,29,.07)",
                        background: "#fff",
                      }}
                    >
                      <div className="flex items-end justify-between">
                        <div>
                          <p style={{
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            color: isToday ? "#0C6B57" : "#9AA39E",
                            marginBottom: 4,
                          }}>
                            {DAYS[d.getDay()]}
                          </p>
                          <p style={{
                            fontSize: "2rem",
                            fontWeight: 700,
                            lineHeight: 1,
                            color: isToday ? "#0C6B57" : "#14211D",
                            fontFamily: "var(--font-bricolage), sans-serif",
                          }}>
                            {d.getDate()}
                          </p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          {isToday && (
                            <span style={{
                              display: "inline-block",
                              fontSize: "0.62rem",
                              fontWeight: 700,
                              padding: "3px 8px",
                              borderRadius: 20,
                              background: "#E6F0EC",
                              color: "#0C6B57",
                              marginBottom: 4,
                              letterSpacing: "0.06em",
                              textTransform: "uppercase",
                            }}>
                              Today
                            </span>
                          )}
                          <p style={{
                            fontSize: "0.72rem",
                            color: "#9AA39E",
                          }}>
                            {occ.length} slot{occ.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* ── Slot columns ── */}
                {rolling.dates.map((d) => {
                  const key = formatDate(d);
                  const occ = rolling.occurrencesByDate[key] ?? [];
                  const isToday = d.getTime() === today.getTime();

                  return (
                    <div
                      key={`col-${key}`}
                      style={{
                        padding: "14px 12px",
                        borderRight: "1px solid rgba(20,33,29,.07)",
                        background: isToday ? "rgba(12,107,87,.04)" : "transparent",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        minHeight: 350,
                      }}
                    >
                      {occ.length === 0 ? (
                        <div style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#C4BFB4",
                          fontSize: "0.78rem",
                          gap: 6,
                          paddingTop: 20,
                        }}>
                          <span style={{ fontSize: "1.4rem", opacity: 0.6 }}>—</span>
                          <span>No slots</span>
                        </div>
                      ) : (
                        occ.map((o) => {
                          const isSel = selectedOcc?.date === o.date && selectedOcc?.startTime === o.startTime && selectedOcc?.mode === o.mode;
                          const isOnline = o.mode === "ONLINE";
                          const accent = isOnline ? "#E0913A" : "#0C6B57";
                          const accentSoft = isOnline ? "rgba(224,145,58,.28)" : "rgba(12,107,87,.28)";
                          const accentTint = isOnline ? "rgba(224,145,58,.1)" : "rgba(12,107,87,.09)";
                          const bookedKey = occurrenceKey(o.windowId, o.date, `${o.startTime}-${o.endTime}`);
                          const isBooked = bookedSet.has(bookedKey);
                          const isYours = yourSet.has(bookedKey);

                          // Check if slot is in the past
                          const isPastDay = d.getTime() < today.getTime();
                          const slotHour = parseInt(o.startTime.split(":")[0], 10);
                          const isExpiredToday = isToday && slotHour <= new Date().getHours();
                          const isExpired = isPastDay || isExpiredToday;

                          // Expired — past date or past time today
                          if (isExpired) {
                            return (
                              <div
                                key={`${o.date}-${o.startTime}-${o.mode}`}
                                style={{
                                  width: "100%",
                                  padding: "10px 12px",
                                  borderRadius: 10,
                                  textAlign: "left",
                                  border: "1.5px solid rgba(20,33,29,.07)",
                                  background: "rgba(20,33,29,.02)",
                                  opacity: 0.45,
                                }}
                              >
                                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#9AA39E", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                                  <Clock className="h-3 w-3" /><span>EXPIRED</span>
                                </div>
                                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#9AA39E", letterSpacing: "-0.01em", textDecoration: "line-through" }}>
                                  {o.startTime} – {o.endTime}
                                </div>
                              </div>
                            );
                          }

                          // Booked by current user — show "Your Booking" badge, not selectable
                          if (isYours) {
                            return (
                              <div
                                key={`${o.date}-${o.startTime}-${o.mode}`}
                                style={{
                                  width: "100%",
                                  padding: "10px 12px",
                                  borderRadius: 10,
                                  textAlign: "left",
                                  border: "2px solid #E0913A",
                                  background: "rgba(224,145,58,.1)",
                                  boxShadow: "0 2px 10px rgba(224,145,58,.18)",
                                }}
                              >
                                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#C0763A", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                                  <Check className="h-3 w-3" /><span>YOUR BOOKING</span>
                                </div>
                                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#14211D", letterSpacing: "-0.01em" }}>
                                  {o.startTime} – {o.endTime}
                                </div>
                              </div>
                            );
                          }

                          // Booked by someone else — show as unavailable
                          if (isBooked) {
                            return (
                              <div
                                key={`${o.date}-${o.startTime}-${o.mode}`}
                                style={{
                                  width: "100%",
                                  padding: "10px 12px",
                                  borderRadius: 10,
                                  textAlign: "left",
                                  border: "1.5px solid rgba(20,33,29,.1)",
                                  background: "rgba(20,33,29,.04)",
                                  opacity: 0.55,
                                }}
                              >
                                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#9AA39E", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                                  <X className="h-3 w-3" /><span>UNAVAILABLE</span>
                                </div>
                                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#9AA39E", letterSpacing: "-0.01em" }}>
                                  {o.startTime} – {o.endTime}
                                </div>
                              </div>
                            );
                          }

                          // Available — normal selectable button
                          return (
                            <button
                              key={`${o.date}-${o.startTime}-${o.mode}`}
                              onClick={() => setSelectedOcc(isSel ? null : o)}
                              style={{
                                width: "100%",
                                padding: "10px 12px",
                                borderRadius: 10,
                                cursor: "pointer",
                                transition: "all .15s ease",
                                textAlign: "left",
                                border: isSel ? `2px solid ${accent}` : `1.5px solid ${accentSoft}`,
                                background: isSel ? accentTint : "#fff",
                                boxShadow: isSel ? `0 3px 14px ${accentTint}` : "0 1px 4px rgba(20,33,29,.06)",
                              }}
                            >
                              <div style={{
                                fontSize: "0.7rem",
                                fontWeight: 600,
                                color: isOnline ? "#C0763A" : "#0C6B57",
                                marginBottom: 5,
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                              }}>
                                {isOnline ? <Monitor className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
                                <span>{isOnline ? "Online" : "Physical"}</span>
                              </div>
                              <div style={{
                                fontSize: "0.9rem",
                                fontWeight: 700,
                                color: "#14211D",
                                letterSpacing: "-0.01em",
                              }}>
                                {o.startTime} – {o.endTime}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER ─────────────────────────────────────────── */}
        <div
          className="flex flex-shrink-0 flex-col items-stretch justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center"
          style={{ borderTop: "1px solid rgba(20,33,29,.09)", background: "#fff" }}
        >
          {bookingStep === "slots" ? (
            <>
              <div className="text-sm" style={{ color: "#46524D" }}>
                {selectedOcc ? (
                  <div
                    className="flex flex-wrap items-center gap-2"
                    style={{ background: "#E6F0EC", border: "1px solid rgba(12,107,87,.25)", borderRadius: 10, padding: "6px 12px" }}
                  >
                    <span
                      style={{
                        fontSize: "0.65rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                        background: "rgba(12,107,87,.15)", color: "#0C6B57",
                        textTransform: "uppercase", letterSpacing: "0.06em",
                      }}
                    >
                      Selected
                    </span>
                    <span className="font-semibold" style={{ color: "#14211D" }}>{selectedOcc.date}</span>
                    <span style={{ color: "#9AA39E" }}>·</span>
                    <span className="font-bold" style={{ color: "#0C6B57" }}>{selectedOcc.startTime} – {selectedOcc.endTime}</span>
                    <span style={{ color: "#9AA39E" }}>·</span>
                    <span style={{ color: "#46524D" }}>{selectedOcc.mode === "ONLINE" ? "Online" : "Physical"}</span>
                  </div>
                ) : (
                  <span className="text-xs" style={{ color: "#9AA39E" }}>Select a time slot to continue</span>
                )}
              </div>

              <div className="flex flex-shrink-0 gap-2">
                <Button onClick={close} size="sm" variant="outline" className="rounded-[10px]">
                  Cancel
                </Button>
                <button
                  onClick={() => { if (selectedOcc) setBookingStep("details"); }}
                  disabled={!selectedOcc}
                  className="flex items-center gap-1.5 rounded-[10px] px-5 py-2 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed"
                  style={{ background: selectedOcc ? "#0C6B57" : "#9CB3AC" }}
                >
                  {selectedOcc ? "Continue" : "Select slot"}
                  {selectedOcc && <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setBookingStep("slots")}
                className="flex items-center justify-center gap-2 rounded-[11px] px-5 py-2.5 text-sm font-bold transition-all"
                style={{ border: "1.5px solid rgba(20,33,29,.14)", background: "#fff", color: "#14211D" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#F6F4EE"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}
              >
                <ChevronLeft className="h-4 w-4" />
                Back to time slots
              </button>

              <div className="flex items-center justify-end gap-3">
                <span className="hidden text-[11.5px] md:block" style={{ color: "#9AA39E" }}>
                  Free cancellation up to 2 hours before
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    if (!selectedOcc || !formData.patientName || !formData.patientAge || !formData.patientPhone || !formData.buyerEmail) return;
                    const slot = slots.find(s => s.id === selectedOcc.windowId);
                    if (!slot) { alert("Slot not found."); return; }
                    if (!isSignedIn) {
                      window.location.href = `/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`;
                      return;
                    }
                    setIsLoading(true);
                    try {
                      const response = await fetch("/api/checkout", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          doctorId: doctor.id,
                          patientName: formData.patientName,
                          patientAge: formData.patientAge,
                          patientPhone: formData.patientPhone,
                          buyerEmail: formData.buyerEmail,
                          patientGender: formData.patientGender,
                          patientDisability: formData.patientDisability,
                          consultationMode: selectedOcc.mode,
                          slotId: slot.id,
                          slotTime: `${selectedOcc.startTime}-${selectedOcc.endTime}`,
                          bookingDate: new Date(selectedOcc.date).toISOString(),
                          hospitalId: slot.hospitalId,
                        }),
                      });
                      const data = await response.json();
                      if (data.url) { window.location.href = data.url; }
                      else { alert("Booking failed to initialize."); setIsLoading(false); }
                    } catch (error) {
                      console.error(error);
                      alert("Something went wrong.");
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading || !formValid}
                  className="flex flex-1 items-center justify-center gap-2 rounded-[11px] px-6 py-2.5 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed sm:flex-none"
                  style={{ background: isLoading || !formValid ? "#9CB3AC" : "#0C6B57" }}
                >
                  <Lock className="h-4 w-4" />
                  {isLoading
                    ? "Processing…"
                    : `Pay ${doctor.feeMin != null ? formatMoneyCents(doctor.feeMin, doctor.currency ?? "EUR") : ""} securely`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
