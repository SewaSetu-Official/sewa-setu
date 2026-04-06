"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { ApiDoctor, ApiAvailabilitySlot } from "@/types/hospital";
import {
  buildRollingOccurrences,
  formatDate,
  type WindowSlot,
  type Occurrence,
} from "@/lib/availability";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type BookingStep = "slots" | "details";

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
  doctor,
  slots,
  isOpen,
  onCloseAction,
  onBookAction,
  daysToShow = 7,
}: Props) {
  // ✅ hooks must be unconditional
  const { isSignedIn } = useUser();
  const [isMounted, setIsMounted] = useState(false);
  const [selectedOcc, setSelectedOcc] = useState<Occurrence | null>(null);
  const [bookingStep, setBookingStep] = useState<BookingStep>("slots");
  const [isLoading, setIsLoading] = useState(false);
  // booked slot sets: keys are `${slotId}::${date}`
  const [bookedSet, setBookedSet] = useState<Set<string>>(new Set());
  const [yourSet, setYourSet] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    patientName: "",
    patientAge: "",
    patientPhone: "",
    buyerEmail: "",
    patientGender: "",
    patientDisability: "none",
  });
  const [pageStart, setPageStart] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Ensure we only render on client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Reset selection when closing or switching doctor
  useEffect(() => {
    if (!isOpen) setSelectedOcc(null);
  }, [isOpen]);

  useEffect(() => {
    setSelectedOcc(null);
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setPageStart(d);
  }, [doctor.id]);

  // Fetch booked slots for this doctor whenever modal opens or doctor changes
  useEffect(() => {
    if (!isOpen) return;
    fetch(`/api/availability/booked?doctorId=${doctor.id}`)
      .then((r) => r.json())
      .then((data: { booked?: { slotId: string; date: string; isYours: boolean }[] }) => {
        const booked = new Set<string>();
        const yours = new Set<string>();
        for (const b of data.booked ?? []) {
          const key = `${b.slotId}::${b.date}`;
          booked.add(key);
          if (b.isYours) yours.add(key);
        }
        setBookedSet(booked);
        setYourSet(yours);
      })
      .catch(() => {/* fail silently, don't block UI */});
  }, [isOpen, doctor.id]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

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

  const close = () => {
    setSelectedOcc(null);
    setBookingStep("slots");
    setFormData({
      patientName: "",
      patientAge: "",
      patientPhone: "",
      buyerEmail: "",
      patientGender: "",
      patientDisability: "none",
    });
    onCloseAction();
  };

  const goPrev = () => setPageStart((d) => new Date(d.getTime() - daysToShow * 24 * 60 * 60 * 1000));
  const goNext = () => setPageStart((d) => new Date(d.getTime() + daysToShow * 24 * 60 * 60 * 1000));

  // ✅ render conditional AFTER hooks
  if (!isOpen || !isMounted) return null;

  /* ── helpers ────────────────────────────────── */
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
      style={{ background: "rgba(10,18,35,0.72)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        className="w-full flex flex-col overflow-hidden"
        style={{
          maxWidth: 1290,
          maxHeight: "95vh",
          background: "#fff",
          borderRadius: 20,
          boxShadow: "0 32px 80px rgba(10,18,35,.45)",
        }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── HEADER ─────────────────────────────────────────── */}
        <div
          className="flex-shrink-0 flex items-center gap-3 px-6 py-4"
          style={{
            background: "linear-gradient(135deg,#0f1e38 0%,#1a3059 100%)",
            borderBottom: "1px solid rgba(200,169,110,.18)",
          }}
        >
          {/* doctor info */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium tracking-widest uppercase" style={{ color: "#c8a96e", letterSpacing: "0.12em" }}>
              {bookingStep === "slots" ? "Choose a Time Slot" : "Complete Your Booking"}
            </p>
            <h2 className="text-lg font-bold text-white truncate mt-0.5">{doctor.fullName}</h2>
          </div>

          {/* week nav */}
          {bookingStep === "slots" && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={goPrev}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                style={{ background: "rgba(255,255,255,.1)", color: "#c8a96e", border: "1px solid rgba(200,169,110,.25)" }}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <span
                className="text-xs font-medium px-3 py-1.5 rounded-lg hidden sm:block"
                style={{ background: "rgba(200,169,110,.12)", color: "#c8a96e", border: "1px solid rgba(200,169,110,.2)" }}
              >
                {weekLabel}
              </span>
              <button
                onClick={goNext}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                style={{ background: "rgba(255,255,255,.1)", color: "#c8a96e", border: "1px solid rgba(200,169,110,.25)" }}
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* close */}
          <button
            onClick={close}
            aria-label="Close"
            className="flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center transition-all"
            style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", color: "rgba(255,255,255,.7)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#e53e3e"; (e.currentTarget as HTMLButtonElement).style.color = "#fff"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,.08)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,.7)"; }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── BODY ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto" style={{ background: "#f5f3ef" }}>
          {bookingStep === "details" && selectedOcc ? (
            <div style={{ display: "flex", minHeight: "100%", height: "100%" }}>

              {/* ── LEFT: Summary panel ─────────────────────── */}
              <div
                style={{
                  width: "38%",
                  flexShrink: 0,
                  background: "linear-gradient(160deg,#0f1e38 0%,#1a3059 100%)",
                  padding: "40px 36px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 0,
                  borderRight: "1px solid rgba(200,169,110,.15)",
                }}
              >
                {/* doctor avatar placeholder */}
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: "rgba(200,169,110,.15)",
                  border: "1.5px solid rgba(200,169,110,.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.5rem", marginBottom: 20,
                }}>
                  🩺
                </div>

                <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(200,169,110,.65)", marginBottom: 6 }}>
                  Booking Summary
                </p>
                <p style={{ fontSize: "1.25rem", fontWeight: 800, color: "#fff", lineHeight: 1.3 }}>
                  {doctor.fullName}
                </p>
                {(() => {
                  const spec = doctor.specialties.find(s => s.isPrimary) ?? doctor.specialties[0];
                  return spec ? (
                    <p style={{ fontSize: "0.88rem", fontWeight: 600, color: "#c8a96e", marginTop: 6, marginBottom: 28 }}>
                      {spec.name}
                    </p>
                  ) : <div style={{ marginBottom: 28 }} />;
                })()}

                {/* detail rows */}
                {[
                  { label: "Mode",  value: selectedOcc.mode === "ONLINE" ? "🌐  Online" : "🏥  Physical" },
                  { label: "Date",  value: selectedOcc.date },
                  { label: "Time",  value: `${selectedOcc.startTime} – ${selectedOcc.endTime}` },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "13px 0",
                    borderBottom: "1px solid rgba(255,255,255,.07)",
                  }}>
                    <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,.45)" }}>{label}</span>
                    <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#fff" }}>{value}</span>
                  </div>
                ))}

                {/* fee highlight */}
                <div
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.background = "rgba(200,169,110,.2)";
                    el.style.borderColor = "#c8a96e";
                    el.style.transform = "translateY(-2px)";
                    el.style.boxShadow = "0 8px 28px rgba(200,169,110,.22)";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.background = "rgba(200,169,110,.12)";
                    el.style.borderColor = "rgba(200,169,110,.35)";
                    el.style.transform = "translateY(0)";
                    el.style.boxShadow = "none";
                  }}
                  style={{
                    marginTop: 28,
                    background: "rgba(200,169,110,.12)",
                    border: "1.5px solid rgba(200,169,110,.35)",
                    borderRadius: 14,
                    padding: "18px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "default",
                    transition: "all .2s ease",
                  }}
                >
                  <div>
                    <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#c8a96e", marginBottom: 4 }}>
                      Consultation Fee
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,.35)" }}>One-time payment</p>
                  </div>
                  <span style={{ fontSize: "2.4rem", fontWeight: 800, color: "#c8a96e", lineHeight: 1 }}>
                    {doctor.feeMin != null ? `€${Math.round(doctor.feeMin / 100)}` : "—"}
                  </span>
                </div>

                {/* security note */}
                <div style={{ marginTop: "auto", paddingTop: 32, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "0.9rem" }}>🔒</span>
                  <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.3)", lineHeight: 1.5 }}>
                    Payments are processed securely via Stripe. Your card details are never stored.
                  </span>
                </div>
              </div>

              {/* ── RIGHT: Form ─────────────────────────────── */}
              <div style={{
                flex: 1,
                padding: "40px 44px",
                display: "flex",
                flexDirection: "column",
                background: "#f5f3ef",
              }}>
                <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#c8a96e", marginBottom: 6 }}>
                  Step 2 of 2
                </p>
                <h3 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f1e38", marginBottom: 28, lineHeight: 1.3 }}>
                  Your Details
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 520 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#4a5568", marginBottom: 6 }}>
                      Full Name
                    </label>
                    <Input
                      value={formData.patientName}
                      onChange={(e) => setFormData(prev => ({ ...prev, patientName: e.target.value }))}
                      placeholder="Your full name"
                      required
                      style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.14)", borderRadius: 10, height: 44 }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#4a5568", marginBottom: 6 }}>
                        Age
                      </label>
                      <Input
                        type="number"
                        value={formData.patientAge}
                        onChange={(e) => setFormData(prev => ({ ...prev, patientAge: e.target.value }))}
                        placeholder="30"
                        required
                        style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.14)", borderRadius: 10, height: 44 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#4a5568", marginBottom: 6 }}>
                        Phone
                      </label>
                      <Input
                        value={formData.patientPhone}
                        onChange={(e) => setFormData(prev => ({ ...prev, patientPhone: e.target.value }))}
                        placeholder="98XXXXXXXX"
                        required
                        style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.14)", borderRadius: 10, height: 44 }}
                      />
                    </div>
                  </div>

                  {/* Gender + Special Needs */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#4a5568", marginBottom: 6 }}>
                        Gender
                      </label>
                      <select
                        value={formData.patientGender}
                        onChange={(e) => setFormData(prev => ({ ...prev, patientGender: e.target.value }))}
                        style={{
                          width: "100%", height: 44, borderRadius: 10, padding: "0 12px",
                          border: "1.5px solid rgba(15,30,56,.14)",
                          background: "#fff", fontSize: "0.875rem", color: "#0f1e38",
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
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#4a5568", marginBottom: 6 }}>
                        Special Needs
                      </label>
                      <select
                        value={formData.patientDisability}
                        onChange={(e) => setFormData(prev => ({ ...prev, patientDisability: e.target.value }))}
                        style={{
                          width: "100%", height: 44, borderRadius: 10, padding: "0 12px",
                          border: "1.5px solid rgba(15,30,56,.14)",
                          background: "#fff", fontSize: "0.875rem", color: "#0f1e38",
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
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#4a5568", marginBottom: 6 }}>
                      Email Address
                    </label>
                    <Input
                      type="email"
                      value={formData.buyerEmail}
                      onChange={(e) => setFormData(prev => ({ ...prev, buyerEmail: e.target.value }))}
                      placeholder="you@example.com"
                      required
                      style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.14)", borderRadius: 10, height: 44 }}
                    />
                  </div>

                  {/* Pay button */}
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
                    disabled={isLoading || !formData.patientName || !formData.patientAge || !formData.patientPhone || !formData.buyerEmail}
                    style={{
                      marginTop: 8,
                      width: "100%",
                      padding: "13px 24px",
                      borderRadius: 10,
                      border: "none",
                      cursor: isLoading || !formData.patientName || !formData.patientAge || !formData.patientPhone || !formData.buyerEmail ? "not-allowed" : "pointer",
                      background: isLoading || !formData.patientName || !formData.patientAge || !formData.patientPhone || !formData.buyerEmail
                        ? "#e8e4de"
                        : "linear-gradient(135deg,#0f1e38 0%,#1a3059 100%)",
                      color: isLoading || !formData.patientName || !formData.patientAge || !formData.patientPhone || !formData.buyerEmail
                        ? "#a0a8b4"
                        : "#c8a96e",
                      fontSize: "0.9rem",
                      fontWeight: 700,
                      letterSpacing: "0.02em",
                      boxShadow: isLoading || !formData.patientName || !formData.patientAge || !formData.patientPhone || !formData.buyerEmail
                        ? "none"
                        : "0 4px 18px rgba(15,30,56,.25)",
                      transition: "all .16s ease",
                    }}
                  >
                    {isLoading ? "Processing…" : "🔒  Pay Securely"}
                  </button>
                </div>
              </div>
            </div>
          ) : !hasAny ? (
            <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: "rgba(15,30,56,.07)" }}
              >
                <span className="text-3xl">📅</span>
              </div>
              <p className="text-base font-semibold" style={{ color: "#0f1e38" }}>No availability scheduled</p>
              <p className="text-sm mt-1" style={{ color: "#6b7a96" }}>Try a different week using Prev / Next</p>
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
                        borderBottom: `2px solid ${isToday ? "#c8a96e" : "rgba(15,30,56,.08)"}`,
                        borderRight: "1px solid rgba(15,30,56,.07)",
                        background: isToday
                          ? "linear-gradient(160deg,#0f1e38 0%,#1a3059 100%)"
                          : "#fff",
                      }}
                    >
                      <div className="flex items-end justify-between">
                        <div>
                          <p style={{
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            color: isToday ? "rgba(200,169,110,.7)" : "#9aa3b0",
                            marginBottom: 4,
                          }}>
                            {DAYS[d.getDay()]}
                          </p>
                          <p style={{
                            fontSize: "2rem",
                            fontWeight: 800,
                            lineHeight: 1,
                            color: isToday ? "#c8a96e" : "#0f1e38",
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
                              background: "rgba(200,169,110,.22)",
                              color: "#c8a96e",
                              marginBottom: 4,
                              letterSpacing: "0.06em",
                              textTransform: "uppercase",
                            }}>
                              Today
                            </span>
                          )}
                          <p style={{
                            fontSize: "0.72rem",
                            color: isToday ? "rgba(255,255,255,.4)" : "#b0b8c6",
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
                        borderRight: "1px solid rgba(15,30,56,.07)",
                        background: isToday ? "rgba(200,169,110,.03)" : "transparent",
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
                          color: "#d0d5de",
                          fontSize: "0.78rem",
                          gap: 6,
                          paddingTop: 20,
                        }}>
                          <span style={{ fontSize: "1.4rem", opacity: 0.5 }}>—</span>
                          <span>No slots</span>
                        </div>
                      ) : (
                        occ.map((o) => {
                          const isSel = selectedOcc?.date === o.date && selectedOcc?.startTime === o.startTime && selectedOcc?.mode === o.mode;
                          const isOnline = o.mode === "ONLINE";
                          const bookedKey = `${o.windowId}::${o.date}`;
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
                                  border: "1.5px solid rgba(15,30,56,.07)",
                                  background: "rgba(15,30,56,.02)",
                                  opacity: 0.45,
                                }}
                              >
                                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#b0b8c8", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                                  <span>⏰</span><span>EXPIRED</span>
                                </div>
                                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#b0b8c8", letterSpacing: "-0.01em", textDecoration: "line-through" }}>
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
                                  border: "2px solid #c8a96e",
                                  background: "linear-gradient(135deg,rgba(200,169,110,.13),rgba(200,169,110,.06))",
                                  boxShadow: "0 2px 10px rgba(200,169,110,.18)",
                                }}
                              >
                                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#c8a96e", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                                  <span>✓</span><span>YOUR BOOKING</span>
                                </div>
                                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0f1e38", letterSpacing: "-0.01em" }}>
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
                                  border: "1.5px solid rgba(15,30,56,.1)",
                                  background: "rgba(15,30,56,.04)",
                                  opacity: 0.55,
                                }}
                              >
                                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#9aa3b0", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                                  <span>✕</span><span>UNAVAILABLE</span>
                                </div>
                                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#9aa3b0", letterSpacing: "-0.01em" }}>
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
                                border: isSel
                                  ? `2px solid ${isOnline ? "#c8a96e" : "#10b981"}`
                                  : `1.5px solid ${isOnline ? "rgba(200,169,110,.28)" : "rgba(16,185,129,.25)"}`,
                                background: isSel
                                  ? isOnline ? "rgba(200,169,110,.11)" : "rgba(16,185,129,.09)"
                                  : "#fff",
                                boxShadow: isSel
                                  ? `0 3px 14px ${isOnline ? "rgba(200,169,110,.2)" : "rgba(16,185,129,.18)"}`
                                  : "0 1px 4px rgba(15,30,56,.06)",
                              }}
                            >
                              <div style={{
                                fontSize: "0.7rem",
                                fontWeight: 600,
                                color: isOnline ? "#a88b50" : "#059669",
                                marginBottom: 5,
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}>
                                <span>{isOnline ? "🌐" : "🏥"}</span>
                                <span>{isOnline ? "Online" : "Physical"}</span>
                              </div>
                              <div style={{
                                fontSize: "0.9rem",
                                fontWeight: 700,
                                color: "#0f1e38",
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
          className="flex-shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-5 py-4"
          style={{
            borderTop: "1px solid rgba(15,30,56,.09)",
            background: "#fff",
          }}
        >
          {bookingStep === "slots" ? (
            <>
              <div className="text-sm" style={{ color: "#6b7a96" }}>
                {selectedOcc ? (
                  <div
                    className="flex items-center gap-2 flex-wrap"
                    style={{
                      background: "rgba(200,169,110,.08)",
                      border: "1px solid rgba(200,169,110,.25)",
                      borderRadius: 10,
                      padding: "6px 12px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 20,
                        background: "rgba(200,169,110,.2)",
                        color: "#a88b50",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      Selected
                    </span>
                    <span className="font-semibold" style={{ color: "#0f1e38" }}>{selectedOcc.date}</span>
                    <span style={{ color: "#9aa3b0" }}>·</span>
                    <span className="font-bold" style={{ color: "#a88b50" }}>{selectedOcc.startTime} – {selectedOcc.endTime}</span>
                    <span style={{ color: "#9aa3b0" }}>·</span>
                    <span style={{ color: "#6b7a96" }}>{selectedOcc.mode === "ONLINE" ? "🌐 Online" : "🏥 Physical"}</span>
                  </div>
                ) : (
                  <span className="text-slate-400 text-xs">Select a time slot to continue</span>
                )}
              </div>

              <div className="flex gap-2 flex-shrink-0">
                <Button
                  onClick={close}
                  size="sm"
                  variant="outline"
                  className="rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => { if (selectedOcc) setBookingStep("details"); }}
                  size="sm"
                  className="rounded-lg font-semibold"
                  style={selectedOcc
                    ? { background: "#0f1e38", color: "#c8a96e" }
                    : { background: "#0f1e38", color: "#c8a96e", opacity: 0.45, cursor: "not-allowed" }
                  }
                  disabled={!selectedOcc}
                >
                  {selectedOcc ? "Continue →" : "Select Slot"}
                </Button>
              </div>
            </>
          ) : (
            <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => setBookingStep("slots")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 28px",
                  borderRadius: 10,
                  border: "1.5px solid rgba(15,30,56,.18)",
                  background: "#fff",
                  color: "#0f1e38",
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(15,30,56,.08)",
                  transition: "all .15s ease",
                  letterSpacing: "0.01em",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "#0f1e38";
                  (e.currentTarget as HTMLButtonElement).style.color = "#c8a96e";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#0f1e38";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "#fff";
                  (e.currentTarget as HTMLButtonElement).style.color = "#0f1e38";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(15,30,56,.18)";
                }}
              >
                <ChevronLeft className="h-4 w-4" />
                Back to Time Slots
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}