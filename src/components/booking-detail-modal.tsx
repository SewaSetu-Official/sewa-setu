"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X, CalendarDays, Clock, MapPin, Phone, User, Package, CreditCard, Stethoscope, RefreshCw, Lock, PhoneCall, Mail, CheckCircle2, FileText } from "lucide-react";
import { formatMoneyCents } from "@/lib/money";
import { RescheduleModal } from "./reschedule-modal";

export type SerializedBooking = {
  id: string;
  status: string;
  scheduledAt: string;
  createdAt?: string;
  confirmedAt?: string | null;
  rescheduleCount?: number;
  slotTime: string | null;
  amountPaid: number | null;
  currency: string | null;
  mode: string;
  hospitalId: string | null;
  doctorId: string | null;
  hospital: {
    name: string;
    slug: string;
    phone: string | null;
    email: string | null;
    location: {
      city: string;
      district: string;
      area: string | null;
      addressLine: string | null;
    } | null;
  } | null;
  doctor: { fullName: string } | null;
  package: { title: string; price: number | null; currency: string | null } | null;
  patient: { fullName: string } | null;
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  UPCOMING:   { bg: "bg-blue-100",    text: "text-blue-700",    label: "Upcoming",   dot: "bg-blue-500" },
  COMPLETED:  { bg: "bg-emerald-100", text: "text-emerald-700", label: "Completed",  dot: "bg-emerald-500" },
  REQUESTED:  { bg: "bg-amber-100",   text: "text-amber-700",   label: "Requested",  dot: "bg-amber-500" },
  CANCELLED:  { bg: "bg-red-100",     text: "text-red-700",     label: "Cancelled",  dot: "bg-red-500" },
  DRAFT:      { bg: "bg-gray-100",    text: "text-gray-500",    label: "Draft",      dot: "bg-gray-400" },
};

function getAppointmentDateTime(scheduledAt: string, slotTime: string | null): Date {
  const dt = new Date(scheduledAt);
  if (slotTime) {
    const start = slotTime.split("-")[0].trim();
    const [h, m = 0] = start.split(":").map(Number);
    dt.setHours(h, m, 0, 0);
  }
  return dt;
}

// Derive a display status from DB status + exact appointment datetime.
function resolveDisplayStatus(status: string, scheduledAt: string, slotTime: string | null): string {
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "DRAFT") return "DRAFT";

  const apptTime = getAppointmentDateTime(scheduledAt, slotTime);
  return apptTime.getTime() < Date.now() ? "COMPLETED" : "UPCOMING";
}

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Returns true if the booking was confirmed within the last 30 minutes (reschedule window open).
 *  If timestamp is missing/invalid, returns true — backend enforces the real rule. */
function isModifiable(confirmedAt: string | undefined | null): boolean {
  if (!confirmedAt) return true;
  const ms = Date.now() - new Date(confirmedAt).getTime();
  if (isNaN(ms)) return true;
  return ms <= 30 * 60 * 1000;
}

/** Returns true if the appointment starts within 30 minutes from now.
 *  When imminent, no reschedule and no refund. */
function isAppointmentImminent(scheduledAt: string, slotTime: string | null): boolean {
  const dt = getAppointmentDateTime(scheduledAt, slotTime);
  const diff = dt.getTime() - Date.now();
  return diff >= 0 && diff <= 30 * 60 * 1000;
}

function isQuickFinalBooking(
  scheduledAt: string,
  slotTime: string | null,
  confirmedAt: string | undefined | null,
  createdAt: string | undefined | null
): boolean {
  const bookingRef = confirmedAt ?? createdAt;
  if (!bookingRef) return false;

  const bookedAt = new Date(bookingRef).getTime();
  if (isNaN(bookedAt)) return false;

  const apptAt = getAppointmentDateTime(scheduledAt, slotTime).getTime();
  return apptAt - bookedAt <= 60 * 60 * 1000;
}

