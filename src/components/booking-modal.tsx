"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useUser } from "@clerk/nextjs";
import { Input } from "@/components/ui/input";
import { X, ChevronLeft, ChevronRight, Package, Lock, AlertCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { UiPackage } from "@/types/package";
import { formatMoneyCents } from "@/lib/money";
import { FamilyMemberPicker } from "@/components/family-member-picker";

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

const BRAND_GRAD = "linear-gradient(140deg,#1C7A64,#0C6B57 55%,#0a5848)";
const SELECT_GRAD = "linear-gradient(135deg,#0C6B57,#0A5446)";

function createInitialFormData(prefilledBuyerEmail = "") {
  return {
    patientName: "",
    patientAge: "",
    patientPhone: "",
    buyerEmail: prefilledBuyerEmail,
    patientGender: "",
    patientDisability: "none",
  };
}

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
  if (!isOpen || typeof document === "undefined") return null;

  return (
    <BookingModalDialog
      key={`${hospitalId ?? hospitalName}:${packageId ?? selectedPackage.id}`}
      isOpen={isOpen}
      onClose={onClose}
      hospitalName={hospitalName}
      hospitalId={hospitalId}
      selectedPackage={selectedPackage}
      packageId={packageId}
    />
  );
}

function BookingModalDialog({ onClose, hospitalName, hospitalId, selectedPackage, packageId }: BookingModalProps) {
  const { isSignedIn, user } = useUser();
  const signedInEmail = user?.primaryEmailAddress?.emailAddress ?? "";
  const [step, setStep] = useState<"schedule" | "details">("schedule");
  const [direction, setDirection] = useState(1);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState(() => createInitialFormData(signedInEmail));
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [pageStart, setPageStart] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0,0,0,0);
    return d;
  });
  const buyerEmail = formData.buyerEmail || signedInEmail;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

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
    buyerEmail:   touched.buyerEmail   ? getFieldError("buyerEmail",   buyerEmail)   : "",
  }), [buyerEmail, touched, formData]);

  const formValid =
    !getFieldError("patientName",  formData.patientName)  &&
    !getFieldError("patientAge",   formData.patientAge)   &&
    !getFieldError("patientPhone", formData.patientPhone) &&
    !getFieldError("buyerEmail",   buyerEmail);

  const handleClose = () => {
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
          buyerEmail,
          patientGender:     formData.patientGender,
          patientDisability: formData.patientDisability,
          bookingDate:  `${selectedDate}T00:00:00.000Z`,
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
      style={{ background: "rgba(20,33,29,0.5)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="w-full flex flex-col overflow-hidden rounded-t-[24px] sm:rounded-[22px]"
        style={{
          maxWidth: 980,
          maxHeight: "95vh",
          background: "#fff",
          boxShadow: "0 40px 90px -30px rgba(0,0,0,.55)",
        }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── HEADER ── */}
        <div
          className="flex-shrink-0 flex items-center gap-3 px-5 py-4"
          style={{ background: BRAND_GRAD }}
        >
          {/* Step progress pills */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="h-1.5 rounded-full" style={{ width: 28, background: "#fff", transition: "all .3s ease" }} />
            <div
              className="h-1.5 rounded-full"
              style={{
                width: step === "details" ? 28 : 8,
                background: step === "details" ? "#fff" : "rgba(255,255,255,.35)",
                transition: "all .3s ease",
              }}
            />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white truncate" style={{ fontFamily: "var(--font-bricolage), sans-serif" }}>
              {step === "schedule" ? "Choose date & time" : "Confirm your booking"}
            </h2>
          </div>

          {/* Week nav — schedule step only */}
          {step === "schedule" && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={goPrev}
                disabled={!canPrev}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-all disabled:opacity-30 hover:brightness-110"
                style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.25)" }}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <span
                className="text-xs font-medium px-3 py-1.5 rounded-lg hidden text-white sm:block"
                style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)" }}
              >
                {weekLabel}
              </span>
              <button
                onClick={goNext}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-all hover:brightness-110"
                style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.25)" }}
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Close */}
          <button
            onClick={handleClose}
            aria-label="Close booking modal"
            className="flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-white transition-all"
            style={{ background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.22)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#C0556B"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.14)"; }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── ANIMATED BODY ── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ background: "#F6F4EE" }}>
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
                      borderRight: "1px solid rgba(20,33,29,.07)",
                      borderBottom: "1px solid rgba(20,33,29,.07)",
                    }}
                  >
                    <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#C0763A", marginBottom: 16 }}>
                      Select a date
                    </p>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 4 }}>
                      {DAYS.map(d => (
                        <div key={d} style={{ textAlign: "center", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9AA39E", padding: "4px 0" }}>
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
                              border: isSel ? "2px solid #0C6B57" : isToday ? "2px solid rgba(12,107,87,.4)" : "2px solid rgba(20,33,29,.08)",
                              background: isSel ? SELECT_GRAD : isToday ? "rgba(12,107,87,.06)" : "#fff",
                              cursor: isPast ? "not-allowed" : "pointer",
                              opacity: isPast ? 0.35 : 1,
                              transition: "all .14s ease",
                            }}
                          >
                            <span style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: isSel ? "rgba(255,255,255,.75)" : "#9AA39E", marginBottom: 2 }}>
                              {MONTHS[d.getMonth()]}
                            </span>
                            <span style={{ fontSize: "1.45rem", fontWeight: 800, lineHeight: 1, color: isSel ? "#fff" : isToday ? "#0C6B57" : "#14211D" }}>
                              {d.getDate()}
                            </span>
                            <span style={{ fontSize: "0.52rem", fontWeight: 700, marginTop: 3, textTransform: "uppercase", letterSpacing: "0.06em", color: isSel ? "rgba(255,255,255,.8)" : "#0C6B57", visibility: isToday ? "visible" : "hidden" }}>
                              Today
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Mini summary */}
                    <div style={{ marginTop: 20, padding: "16px", borderRadius: 12, background: "#F6F4EE", border: "1.5px solid rgba(20,33,29,.08)" }}>
                      <p style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#C0763A", marginBottom: 10 }}>
                        Your selection
                      </p>
                      <p style={{ fontSize: "0.88rem", fontWeight: 700, color: "#14211D", marginBottom: 2, lineHeight: 1.3 }}>{selectedPackage.name}</p>
                      <p style={{ fontSize: "0.72rem", color: "#7B857F", marginBottom: 12 }}>{hospitalName}</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {[
                          { label: "Date", value: selDateDisplay, active: !!selectedDate },
                          { label: "Time", value: selTimeDisplay, active: !!selectedTime },
                        ].map(({ label, value, active }) => (
                          <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "0.72rem", color: "#9AA39E" }}>{label}</span>
                            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: active ? "#14211D" : "#C4BFB4" }}>{value || "—"}</span>
                          </div>
                        ))}
                        <div style={{ borderTop: "1px solid rgba(20,33,29,.08)", paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "0.72rem", color: "#9AA39E" }}>Fee</span>
                          <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#0C6B57" }}>
                            {formatMoneyCents(selectedPackage.price, selectedPackage.currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: Time slots */}
                  <div className="flex-1" style={{ padding: "28px 24px 24px", background: "#F6F4EE" }}>
                    <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#C0763A", marginBottom: 16 }}>
                      Select a time
                    </p>

                    {!selectedDate ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 160, height: "calc(100% - 32px)", gap: 10 }}>
                        <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ background: "#E6F0EC" }}>
                          <ChevronLeft className="h-5 w-5 -rotate-90" style={{ color: "#0C6B57" }} />
                        </div>
                        <p style={{ fontSize: "0.8rem", color: "#9AA39E", fontWeight: 500, textAlign: "center" }}>Pick a date first</p>
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
                                border: isExpired ? "2px solid rgba(20,33,29,.06)" : isSel ? "2px solid #0C6B57" : "2px solid rgba(20,33,29,.1)",
                                background: isExpired ? "rgba(20,33,29,.03)" : isSel ? SELECT_GRAD : "#fff",
                                cursor: isExpired ? "not-allowed" : "pointer",
                                opacity: isExpired ? 0.5 : 1,
                                transition: "all .14s ease",
                                boxShadow: isSel ? "0 4px 14px rgba(12,107,87,.25)" : "none",
                              }}
                            >
                              <span style={{ fontSize: "1rem", fontWeight: 800, color: isExpired ? "#9AA39E" : isSel ? "#fff" : "#14211D", lineHeight: 1 }}>
                                {h12}:00
                              </span>
                              <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: isExpired ? "#9AA39E" : isSel ? "rgba(255,255,255,.7)" : "#9AA39E", marginTop: 3 }}>
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

                  {/* LEFT: Booking summary (dark) */}
                  <div
                    className="w-full md:w-[38%] flex-shrink-0"
                    style={{
                      background: "linear-gradient(160deg,#14211D,#0a2620)",
                      padding: "32px 28px",
                      display: "flex", flexDirection: "column",
                    }}
                  >
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: "rgba(255,255,255,.1)", border: "1.5px solid rgba(255,255,255,.18)",
                      display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
                    }}>
                      <Package className="h-5 w-5" style={{ color: "#E0913A" }} />
                    </div>

                    <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#E0913A", marginBottom: 6 }}>
                      Booking summary
                    </p>
                    <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", lineHeight: 1.3, fontFamily: "var(--font-bricolage), sans-serif" }}>{selectedPackage.name}</p>
                    <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "#EBB36B", marginTop: 4, marginBottom: 20 }}>{hospitalName}</p>

                    {[
                      { label: "Date",  value: selDateDisplay },
                      { label: "Time",  value: selTimeDisplay },
                      { label: "Type",  value: "In-person" },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                        <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,.5)" }}>{label}</span>
                        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#fff" }}>{value}</span>
                      </div>
                    ))}

                    <div style={{ marginTop: 20, background: "rgba(224,145,58,.12)", border: "1.5px solid rgba(224,145,58,.35)", borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#EBB36B", marginBottom: 4 }}>
                          Package fee
                        </p>
                        <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.4)" }}>One-time payment</p>
                      </div>
                      <span style={{ fontSize: "1.8rem", fontWeight: 700, color: "#E0913A", lineHeight: 1, fontFamily: "var(--font-bricolage), sans-serif" }}>
                        {formatMoneyCents(selectedPackage.price, selectedPackage.currency)}
                      </span>
                    </div>

                    <div className="hidden md:flex items-center gap-2 mt-auto pt-6">
                      <Lock className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "rgba(255,255,255,.4)" }} />
                      <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.4)", lineHeight: 1.5 }}>
                        Payments processed securely via Stripe. Card details are never stored.
                      </span>
                    </div>
                  </div>

                  {/* RIGHT: Form */}
                  <div className="flex-1" style={{ padding: "32px 36px", display: "flex", flexDirection: "column", background: "#fff" }}>
                    <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#E0913A", marginBottom: 6 }}>
                      Step 2 of 2
                    </p>
                    <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#14211D", marginBottom: 24, lineHeight: 1.3, fontFamily: "var(--font-bricolage), sans-serif", letterSpacing: "-0.02em" }}>
                      Your details
                    </h3>

                    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 520 }}>

                      {/* Quick-pick a saved family member to prefill the form */}
                      <FamilyMemberPicker
                        activeId={selectedMemberId}
                        onSelect={(m, pre) => {
                          setSelectedMemberId(m.id);
                          setFormData(p => ({ ...p, patientName: pre.fullName, patientAge: pre.age, patientPhone: pre.phone, patientGender: pre.gender }));
                        }}
                      />

                      {/* Full Name */}
                      <div>
                        <label htmlFor="bm-name" style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#46524D", marginBottom: 6 }}>
                          Full name
                        </label>
                        <Input
                          id="bm-name"
                          value={formData.patientName}
                          onChange={(e) => { setSelectedMemberId(null); setFormData(p => ({ ...p, patientName: e.target.value })); }}
                          onBlur={() => handleBlur("patientName")}
                          placeholder="Your full name"
                          required
                          aria-invalid={!!errors.patientName}
                          style={{
                            background: "#fff",
                            border: `1.5px solid ${errors.patientName ? "#C0556B" : "rgba(20,33,29,.14)"}`,
                            borderRadius: 11, height: 44, transition: "border-color .15s ease",
                          }}
                        />
                        {errors.patientName && (
                          <p className="flex items-center gap-1 mt-1.5" style={{ fontSize: "0.72rem", color: "#C0556B" }}>
                            <AlertCircle className="h-3 w-3 flex-shrink-0" /> {errors.patientName}
                          </p>
                        )}
                      </div>

                      {/* Age + Phone */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div>
                          <label htmlFor="bm-age" style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#46524D", marginBottom: 6 }}>Age</label>
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
                              border: `1.5px solid ${errors.patientAge ? "#C0556B" : "rgba(20,33,29,.14)"}`,
                              borderRadius: 11, height: 44,
                            }}
                          />
                          {errors.patientAge && (
                            <p className="flex items-center gap-1 mt-1.5" style={{ fontSize: "0.72rem", color: "#C0556B" }}>
                              <AlertCircle className="h-3 w-3 flex-shrink-0" /> {errors.patientAge}
                            </p>
                          )}
                        </div>
                        <div>
                          <label htmlFor="bm-phone" style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#46524D", marginBottom: 6 }}>Phone</label>
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
                              border: `1.5px solid ${errors.patientPhone ? "#C0556B" : "rgba(20,33,29,.14)"}`,
                              borderRadius: 11, height: 44,
                            }}
                          />
                          {errors.patientPhone && (
                            <p className="flex items-center gap-1 mt-1.5" style={{ fontSize: "0.72rem", color: "#C0556B" }}>
                              <AlertCircle className="h-3 w-3 flex-shrink-0" /> {errors.patientPhone}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Gender + Disability */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div>
                          <label htmlFor="bm-gender" style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#46524D", marginBottom: 6 }}>Gender</label>
                          <select
                            id="bm-gender"
                            value={formData.patientGender}
                            onChange={(e) => setFormData(p => ({ ...p, patientGender: e.target.value }))}
                            style={{
                              width: "100%", height: 44, borderRadius: 11, padding: "0 12px",
                              border: "1.5px solid rgba(20,33,29,.14)",
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
                          <label htmlFor="bm-disability" style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#46524D", marginBottom: 6 }}>Special needs</label>
                          <select
                            id="bm-disability"
                            value={formData.patientDisability}
                            onChange={(e) => setFormData(p => ({ ...p, patientDisability: e.target.value }))}
                            style={{
                              width: "100%", height: 44, borderRadius: 11, padding: "0 12px",
                              border: "1.5px solid rgba(20,33,29,.14)",
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

                      {/* Email */}
                      <div>
                        <label htmlFor="bm-email" style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#46524D", marginBottom: 6 }}>Email address</label>
                        <Input
                          id="bm-email"
                          type="email"
                          value={buyerEmail}
                          onChange={(e) => setFormData(p => ({ ...p, buyerEmail: e.target.value }))}
                          onBlur={() => handleBlur("buyerEmail")}
                          placeholder="you@example.com"
                          required
                          aria-invalid={!!errors.buyerEmail}
                          style={{
                            background: "#fff",
                            border: `1.5px solid ${errors.buyerEmail ? "#C0556B" : "rgba(20,33,29,.14)"}`,
                            borderRadius: 11, height: 44,
                          }}
                        />
                        {errors.buyerEmail && (
                          <p className="flex items-center gap-1 mt-1.5" style={{ fontSize: "0.72rem", color: "#C0556B" }}>
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
                          width: "100%", height: 52, borderRadius: 13, border: "none",
                          cursor: isLoading || !formValid ? "not-allowed" : "pointer",
                          background: isLoading || !formValid ? "#9CB3AC" : "#0C6B57",
                          color: "#fff",
                          fontSize: "0.95rem", fontWeight: 600,
                          boxShadow: isLoading || !formValid ? "none" : "0 4px 18px rgba(12,107,87,.35)",
                          transition: "all .16s ease",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        }}
                      >
                        <Lock className="h-4 w-4" />
                        {isLoading ? "Processing…" : `Pay ${formatMoneyCents(selectedPackage.price, selectedPackage.currency)} securely`}
                      </button>

                      <p className="flex md:hidden items-center gap-1.5 justify-center" style={{ fontSize: "0.7rem", color: "#9AA39E" }}>
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
          style={{ borderTop: "1px solid rgba(20,33,29,.09)", background: "#fff" }}
        >
          {step === "schedule" ? (
            <>
              <div style={{ color: "#46524D" }}>
                {canProceed ? (
                  <div
                    className="flex items-center gap-2 flex-wrap"
                    style={{ background: "#E6F0EC", border: "1px solid rgba(12,107,87,.25)", borderRadius: 10, padding: "6px 12px" }}
                  >
                    <span style={{ fontSize: "0.65rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(12,107,87,.15)", color: "#0C6B57", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Selected
                    </span>
                    <span className="font-semibold text-sm" style={{ color: "#14211D" }}>{selDateDisplay}</span>
                    <span style={{ color: "#9AA39E" }}>·</span>
                    <span className="font-bold text-sm" style={{ color: "#0C6B57" }}>{selTimeDisplay}</span>
                  </div>
                ) : (
                  <span className="text-xs" style={{ color: "#9AA39E" }}>Select a date and time to continue</span>
                )}
              </div>

              <div className="flex gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleClose}
                  className="transition-colors hover:bg-page"
                  style={{ padding: "7px 18px", borderRadius: 10, border: "1.5px solid rgba(20,33,29,.18)", background: "#fff", color: "#14211D", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={goToDetails}
                  disabled={!canProceed}
                  style={{
                    padding: "7px 18px", borderRadius: 10, border: "none",
                    background: canProceed ? "#0C6B57" : "#d1d5db",
                    color: canProceed ? "#fff" : "#9ca3af",
                    fontSize: "0.85rem", fontWeight: 700,
                    cursor: canProceed ? "pointer" : "not-allowed",
                    transition: "all .14s ease",
                  }}
                >
                  {canProceed ? "Continue →" : "Select date & time"}
                </button>
              </div>
            </>
          ) : (
            <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
              <button
                type="button"
                onClick={goToSchedule}
                className="flex items-center gap-2 transition-colors hover:bg-page"
                style={{
                  padding: "10px 28px", borderRadius: 11,
                  border: "1.5px solid rgba(20,33,29,.18)",
                  background: "#fff", color: "#14211D",
                  fontSize: "0.9rem", fontWeight: 700, cursor: "pointer",
                }}
              >
                <ChevronLeft className="h-4 w-4" />
                Back to schedule
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
