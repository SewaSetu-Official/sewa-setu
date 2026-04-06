"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useUser } from "@clerk/nextjs";
import { Input } from "@/components/ui/input";
import { X, ChevronLeft, ChevronRight, Package, Lock, AlertCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { UiPackage } from "@/types/package";
import { formatMoneyCents } from "@/lib/money";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  hospitalName: string;
  hospitalId?: string;
  selectedPackage: UiPackage;
  packageId?: string;
}

const TIME_SLOTS = ["09:00","10:00","11:00","13:00","14:00","15:00","16:00","17:00"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function pad2(n: number) { return String(n).padStart(2,"0"); }
function toDateKey(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function to12h(t: string) {
  const [h] = t.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return { h12, ampm };
}

function getFieldError(field: string, value: string): string {
  switch (field) {
    case "patientName": return value.trim().length < 2 ? "Please enter your full name" : "";
    case "patientAge": {
      const n = Number(value);
      return !value ? "Age is required" : (isNaN(n) || n < 1 || n > 120) ? "Enter a valid age (1–120)" : "";
    }
    case "patientPhone":
      return !/^\+?[\d\s\-()+]{7,15}$/.test(value) ? "Enter a valid phone number" : "";
    case "buyerEmail":
      return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? "Enter a valid email address" : "";
    default: return "";
  }
}

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 36 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -36 }),
};