function formatSlotTime(t: string) {
  // slotTime may be "09:30" or "09:30-10:00" — take only the start
  const start = t.split("-")[0].trim();
  const [h, m = 0] = start.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#f0ece4] last:border-0">
      <div className="h-8 w-8 rounded-lg bg-[#c8a96e]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[0.65rem] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-[#0f1e38] leading-snug">{value}</p>
      </div>
    </div>
  );
}

function BookingDetailPopup({
  booking,
  onClose,
  onReschedule,
}: {
  booking: SerializedBooking;
  onClose: () => void;
  onReschedule?: (id: string, newScheduledAt: string, newSlotTime: string) => void;
}) {
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleSuccess, setRescheduleSuccess] = useState<{ scheduledAt: string; slotTime: string } | null>(null);
  const st = STATUS_STYLES[resolveDisplayStatus(booking.status, booking.scheduledAt, booking.slotTime)] ?? STATUS_STYLES.DRAFT;
  const isPackageBooking = !!booking.package;
  const location = booking.hospital?.location;
  const locationStr = [location?.area, location?.city, location?.district]
    .filter(Boolean).join(", ") || location?.addressLine || "—";

  const price = isPackageBooking
    ? (booking.package!.price != null ? formatMoneyCents(booking.package!.price, booking.package!.currency ?? "eur") : null)
    : (booking.amountPaid != null ? formatMoneyCents(booking.amountPaid, booking.currency ?? "eur") : null);

  const refundContactCard = (
    <div
      className="rounded-2xl p-4 space-y-2"
      style={{ background: "#fdf8f2", border: "1.5px solid rgba(200,169,110,.25)" }}
    >
      <p className="text-[0.6rem] font-bold uppercase tracking-widest text-[#c8a96e] mb-1">
        Need a Refund?
      </p>
      <p className="text-xs text-gray-500 leading-relaxed mb-3">
        We don&apos;t process automatic refunds. Please contact the hospital directly and our support team will assist you.
      </p>
      <div className="space-y-2">
        {booking.hospital?.phone && (
          <a
            href={`tel:${booking.hospital.phone}`}
            className="flex items-center gap-2.5 text-xs font-semibold text-[#0f1e38] hover:text-[#c8a96e] transition-colors"
          >
            <div className="h-7 w-7 rounded-lg bg-[#c8a96e]/12 flex items-center justify-center flex-shrink-0">
              <PhoneCall size={13} className="text-[#c8a96e]" />
            </div>
            {booking.hospital.phone}
          </a>
        )}
        {booking.hospital?.email && (
          <a
            href={`mailto:${booking.hospital.email}`}
            className="flex items-center gap-2.5 text-xs font-semibold text-[#0f1e38] hover:text-[#c8a96e] transition-colors"
          >
            <div className="h-7 w-7 rounded-lg bg-[#c8a96e]/12 flex items-center justify-center flex-shrink-0">
              <Mail size={13} className="text-[#c8a96e]" />
            </div>
            {booking.hospital.email}
          </a>
        )}
      </div>
    </div>
  );

  const portal = createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(10,18,35,0.72)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full overflow-hidden"
        style={{
          maxWidth: 520,
          maxHeight: "92vh",
          background: "#fff",
          borderRadius: 20,
          boxShadow: "0 32px 80px rgba(10,18,35,.45)",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex-shrink-0 px-6 py-5 flex items-start justify-between gap-4"
          style={{ background: "linear-gradient(135deg,#0f1e38 0%,#1a3059 100%)" }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                {st.label}
              </span>
              <span className="text-xs text-white/40 font-medium uppercase tracking-wider">
                {booking.mode === "PHYSICAL" ? "In-Person" : "Online"}
              </span>
            </div>
            <h3 className="text-lg font-extrabold text-white leading-tight truncate">
              {booking.hospital?.name ?? "Hospital"}
            </h3>
            {isPackageBooking ? (
              <p className="text-sm text-[#c8a96e] font-medium mt-1 truncate">{booking.package!.title}</p>
            ) : booking.doctor ? (
              <p className="text-sm text-[#c8a96e] font-medium mt-1 truncate">{booking.doctor.fullName}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center transition-all mt-0.5"
            style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", color: "rgba(255,255,255,.7)" }}
            onMouseEnter={(e) => { const b = e.currentTarget; b.style.background = "#e53e3e"; b.style.color = "#fff"; }}
            onMouseLeave={(e) => { const b = e.currentTarget; b.style.background = "rgba(255,255,255,.08)"; b.style.color = "rgba(255,255,255,.7)"; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-1" style={{ background: "#faf9f6" }}>

          {/* View Receipt */}
          <Link
            href={`/booking/receipt/${booking.id}`}
            className="flex items-center justify-center gap-2 w-full h-10 rounded-2xl text-sm font-bold mb-3 transition-all"
            style={{ background: "linear-gradient(135deg,#0f1e38 0%,#1a3059 100%)", color: "#c8a96e", boxShadow: "0 4px 14px rgba(15,30,56,.25)" }}
          >
            <FileText size={14} />
            View Boarding Pass / Receipt
          </Link>

          {/* Appointment details */}
          <p className="text-[0.6rem] font-bold uppercase tracking-widest text-[#c8a96e] mb-2">Appointment</p>
          <div className="bg-white rounded-2xl px-4 shadow-sm border border-gray-100">
            <Row
              icon={<CalendarDays size={15} className="text-[#c8a96e]" />}
              label="Date"
              value={formatDate(booking.scheduledAt)}
            />
            <Row
              icon={<Clock size={15} className="text-[#c8a96e]" />}
              label="Time"
              value={booking.slotTime ? formatSlotTime(booking.slotTime) : "—"}
            />
            {booking.patient && (
              <Row
                icon={<User size={15} className="text-[#c8a96e]" />}
                label="Patient"
                value={booking.patient.fullName}
              />
            )}
            {price && (
              <Row
                icon={<CreditCard size={15} className="text-[#c8a96e]" />}
                label="Amount Paid"
                value={price}
              />
            )}
          </div>

          {/* Doctor or Package */}
          {!isPackageBooking && booking.doctor && (
            <>
              <p className="text-[0.6rem] font-bold uppercase tracking-widest text-[#c8a96e] mb-2 pt-4">Doctor</p>
              <div className="bg-white rounded-2xl px-4 shadow-sm border border-gray-100">
                <Row
                  icon={<Stethoscope size={15} className="text-[#c8a96e]" />}
                  label="Doctor"
                  value={booking.doctor.fullName}
                />
              </div>
            </>
          )}

          {isPackageBooking && (
            <>
              <p className="text-[0.6rem] font-bold uppercase tracking-widest text-[#c8a96e] mb-2 pt-4">Package</p>
              <div className="bg-white rounded-2xl px-4 shadow-sm border border-gray-100">
                <Row
                  icon={<Package size={15} className="text-[#c8a96e]" />}
                  label="Package"
                  value={booking.package!.title}
                />
              </div>
            </>
          )}

          {/* Hospital / Location */}
          <p className="text-[0.6rem] font-bold uppercase tracking-widest text-[#c8a96e] mb-2 pt-4">Hospital</p>
          <div className="bg-white rounded-2xl px-4 shadow-sm border border-gray-100">
            <Row
              icon={<MapPin size={15} className="text-[#c8a96e]" />}
              label="Location"
              value={locationStr}
            />
            {booking.hospital?.phone && (
              <Row
                icon={<Phone size={15} className="text-[#c8a96e]" />}
                label="Phone"
                value={booking.hospital.phone}
              />
            )}
          </div>

          {/* ── Actions: only for upcoming bookings ── */}
          {resolveDisplayStatus(booking.status, booking.scheduledAt, booking.slotTime) === "UPCOMING" && (
            <div className="pt-4 space-y-3">
              {isAppointmentImminent(booking.scheduledAt, booking.slotTime) ? (
                /* Imminent appointment — no reschedule, no refund */
                <div
                  className="flex items-start gap-3 rounded-2xl p-4"
                  style={{ background: "#fef2f2", border: "1.5px solid rgba(220,38,38,.2)" }}
                >
                  <div className="h-8 w-8 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Lock size={14} className="text-red-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#0f1e38] mb-0.5">Appointment Starting Soon</p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Your appointment starts in less than 30 minutes. Rescheduling and refunds are no longer available.
                    </p>
                  </div>
                </div>
              ) : isQuickFinalBooking(booking.scheduledAt, booking.slotTime, booking.confirmedAt, booking.createdAt) ? (
                /* Quick booking lock: booked too close to appointment start */
                <div
                  className="flex items-start gap-3 rounded-2xl p-4"
                  style={{ background: "#fef2f2", border: "1.5px solid rgba(220,38,38,.2)" }}
                >
                  <div className="h-8 w-8 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Lock size={14} className="text-red-500" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#0f1e38] mb-0.5">Final Quick Booking</p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      This appointment was booked within 1 hour of the start time. It cannot be rescheduled or refunded.
                    </p>
                  </div>
                </div>
              ) : (booking.rescheduleCount ?? 0) >= 1 ? (
                <>
                  {/* One-time limit reached */}
                  <div
                    className="flex items-start gap-3 rounded-2xl p-4"
                    style={{ background: "#f9f4ee", border: "1.5px solid rgba(200,169,110,.2)" }}
                  >
                    <div className="h-8 w-8 rounded-xl bg-[#c8a96e]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Lock size={14} className="text-[#c8a96e]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#0f1e38] mb-0.5">Reschedule Limit Reached</p>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        You can reschedule this appointment only once. For further changes, please contact the hospital directly.
                      </p>
                    </div>
                  </div>

                  {refundContactCard}
                </>
              ) : isModifiable(booking.confirmedAt ?? booking.createdAt) ? (
                <>
                  <div
                    className="rounded-2xl p-3"
                    style={{ background: "#f8f5ef", border: "1.5px solid rgba(200,169,110,.2)" }}
                  >
                    <p className="text-xs font-semibold text-[#6b7a96] leading-relaxed">
                      You can reschedule only once, so please choose the new time carefully.
                    </p>
                  </div>

                  {/* Reschedule button */}
                  <button
                    onClick={() => setShowReschedule(true)}
                    className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl font-bold text-sm transition-all"
                    style={{
                      background: "linear-gradient(135deg,#0f1e38 0%,#1a3059 100%)",
                      color: "#c8a96e",
                      border: "none",
                      boxShadow: "0 4px 14px rgba(15,30,56,.25)",
                    }}
                  >
                    <RefreshCw size={15} />
                    Reschedule Appointment
                  </button>

                  {refundContactCard}
                </>
              ) : (
                /* Locked notice — 30-min creation window expired */
                <div
                  className="flex items-start gap-3 rounded-2xl p-4"
                  style={{ background: "#f9f4ee", border: "1.5px solid rgba(200,169,110,.2)" }}
                >
                  <div className="h-8 w-8 rounded-xl bg-[#c8a96e]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Lock size={14} className="text-[#c8a96e]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#0f1e38] mb-0.5">Appointment Locked</p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      The 30-minute reschedule window has expired. For any changes, please contact the hospital directly.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      {portal}
      {showReschedule && (
        <RescheduleModal
          booking={booking}
          onClose={() => setShowReschedule(false)}
          onSuccess={(newScheduledAt, newSlotTime) => {
            setShowReschedule(false);
            onReschedule?.(booking.id, newScheduledAt, newSlotTime);
            setRescheduleSuccess({ scheduledAt: newScheduledAt, slotTime: newSlotTime });
          }}
        />
      )}

      {rescheduleSuccess && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
          style={{ background: "rgba(10,18,35,0.72)", backdropFilter: "blur(6px)" }}
          onClick={() => setRescheduleSuccess(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl p-6"
            style={{ background: "#fff", boxShadow: "0 24px 64px rgba(10,18,35,.35)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-11 w-11 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 size={22} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-[0.65rem] font-bold uppercase tracking-widest text-emerald-600">Reschedule Confirmed</p>
                <h4 className="text-lg font-extrabold text-[#0f1e38] leading-tight">Your new appointment is confirmed</h4>
              </div>
            </div>

            <div className="rounded-2xl p-4 mb-5" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <p className="text-xs text-gray-500 mb-1">New Date</p>
              <p className="text-sm font-bold text-[#0f1e38] mb-3">{formatDate(rescheduleSuccess.scheduledAt)}</p>
              <p className="text-xs text-gray-500 mb-1">New Time</p>
              <p className="text-sm font-bold text-[#0f1e38]">{formatSlotTime(rescheduleSuccess.slotTime)}</p>
            </div>

            <button
              type="button"
              onClick={() => setRescheduleSuccess(null)}
              className="w-full h-11 rounded-2xl font-bold text-sm"
              style={{
                background: "linear-gradient(135deg,#0f1e38 0%,#1a3059 100%)",
                color: "#c8a96e",
                border: "none",
              }}
            >
              Done
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export function BookingList({ bookings: initialBookings }: { bookings: SerializedBooking[] }) {
  const [bookings, setBookings] = useState<SerializedBooking[]>(initialBookings);
  const [selected, setSelected] = useState<SerializedBooking | null>(null);

  // Sync when parent provides a fresh list (e.g. after Load More)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setBookings(initialBookings); }, [initialBookings]);

  const handleReschedule = (id: string, newScheduledAt: string, newSlotTime: string) => {
    setBookings((prev) =>
      prev.map((b) =>
        b.id === id
          ? { ...b, scheduledAt: newScheduledAt, slotTime: newSlotTime, rescheduleCount: (b.rescheduleCount ?? 0) + 1 }
          : b
      )
    );
    setSelected((prev) =>
      prev?.id === id
        ? { ...prev, scheduledAt: newScheduledAt, slotTime: newSlotTime, rescheduleCount: (prev.rescheduleCount ?? 0) + 1 }
        : prev
    );
  };


  if (bookings.length === 0) {
    return (
      <div className="py-14 flex flex-col items-center justify-center gap-3 text-center px-6">
        <span className="text-4xl">🏥</span>
        <p className="font-semibold text-[#0f1e38]">No bookings yet</p>
        <p className="text-sm text-gray-400">Your appointment history will appear here after your first booking.</p>
        <a href="/search">
          <button className="mt-2 px-5 py-2.5 rounded-xl bg-[#0f1e38] text-[#c8a96e] text-sm font-bold hover:bg-[#1a3059] transition-colors">
            Find Hospitals
          </button>
        </a>
      </div>
    );
  }

  const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return (
    <>
      <div className="divide-y divide-gray-50">
        {bookings.map((b) => {
          const st = STATUS_STYLES[resolveDisplayStatus(b.status, b.scheduledAt, b.slotTime)] ?? STATUS_STYLES.DRAFT;
          const d = new Date(b.scheduledAt);
          const date = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
          const subtitle = b.package
            ? b.package.title
            : b.doctor
            ? b.doctor.fullName
            : "Appointment";

          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelected(b)}
              className="w-full flex items-center gap-4 px-6 py-4 hover:bg-[#faf8f4] transition-colors text-left group"
            >
              <div className="h-10 w-10 rounded-xl bg-[#0f1e38]/5 flex items-center justify-center flex-shrink-0 group-hover:bg-[#c8a96e]/15 transition-colors">
                <CalendarDays size={18} className="text-[#c8a96e]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#0f1e38] text-sm truncate">
                  {b.hospital?.name ?? "Hospital"}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {subtitle} · {date}{b.slotTime ? ` · ${formatSlotTime(b.slotTime)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}>
                  {st.label}
                </span>
                <span className="text-[#c8a96e]/40 group-hover:text-[#c8a96e] transition-colors text-sm">›</span>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <BookingDetailPopup
          booking={selected}
          onClose={() => setSelected(null)}
          onReschedule={handleReschedule}
        />
      )}

    </>
  );
}
