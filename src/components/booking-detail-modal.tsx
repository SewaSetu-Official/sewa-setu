"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, CalendarDays, Clock, MapPin, Phone, User, Package, CreditCard, Stethoscope } from "lucide-react";
import { formatMoneyCents } from "@/lib/money";

export type SerializedBooking = {
  id: string;
  status: string;
  scheduledAt: string;
  slotTime: string | null;
  amountPaid: number | null;
  currency: string | null;
  mode: string;
  hospital: {
    name: string;
    slug: string;
    phone: string | null;
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

// Derive a display status from the DB status + scheduled date
function resolveDisplayStatus(status: string, scheduledAt: string): string {
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "DRAFT") return "DRAFT";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const apptDay = new Date(scheduledAt);
  apptDay.setHours(0, 0, 0, 0);
  return apptDay < today ? "COMPLETED" : "UPCOMING";
}

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
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

function BookingDetailPopup({ booking, onClose }: { booking: SerializedBooking; onClose: () => void }) {
  const st = STATUS_STYLES[resolveDisplayStatus(booking.status, booking.scheduledAt)] ?? STATUS_STYLES.DRAFT;
  const isPackageBooking = !!booking.package;
  const location = booking.hospital?.location;
  const locationStr = [location?.addressLine, location?.area, location?.city, location?.district]
    .filter(Boolean).join(", ") || location?.city || "—";

  const price = isPackageBooking
    ? (booking.package!.price != null ? formatMoneyCents(booking.package!.price, booking.package!.currency ?? "eur") : null)
    : (booking.amountPaid != null ? formatMoneyCents(booking.amountPaid, booking.currency ?? "eur") : null);

  return createPortal(
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

        </div>
      </div>
    </div>,
    document.body
  );
}

export function BookingList({ bookings }: { bookings: SerializedBooking[] }) {
  const [selected, setSelected] = useState<SerializedBooking | null>(null);

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
          const st = STATUS_STYLES[resolveDisplayStatus(b.status, b.scheduledAt)] ?? STATUS_STYLES.DRAFT;
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

      {selected && <BookingDetailPopup booking={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