export function BookingModal({ isOpen, onClose, hospitalName, hospitalId, selectedPackage, packageId }: BookingModalProps) {
  const { isSignedIn, user } = useUser();
  const [isMounted, setIsMounted] = useState(false);
  const [step, setStep] = useState<"schedule" | "details">("schedule");
  const [direction, setDirection] = useState(1);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
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
    d.setHours(0,0,0,0);
    return d;
  });

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    if (!isOpen) return;
    const email = user?.primaryEmailAddress?.emailAddress;
    if (email) setFormData(p => ({ ...p, buyerEmail: email }));
  }, [isOpen, user?.primaryEmailAddress?.emailAddress]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const weekDates = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(pageStart);
      d.setDate(pageStart.getDate() + i);
      days.push(d);
    }
    return days;
  }, [pageStart]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d;
  }, []);

  const canPrev = pageStart.getTime() > today.getTime();
  const canProceed = !!selectedDate && !!selectedTime;

  const errors = useMemo(() => ({
    patientName:  touched.patientName  ? getFieldError("patientName",  formData.patientName)  : "",
    patientAge:   touched.patientAge   ? getFieldError("patientAge",   formData.patientAge)   : "",
    patientPhone: touched.patientPhone ? getFieldError("patientPhone", formData.patientPhone) : "",
    buyerEmail:   touched.buyerEmail   ? getFieldError("buyerEmail",   formData.buyerEmail)   : "",
  }), [touched, formData]);

  const formValid =
    !getFieldError("patientName",  formData.patientName)  &&
    !getFieldError("patientAge",   formData.patientAge)   &&
    !getFieldError("patientPhone", formData.patientPhone) &&
    !getFieldError("buyerEmail",   formData.buyerEmail);

  const handleClose = () => {
    setStep("schedule");
    setDirection(1);
    setSelectedDate("");
    setSelectedTime("");
    setTouched({});
    setFormData({ patientName: "", patientAge: "", patientPhone: "", buyerEmail: "", patientGender: "", patientDisability: "none" });
    setIsLoading(false);
    setPageStart(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
    onClose();
  };

  const goToDetails = () => { if (!canProceed) return; setDirection(1); setStep("details"); };
  const goToSchedule = () => { setDirection(-1); setStep("schedule"); };
  const goPrev = () => setPageStart(d => new Date(d.getTime() - 7 * 86400000));
  const goNext = () => setPageStart(d => new Date(d.getTime() + 7 * 86400000));

  const weekLabel = (() => {
    const s = weekDates[0]; const e = weekDates[6];
    const fmt = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
    return `${fmt(s)} – ${fmt(e)}, ${e.getFullYear()}`;
  })();

  const handleBlur = (field: string) => setTouched(p => ({ ...p, [field]: true }));

  const handlePay = async () => {
    setTouched({ patientName: true, patientAge: true, patientPhone: true, buyerEmail: true });
    if (!formValid) return;
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
          packageId,
          hospitalId,
          patientName:  formData.patientName,
          patientAge:        formData.patientAge,
          patientPhone:      formData.patientPhone,
          buyerEmail:        formData.buyerEmail,
          patientGender:     formData.patientGender,
          patientDisability: formData.patientDisability,
          bookingDate:  new Date(selectedDate).toISOString(),
          slotTime:     selectedTime,
        }),
      });
      const data = await response.json();
      if (data.url) { window.location.href = data.url; }
      else { alert("Payment failed to initialize."); setIsLoading(false); }
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
      setIsLoading(false);
    }
  };

  if (!isOpen || !isMounted) return null;

  const selDateObj = selectedDate ? new Date(selectedDate + "T00:00:00") : null;
  const selDateDisplay = selDateObj
    ? `${DAYS[selDateObj.getDay()]}, ${selDateObj.getDate()} ${MONTHS[selDateObj.getMonth()]}`
    : "";
  const selTimeDisplay = selectedTime ? (() => {
    const { h12, ampm } = to12h(selectedTime);
    return `${h12}:00 ${ampm}`;
  })() : "";

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: "rgba(10,18,35,0.75)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="w-full flex flex-col overflow-hidden rounded-t-[24px] sm:rounded-[20px]"
        style={{
          maxWidth: 980,
          maxHeight: "95vh",
          background: "#fff",
          boxShadow: "0 32px 80px rgba(10,18,35,.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── HEADER ── */}
        <div
          className="flex-shrink-0 flex items-center gap-3 px-5 py-4"
          style={{
            background: "linear-gradient(135deg,#0f1e38 0%,#1a3059 100%)",
            borderBottom: "1px solid rgba(200,169,110,.18)",
          }}
        >
          {/* Step progress pills */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div
              className="h-1.5 rounded-full"
              style={{ width: 28, background: "#c8a96e", transition: "all .3s ease" }}
            />
            <div
              className="h-1.5 rounded-full"
              style={{
                width: step === "details" ? 28 : 8,
                background: step === "details" ? "#c8a96e" : "rgba(200,169,110,.3)",
                transition: "all .3s ease",
              }}
            />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white truncate">
              {step === "schedule" ? "Choose Date & Time" : "Confirm Your Booking"}
            </h2>
          </div>

          {/* Week nav — schedule step only */}
          {step === "schedule" && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={goPrev}
                disabled={!canPrev}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-30 hover:brightness-110"
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
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:brightness-110"
                style={{ background: "rgba(255,255,255,.1)", color: "#c8a96e", border: "1px solid rgba(200,169,110,.25)" }}
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Close */}
          <button
            onClick={handleClose}
            aria-label="Close booking modal"
            className="flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center transition-all hover:bg-white/15 hover:border-white/30"
            style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", color: "rgba(255,255,255,.7)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── ANIMATED BODY ── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ background: "#f5f3ef" }}>
          <AnimatePresence initial={false} mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            >

              {step === "schedule" ? (
                /* ── STEP 1: Date + Time ── */
                <div className="flex flex-col md:flex-row" style={{ minHeight: 420 }}>

                  {/* LEFT: Date grid */}
                  <div
                    className="w-full md:w-[55%] flex-shrink-0"
                    style={{
                      background: "#fff",
                      padding: "28px 28px 24px",
                      borderRight: "1px solid rgba(15,30,56,.07)",
                      borderBottom: "1px solid rgba(15,30,56,.07)",
                    }}
                  >
                    <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#c8a96e", marginBottom: 16 }}>
                      Select a Date
                    </p>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 4 }}>
                      {DAYS.map(d => (
                        <div key={d} style={{ textAlign: "center", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9aa3b0", padding: "4px 0" }}>
                          {d}
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
                      {weekDates.map((d) => {
                        const key = toDateKey(d);
                        const isToday = d.getTime() === today.getTime();
                        const isPast  = d.getTime() < today.getTime();
                        const isSel   = selectedDate === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            disabled={isPast}
                            onClick={() => setSelectedDate(key)}
                            style={{
                              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                              padding: 0, borderRadius: 10, height: 72, width: "100%",
                              border: isSel ? "2px solid #c8a96e" : isToday ? "2px solid rgba(200,169,110,.4)" : "2px solid rgba(15,30,56,.08)",
                              background: isSel ? "linear-gradient(135deg,#c8a96e 0%,#a88b50 100%)" : isToday ? "rgba(200,169,110,.08)" : "#fff",
                              cursor: isPast ? "not-allowed" : "pointer",
                              opacity: isPast ? 0.35 : 1,
                              transition: "all .14s ease",
                            }}
                          >
                            <span style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: isSel ? "rgba(255,255,255,.75)" : "#9aa3b0", marginBottom: 2 }}>
                              {MONTHS[d.getMonth()]}
                            </span>
                            <span style={{ fontSize: "1.45rem", fontWeight: 800, lineHeight: 1, color: isSel ? "#fff" : isToday ? "#c8a96e" : "#0f1e38" }}>
                              {d.getDate()}
                            </span>
                            <span style={{ fontSize: "0.52rem", fontWeight: 700, marginTop: 3, textTransform: "uppercase", letterSpacing: "0.06em", color: isSel ? "rgba(255,255,255,.8)" : "#c8a96e", visibility: isToday ? "visible" : "hidden" }}>
                              Today
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Mini summary */}
                    <div style={{ marginTop: 20, padding: "16px", borderRadius: 12, background: "#f5f3ef", border: "1.5px solid rgba(15,30,56,.08)" }}>
                      <p style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#c8a96e", marginBottom: 10 }}>
                        Your Selection
                      </p>
                      <p style={{ fontSize: "0.88rem", fontWeight: 700, color: "#0f1e38", marginBottom: 2, lineHeight: 1.3 }}>{selectedPackage.name}</p>
                      <p style={{ fontSize: "0.72rem", color: "#6b7a96", marginBottom: 12 }}>{hospitalName}</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {[
                          { label: "Date", value: selDateDisplay, active: !!selectedDate },
                          { label: "Time", value: selTimeDisplay, active: !!selectedTime },
                        ].map(({ label, value, active }) => (
                          <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "0.72rem", color: "#9aa3b0" }}>{label}</span>
                            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: active ? "#0f1e38" : "#c8c8c8" }}>{value || "—"}</span>
                          </div>
                        ))}
                        <div style={{ borderTop: "1px solid rgba(15,30,56,.07)", paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "0.72rem", color: "#9aa3b0" }}>Fee</span>
                          <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#c8a96e" }}>
                            {formatMoneyCents(selectedPackage.price, selectedPackage.currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: Time slots */}
                  <div className="flex-1" style={{ padding: "28px 24px 24px", background: "#f5f3ef" }}>
                    <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#c8a96e", marginBottom: 16 }}>
                      Select a Time
                    </p>

                    {!selectedDate ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 160, height: "calc(100% - 32px)", gap: 10 }}>
                        <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ background: "rgba(200,169,110,.1)", border: "1.5px solid rgba(200,169,110,.2)" }}>
                          <ChevronLeft className="h-5 w-5 -rotate-90" style={{ color: "#c8a96e" }} />
                        </div>
                        <p style={{ fontSize: "0.8rem", color: "#9aa3b0", fontWeight: 500, textAlign: "center" }}>Pick a date first</p>
                      </div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {TIME_SLOTS.map((t) => {
                          const { h12, ampm } = to12h(t);
                          const isSel = selectedTime === t;
                          const isToday = selectedDate === toDateKey(today);
                          const [slotHour] = t.split(":").map(Number);
                          const isExpired = isToday && slotHour <= new Date().getHours();
                          return (
                            <button
                              key={t}
                              type="button"
                              disabled={isExpired}
                              onClick={() => !isExpired && setSelectedTime(t)}
                              style={{
                                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                                padding: "12px 8px", borderRadius: 10,
                                border: isExpired ? "2px solid rgba(15,30,56,.06)" : isSel ? "2px solid #c8a96e" : "2px solid rgba(15,30,56,.1)",
                                background: isExpired ? "rgba(15,30,56,.03)" : isSel ? "linear-gradient(135deg,#c8a96e 0%,#a88b50 100%)" : "#fff",
                                cursor: isExpired ? "not-allowed" : "pointer",
                                opacity: isExpired ? 0.5 : 1,
                                transition: "all .14s ease",
                                boxShadow: isSel ? "0 4px 14px rgba(200,169,110,.3)" : "none",
                              }}
                            >
                              <span style={{ fontSize: "1rem", fontWeight: 800, color: isExpired ? "#b0b8c8" : isSel ? "#fff" : "#0f1e38", lineHeight: 1 }}>
                                {h12}:00
                              </span>
                              <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: isExpired ? "#b0b8c8" : isSel ? "rgba(255,255,255,.7)" : "#9aa3b0", marginTop: 3 }}>
                                {isExpired ? "Expired" : ampm}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

              ) : (
                /* ── STEP 2: Summary + Form ── */
                <div className="flex flex-col md:flex-row">

                  {/* LEFT: Booking summary */}
                  <div
                    className="w-full md:w-[38%] flex-shrink-0"
                    style={{
                      background: "linear-gradient(160deg,#0f1e38 0%,#1a3059 100%)",
                      padding: "32px 28px",
                      display: "flex", flexDirection: "column",
                      borderRight: "1px solid rgba(200,169,110,.15)",
                    }}
                  >
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: "rgba(200,169,110,.15)", border: "1.5px solid rgba(200,169,110,.3)",
                      display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
                    }}>
                      <Package className="h-5 w-5" style={{ color: "#c8a96e" }} />
                    </div>

                    <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(200,169,110,.65)", marginBottom: 6 }}>
                      Booking Summary
                    </p>
                    <p style={{ fontSize: "1.1rem", fontWeight: 800, color: "#fff", lineHeight: 1.3 }}>{selectedPackage.name}</p>
                    <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "#c8a96e", marginTop: 4, marginBottom: 20 }}>{hospitalName}</p>

                    {[
                      { label: "Date",  value: selDateDisplay },
                      { label: "Time",  value: selTimeDisplay },
                      { label: "Type",  value: "In-Person" },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid rgba(255,255,255,.07)" }}>
                        <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,.45)" }}>{label}</span>
                        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#fff" }}>{value}</span>
                      </div>
                    ))}

                    <div style={{ marginTop: 20, background: "rgba(200,169,110,.12)", border: "1.5px solid rgba(200,169,110,.35)", borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#c8a96e", marginBottom: 4 }}>
                          Package Fee
                        </p>
                        <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.35)" }}>One-time payment</p>
                      </div>
                      <span style={{ fontSize: "1.8rem", fontWeight: 800, color: "#c8a96e", lineHeight: 1 }}>
                        {formatMoneyCents(selectedPackage.price, selectedPackage.currency)}
                      </span>
                    </div>

                    <div className="hidden md:flex items-center gap-2 mt-auto pt-6">
                      <Lock className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "rgba(255,255,255,.3)" }} />
                      <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.3)", lineHeight: 1.5 }}>
                        Payments processed securely via Stripe. Card details are never stored.
                      </span>
                    </div>
                  </div>

                  {/* RIGHT: Form */}
                  <div className="flex-1" style={{ padding: "32px 36px", display: "flex", flexDirection: "column", background: "#f5f3ef" }}>
                    <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#c8a96e", marginBottom: 6 }}>
                      Step 2 of 2
                    </p>
                    <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#0f1e38", marginBottom: 24, lineHeight: 1.3 }}>
                      Your Details
                    </h3>

                    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 520 }}>

                      {/* Full Name */}
                      <div>
                        <label htmlFor="bm-name" style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#4a5568", marginBottom: 6 }}>
                          Full Name
                        </label>
                        <Input
                          id="bm-name"
                          value={formData.patientName}
                          onChange={(e) => setFormData(p => ({ ...p, patientName: e.target.value }))}
                          onBlur={() => handleBlur("patientName")}
                          placeholder="Your full name"
                          required
                          aria-invalid={!!errors.patientName}
                          style={{
                            background: "#fff",
                            border: `1.5px solid ${errors.patientName ? "#e53e3e" : "rgba(15,30,56,.14)"}`,
                            borderRadius: 10, height: 44, transition: "border-color .15s ease",
                          }}
                        />
                        {errors.patientName && (
                          <p className="flex items-center gap-1 mt-1.5" style={{ fontSize: "0.72rem", color: "#e53e3e" }}>
                            <AlertCircle className="h-3 w-3 flex-shrink-0" /> {errors.patientName}
                          </p>
                        )}
                      </div>

                      {/* Age + Phone */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div>
                          <label htmlFor="bm-age" style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#4a5568", marginBottom: 6 }}>Age</label>
                          <Input
                            id="bm-age"
                            type="number"
                            min={1} max={120}
                            value={formData.patientAge}
                            onChange={(e) => setFormData(p => ({ ...p, patientAge: e.target.value }))}
                            onBlur={() => handleBlur("patientAge")}
                            placeholder="30"
                            required
                            aria-invalid={!!errors.patientAge}
                            style={{
                              background: "#fff",
                              border: `1.5px solid ${errors.patientAge ? "#e53e3e" : "rgba(15,30,56,.14)"}`,
                              borderRadius: 10, height: 44,
                            }}
                          />
                          {errors.patientAge && (
                            <p className="flex items-center gap-1 mt-1.5" style={{ fontSize: "0.72rem", color: "#e53e3e" }}>
                              <AlertCircle className="h-3 w-3 flex-shrink-0" /> {errors.patientAge}
                            </p>
                          )}
                        </div>
                        <div>
                          <label htmlFor="bm-phone" style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#4a5568", marginBottom: 6 }}>Phone</label>
                          <Input
                            id="bm-phone"
                            value={formData.patientPhone}
                            onChange={(e) => setFormData(p => ({ ...p, patientPhone: e.target.value }))}
                            onBlur={() => handleBlur("patientPhone")}
                            placeholder="98XXXXXXXX"
                            required
                            aria-invalid={!!errors.patientPhone}
                            style={{
                              background: "#fff",
                              border: `1.5px solid ${errors.patientPhone ? "#e53e3e" : "rgba(15,30,56,.14)"}`,
                              borderRadius: 10, height: 44,
                            }}
                          />
                          {errors.patientPhone && (
                            <p className="flex items-center gap-1 mt-1.5" style={{ fontSize: "0.72rem", color: "#e53e3e" }}>
                              <AlertCircle className="h-3 w-3 flex-shrink-0" /> {errors.patientPhone}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Gender + Disability */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div>
                          <label htmlFor="bm-gender" style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#4a5568", marginBottom: 6 }}>Gender</label>
                          <select
                            id="bm-gender"
                            value={formData.patientGender}
                            onChange={(e) => setFormData(p => ({ ...p, patientGender: e.target.value }))}
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
                          <label htmlFor="bm-disability" style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#4a5568", marginBottom: 6 }}>Special Needs</label>
                          <select
                            id="bm-disability"
                            value={formData.patientDisability}
                            onChange={(e) => setFormData(p => ({ ...p, patientDisability: e.target.value }))}
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

                      {/* Email */}
                      <div>
                        <label htmlFor="bm-email" style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#4a5568", marginBottom: 6 }}>Email Address</label>
                        <Input
                          id="bm-email"
                          type="email"
                          value={formData.buyerEmail}
                          onChange={(e) => setFormData(p => ({ ...p, buyerEmail: e.target.value }))}
                          onBlur={() => handleBlur("buyerEmail")}
                          placeholder="you@example.com"
                          required
                          aria-invalid={!!errors.buyerEmail}
                          style={{
                            background: "#fff",
                            border: `1.5px solid ${errors.buyerEmail ? "#e53e3e" : "rgba(15,30,56,.14)"}`,
                            borderRadius: 10, height: 44,
                          }}
                        />
                        {errors.buyerEmail && (
                          <p className="flex items-center gap-1 mt-1.5" style={{ fontSize: "0.72rem", color: "#e53e3e" }}>
                            <AlertCircle className="h-3 w-3 flex-shrink-0" /> {errors.buyerEmail}
                          </p>
                        )}
                      </div>

                      {/* Pay button */}
                      <button
                        type="button"
                        onClick={handlePay}
                        disabled={isLoading || !formValid}
                        style={{
                          marginTop: 6,
                          width: "100%", height: 52, borderRadius: 12, border: "none",
                          cursor: isLoading || !formValid ? "not-allowed" : "pointer",
                          background: isLoading || !formValid
                            ? "#e8e4de"
                            : "linear-gradient(135deg,#c8a96e 0%,#a88b50 100%)",
                          color: isLoading || !formValid ? "#a0a8b4" : "#0f1e38",
                          fontSize: "0.95rem", fontWeight: 700, letterSpacing: "0.02em",
                          boxShadow: isLoading || !formValid ? "none" : "0 4px 18px rgba(200,169,110,.35)",
                          transition: "all .16s ease",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        }}
                      >
                        <Lock className="h-4 w-4" />
                        {isLoading ? "Processing…" : "Pay Securely"}
                      </button>

                      <p className="flex md:hidden items-center gap-1.5 justify-center" style={{ fontSize: "0.7rem", color: "#9aa3b0" }}>
                        <Lock className="h-3 w-3 flex-shrink-0" />
                        Secured by Stripe · Card details never stored
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── FOOTER ── */}
        <div
          className="flex-shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-5 py-4"
          style={{ borderTop: "1px solid rgba(15,30,56,.09)", background: "#fff" }}
        >
          {step === "schedule" ? (
            <>
              <div style={{ color: "#6b7a96" }}>
                {canProceed ? (
                  <div
                    className="flex items-center gap-2 flex-wrap"
                    style={{ background: "rgba(200,169,110,.08)", border: "1px solid rgba(200,169,110,.25)", borderRadius: 10, padding: "6px 12px" }}
                  >
                    <span style={{ fontSize: "0.65rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(200,169,110,.2)", color: "#a88b50", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Selected
                    </span>
                    <span className="font-semibold text-sm" style={{ color: "#0f1e38" }}>{selDateDisplay}</span>
                    <span style={{ color: "#9aa3b0" }}>·</span>
                    <span className="font-bold text-sm" style={{ color: "#a88b50" }}>{selTimeDisplay}</span>
                  </div>
                ) : (
                  <span className="text-slate-400 text-xs">Select a date and time to continue</span>
                )}
              </div>

              <div className="flex gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleClose}
                  className="transition-colors hover:bg-slate-50"
                  style={{ padding: "7px 18px", borderRadius: 8, border: "1.5px solid rgba(15,30,56,.18)", background: "#fff", color: "#0f1e38", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={goToDetails}
                  disabled={!canProceed}
                  style={{
                    padding: "7px 18px", borderRadius: 8, border: "none",
                    background: canProceed ? "#0f1e38" : "#d1d5db",
                    color: canProceed ? "#c8a96e" : "#9ca3af",
                    fontSize: "0.85rem", fontWeight: 700,
                    cursor: canProceed ? "pointer" : "not-allowed",
                    transition: "all .14s ease",
                  }}
                >
                  {canProceed ? "Continue →" : "Select Date & Time"}
                </button>
              </div>
            </>
          ) : (
            <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
              <button
                type="button"
                onClick={goToSchedule}
                className="flex items-center gap-2 transition-all hover:bg-slate-900 hover:text-[#c8a96e] hover:border-slate-900"
                style={{
                  padding: "10px 28px", borderRadius: 10,
                  border: "1.5px solid rgba(15,30,56,.18)",
                  background: "#fff", color: "#0f1e38",
                  fontSize: "0.9rem", fontWeight: 700, cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(15,30,56,.08)",
                }}
              >
                <ChevronLeft className="h-4 w-4" />
                Back to Schedule
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
