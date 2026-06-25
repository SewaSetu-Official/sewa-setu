"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, CalendarDays, Clock } from "lucide-react";
import type { SerializedBooking } from "./booking-detail-modal";

/* ─── Types ─── */
type AvailabilitySlot = {
  id: string;
  doctorId: string;
  hospitalId: string | null;
  mode: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
};

type Props = {
  booking: SerializedBooking;
  onClose: () => void;
  onSuccess: (newScheduledAt: string, newSlotTime: string) => void;
};

/* ─── Constants ─── */
const PACKAGE_TIME_SLOTS = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const BRAND_GRAD = "linear-gradient(135deg,#0C6B57,#0A5446)";

function pad2(n: number) { return String(n).padStart(2, "0"); }
function toDateKey(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function to12h(t: string) {
  const [h, m = 0] = t.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${pad2(m)} ${ampm}`;
}

export function RescheduleModal({ booking, onClose, onSuccess }: Props) {
  const isDoctor = !!(booking.doctorId || booking.doctor) && !booking.package;

  // Keep booking mode for current-slot matching; allow cross-mode reschedule options.
  const bookingMode = booking.mode?.toUpperCase();
  const bookingHospitalId = booking.hospitalId;

  const slotMatchesBookingContext = useCallback((slot: AvailabilitySlot): boolean => {
    // Keep same-hospital slots when slot records are hospital-scoped. Global slots (null hospitalId) remain allowed.
    if (!bookingHospitalId) return true;
    return slot.hospitalId === null || slot.hospitalId === bookingHospitalId;
  }, [bookingHospitalId]);

  // Always fetch fresh doctorId from the server — never rely on possibly-stale list data
  const [doctorId, setDoctorId] = useState<string | null>(booking.doctorId ?? null);

  // Use local calendar date key consistently to avoid UTC slice/date-shift bugs in UI comparisons.
  const currentBookingDate = toDateKey(new Date(booking.scheduledAt));
  const currentBookingStart = booking.slotTime ? booking.slotTime.split("-")[0].trim() : null;

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [pageStart, setPageStart] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  // Doctor slot fetching
  const [docSlots, setDocSlots] = useState<AvailabilitySlot[]>([]);
  const [bookedSet, setBookedSet] = useState<Set<string>>(new Set());
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [nowTimestamp] = useState(() => Date.now());

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On mount: if doctorId is missing from the list cache, fetch it fresh from the API
  useEffect(() => {
    if (!isDoctor || doctorId) return;
    fetch(`/api/bookings/${booking.id}`)
      .then((r) => r.json())
      .then((data: { doctorId?: string | null }) => {
        if (data.doctorId) setDoctorId(data.doctorId);
        else setError("Doctor information unavailable. Please contact support.");
      })
      .catch(() => setError("Failed to load booking details. Please try again."));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch doctor availability slots once we have the doctorId
  useEffect(() => {
    if (!isDoctor || !doctorId) return;
    const timeoutId = window.setTimeout(() => {
      setSlotsLoading(true);
      fetch(`/api/availability/slots?doctorId=${doctorId}`)
        .then((r) => r.json())
        .then((data: { slots?: AvailabilitySlot[] }) => setDocSlots(data.slots ?? []))
        .catch(() => setError("Failed to load available slots. Please try again."))
        .finally(() => setSlotsLoading(false));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isDoctor, doctorId]);

  // Fetch booked slots for selected date (doctor bookings)
  useEffect(() => {
    if (!isDoctor || !doctorId || !selectedDate) return;
    fetch(`/api/availability/booked?doctorId=${doctorId}`)
      .then((r) => r.json())
      .then((data: { booked?: { slotId: string; date: string }[] }) => {
        const set = new Set<string>();
        for (const b of data.booked ?? []) {
          set.add(`${b.slotId}::${b.date}`);
        }
        setBookedSet(set);
      })
      .catch(() => {});

  }, [isDoctor, doctorId, selectedDate, booking.scheduledAt]);

  const weekDates = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(pageStart);
      d.setDate(pageStart.getDate() + i);
      days.push(d);
    }
    return days;
  }, [pageStart]);

  const canPrev = pageStart.getTime() > today.getTime();

  const weekLabel = (() => {
    const s = weekDates[0];
    const e = weekDates[6];
    return `${s.getDate()} ${MONTHS[s.getMonth()]} – ${e.getDate()} ${MONTHS[e.getMonth()]} ${e.getFullYear()}`;
  })();

  // For doctor bookings: slots available on selected date's dayOfWeek
  const slotsForSelectedDay = useMemo(() => {
    if (!selectedDate || !isDoctor) return [];
    const dow = new Date(selectedDate + "T00:00:00").getDay();
    return docSlots
      .filter((s) => s.dayOfWeek === dow)
      .filter(slotMatchesBookingContext);
  }, [selectedDate, isDoctor, docSlots, slotMatchesBookingContext]);

  // For doctor bookings: does the selected date even have slots?
  const dateHasDocSlots = useMemo(() => {
    if (!isDoctor) return true;
    return (dateKey: string) => {
      const dow = new Date(dateKey + "T00:00:00").getDay();
      return docSlots.some((s) => s.dayOfWeek === dow && slotMatchesBookingContext(s));
    };
  }, [isDoctor, docSlots, slotMatchesBookingContext]);

  const canConfirm = !!selectedDate && (isDoctor ? !!selectedSlotId : !!selectedTime);

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSaving(true);
    setError(null);

    const slotTime = isDoctor
      ? (() => {
          const slot = docSlots.find((s) => s.id === selectedSlotId);
          return slot ? `${slot.startTime}-${slot.endTime}` : selectedTime;
        })()
      : selectedTime;

    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Send an explicit UTC date string for the selected day to avoid local timezone shifts.
          scheduledAt: `${selectedDate}T00:00:00.000Z`,
          slotTime,
          ...(isDoctor ? { availabilitySlotId: selectedSlotId } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setSaving(false);
        return;
      }

      onSuccess(data.scheduledAt, data.slotTime);
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  };

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(20,33,29,0.55)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full overflow-hidden flex flex-col"
        style={{
          maxWidth: 680,
          maxHeight: "92vh",
          background: "#fff",
          borderRadius: 20,
          boxShadow: "0 40px 90px -30px rgba(0,0,0,.55)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex-shrink-0 flex items-center justify-between gap-3 px-6 py-4"
          style={{ background: "linear-gradient(135deg,#14211D,#0a2620)" }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: "#E0913A" }}>
              Reschedule Appointment
            </p>
            <h2 className="text-base font-extrabold text-white truncate">
              {booking.hospital?.name ?? "Hospital"}
            </h2>
            <p className="text-xs text-white/50 mt-0.5">
              {booking.package?.title ?? booking.doctor?.fullName ?? "Appointment"}
            </p>
          </div>

          {/* Week nav */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setPageStart((d) => new Date(d.getTime() - 7 * 86400000))}
              disabled={!canPrev}
              className="h-7 w-7 rounded-lg flex items-center justify-center disabled:opacity-30 transition-all text-white"
              style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.25)" }}
            >
              <ChevronLeft size={13} />
            </button>
            <span className="text-[10px] font-medium px-2 py-1 rounded-md hidden text-white sm:block"
              style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)" }}>
              {weekLabel}
            </span>
            <button
              onClick={() => setPageStart((d) => new Date(d.getTime() + 7 * 86400000))}
              className="h-7 w-7 rounded-lg flex items-center justify-center transition-all text-white"
              style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.25)" }}
            >
              <ChevronRight size={13} />
            </button>
          </div>

          <button
            onClick={onClose}
            className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center transition-all ml-1 text-white"
            style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.22)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#C0556B"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.12)"; }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Current appointment reminder */}
        <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3" style={{ background: "#F8FBF7", borderBottom: "1px solid rgba(12,107,87,.15)" }}>
          <div className="h-7 w-7 rounded-lg bg-[#E6F0EC] flex items-center justify-center flex-shrink-0">
            <CalendarDays size={13} className="text-[#0C6B57]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[0.65rem] font-bold uppercase tracking-widest text-[#C0763A] mb-0.5">Current Appointment</p>
            <p className="text-xs font-semibold text-[#14211D]">
              {formatDate(currentBookingDate)}
              {booking.slotTime ? ` · ${to12h(booking.slotTime.split("-")[0])}` : ""}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ background: "#F6F4EE" }}>
          <div style={{ display: "flex" }}>

            {/* LEFT: Date grid */}
            <div style={{
              width: "52%", flexShrink: 0, background: "#fff",
              padding: "24px 26px 20px", borderRight: "1px solid rgba(20,33,29,.07)",
            }}>
              <p style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#C0763A", marginBottom: 12 }}>
                Select a New Date
              </p>

              {/* Day headers — dynamic, matching weekDates */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 }}>
                {weekDates.map((d) => (
                  <div key={d.toISOString()} style={{ textAlign: "center", fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9AA39E", padding: "3px 0" }}>
                    {DAYS[d.getDay()]}
                  </div>
                ))}
              </div>

              {/* Date cells */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
                {weekDates.map((d) => {
                  const key = toDateKey(d);
                  const isToday = d.getTime() === today.getTime();
                  const isPast = d.getTime() < today.getTime();
                  const isSel = selectedDate === key;
                  const isCurrent = key === currentBookingDate;
                  const noDocSlots = isDoctor && !isPast && typeof dateHasDocSlots === "function" && !dateHasDocSlots(key);
                  const disabled = isPast || noDocSlots;

                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        if (disabled) return;
                        setSelectedDate(key);
                        setSelectedTime("");
                        setSelectedSlotId(null);
                      }}
                      title={noDocSlots ? "No slots available this day" : undefined}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        justifyContent: "center", padding: 0, borderRadius: 8,
                        border: isSel ? "2px solid #0C6B57" : isCurrent ? "2px solid rgba(12,107,87,.35)" : "2px solid rgba(20,33,29,.08)",
                        background: isSel
                          ? BRAND_GRAD
                          : isCurrent ? "rgba(12,107,87,.06)" : "#fff",
                        cursor: disabled ? "not-allowed" : "pointer",
                        opacity: disabled ? 0.3 : 1,
                        transition: "all .12s ease",
                        height: 62, width: "100%",
                      }}
                    >
                      <span style={{ fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: isSel ? "rgba(255,255,255,.75)" : "#9AA39E", marginBottom: 1 }}>
                        {MONTHS[d.getMonth()]}
                      </span>
                      <span style={{ fontSize: "1.15rem", fontWeight: 800, lineHeight: 1, color: isSel ? "#fff" : isToday ? "#0C6B57" : "#14211D" }}>
                        {d.getDate()}
                      </span>
                      {isToday && (
                        <span style={{ fontSize: "0.45rem", fontWeight: 700, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em", color: isSel ? "rgba(255,255,255,.8)" : "#0C6B57" }}>
                          Today
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selection summary */}
              <div style={{ marginTop: 18, padding: 14, borderRadius: 12, background: "#F6F4EE", border: "1.5px solid rgba(20,33,29,.08)" }}>
                <p style={{ fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#C0763A", marginBottom: 8 }}>New Schedule</p>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: "0.7rem", color: "#9AA39E" }}>Date</span>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: selectedDate ? "#14211D" : "#C4BFB4" }}>
                    {selectedDate ? formatDate(selectedDate) : "—"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.7rem", color: "#9AA39E" }}>Time</span>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: selectedTime || selectedSlotId ? "#0C6B57" : "#C4BFB4" }}>
                    {selectedTime ? to12h(selectedTime) : selectedSlotId
                      ? (() => { const s = docSlots.find((x) => x.id === selectedSlotId); return s ? to12h(s.startTime) : "—"; })()
                      : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* RIGHT: Time / slot picker */}
            <div style={{ flex: 1, padding: "24px 22px 20px", background: "#F6F4EE" }}>
              <p style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#C0763A", marginBottom: 12 }}>
                {isDoctor ? "Available Slots" : "Select a Time"}
              </p>

              {!selectedDate ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "70%", gap: 8 }}>
                  <Clock size={28} color="#C4BFB4" />
                  <p style={{ fontSize: "0.75rem", color: "#9AA39E", fontWeight: 500, textAlign: "center" }}>Pick a date first</p>
                </div>
              ) : isDoctor ? (
                slotsLoading ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "70%" }}>
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-solid border-[#0C6B57] border-r-transparent" />
                  </div>
                ) : slotsForSelectedDay.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "70%", gap: 8 }}>
                    <CalendarDays size={24} color="#C4BFB4" />
                    <p style={{ fontSize: "0.75rem", color: "#9AA39E", fontWeight: 500, textAlign: "center" }}>No slots available<br />on this day</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {slotsForSelectedDay.map((slot) => {
                      const key = `${slot.id}::${selectedDate}`;
                      // Current booking: same date AND same start time (doesn't require availabilitySlotId)
                      const isCurrent =
                        selectedDate === currentBookingDate &&
                        slot.startTime === currentBookingStart &&
                        slot.mode?.toUpperCase() === bookingMode;
                      const isBooked = !isCurrent && bookedSet.has(key);
                      // Too soon: slot starts within 30 mins of now
                      const slotDateTime = (() => {
                        const [h, m] = slot.startTime.split(":").map(Number);
                        const dt = new Date(selectedDate + "T00:00:00");
                        dt.setHours(h, m ?? 0, 0, 0);
                        return dt;
                      })();
                      const isTooSoon = slotDateTime.getTime() - nowTimestamp <= 30 * 60 * 1000;
                      const isSel = selectedSlotId === slot.id;
                      const isOnline = slot.mode === "ONLINE";
                      const disabled = isCurrent || isBooked || isTooSoon;

                      if (isCurrent) {
                        return (
                          <div
                            key={slot.id}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "11px 14px", borderRadius: 10,
                              border: "2px solid #0C6B57",
                              background: "rgba(12,107,87,.10)",
                            }}
                          >
                            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#14211D" }}>
                              {to12h(slot.startTime)}
                              <span style={{ fontWeight: 500, color: "#7B857F", marginLeft: 4, fontSize: "0.72rem" }}>
                                – {to12h(slot.endTime)}
                              </span>
                            </span>
                            <span style={{
                              fontSize: "0.6rem", fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                              textTransform: "uppercase", letterSpacing: "0.06em",
                              background: "rgba(12,107,87,.15)", color: "#0C6B57",
                            }}>
                              Current
                            </span>
                          </div>
                        );
                      }

                      if (isBooked || isTooSoon) {
                        return (
                          <div
                            key={slot.id}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "11px 14px", borderRadius: 10,
                              border: "2px solid rgba(20,33,29,.08)",
                              background: "rgba(20,33,29,.03)",
                              opacity: 0.5,
                            }}
                          >
                            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#9AA39E" }}>
                              {to12h(slot.startTime)}
                              <span style={{ fontWeight: 500, marginLeft: 4, fontSize: "0.72rem" }}>
                                – {to12h(slot.endTime)}
                              </span>
                            </span>
                            <span style={{
                              fontSize: "0.6rem", fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                              textTransform: "uppercase", letterSpacing: "0.06em",
                              background: "rgba(20,33,29,.08)", color: "#9AA39E",
                            }}>
                              {isTooSoon ? "Too Soon" : "Booked"}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <button
                          key={slot.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => { setSelectedSlotId(slot.id); setSelectedTime(""); }}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "11px 14px", borderRadius: 10,
                            border: isSel
                              ? `2px solid ${isOnline ? "#E0913A" : "#0C6B57"}`
                              : `2px solid ${isOnline ? "rgba(224,145,58,.3)" : "rgba(12,107,87,.25)"}`,
                            background: isSel
                              ? isOnline ? "rgba(224,145,58,.12)" : "rgba(12,107,87,.10)"
                              : "#fff",
                            cursor: "pointer", transition: "all .12s ease",
                          }}
                        >
                          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#14211D" }}>
                            {to12h(slot.startTime)}
                            <span style={{ fontWeight: 500, color: "#7B857F", marginLeft: 4, fontSize: "0.72rem" }}>
                              – {to12h(slot.endTime)}
                            </span>
                          </span>
                          <span style={{
                            fontSize: "0.6rem", fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                            textTransform: "uppercase", letterSpacing: "0.06em",
                            background: isOnline ? "rgba(224,145,58,.15)" : "rgba(12,107,87,.12)",
                            color: isOnline ? "#C0763A" : "#0C6B57",
                          }}>
                            {slot.mode}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )
              ) : (
                // Package: fixed time slots
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                  {PACKAGE_TIME_SLOTS.map((t) => {
                    const isSel = selectedTime === t;
                    const isToday = selectedDate === toDateKey(today);
                    const [slotHour, slotMin = 0] = t.split(":").map(Number);
                    const now = new Date();
                    const slotTotalMins = slotHour * 60 + slotMin;
                    const nowTotalMins = now.getHours() * 60 + now.getMinutes();
                    const isExpired = isToday && slotTotalMins <= nowTotalMins;
                    return (
                      <button
                        key={t}
                        type="button"
                        disabled={isExpired}
                        onClick={() => !isExpired && setSelectedTime(t)}
                        style={{
                          display: "flex", flexDirection: "column", alignItems: "center",
                          justifyContent: "center", padding: "10px 6px", borderRadius: 9,
                          border: isExpired ? "2px solid rgba(20,33,29,.06)" : isSel ? "2px solid #0C6B57" : "2px solid rgba(20,33,29,.1)",
                          background: isExpired ? "rgba(20,33,29,.03)" : isSel ? BRAND_GRAD : "#fff",
                          cursor: isExpired ? "not-allowed" : "pointer",
                          opacity: isExpired ? 0.5 : 1,
                          transition: "all .12s ease",
                          boxShadow: isSel ? "0 4px 12px rgba(12,107,87,.25)" : "none",
                        }}
                      >
                        <span style={{ fontSize: "0.9rem", fontWeight: 800, lineHeight: 1, color: isExpired ? "#9AA39E" : isSel ? "#fff" : "#14211D" }}>
                          {to12h(t).split(" ")[0]}
                        </span>
                        <span style={{ fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 2, color: isExpired ? "#9AA39E" : isSel ? "rgba(255,255,255,.7)" : "#9AA39E" }}>
                          {isExpired ? "Expired" : to12h(t).split(" ")[1]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 py-4" style={{ borderTop: "1px solid rgba(20,33,29,.09)", background: "#fff" }}>
          {error && (
            <p className="text-xs font-semibold mb-3 text-center" style={{ color: "#C0556B" }}>{error}</p>
          )}
          {!error && selectedDate && !canConfirm && (
            <p className="text-xs font-medium mb-3 text-center" style={{ color: "#46524D" }}>
              Select a slot to enable confirm.
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 h-10 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
              style={{ border: "1.5px solid rgba(20,33,29,.18)", background: "#fff", color: "#14211D" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm || saving}
              className="flex-1 h-10 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
              style={{
                background: canConfirm && !saving ? BRAND_GRAD : "#e8e4de",
                color: canConfirm && !saving ? "#fff" : "#a0a8b4",
                border: "none",
                boxShadow: canConfirm && !saving ? "0 4px 14px rgba(12,107,87,.3)" : "none",
              }}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-[#7B857F] border-r-transparent" />
                  Saving...
                </span>
              ) : "Confirm Reschedule"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
