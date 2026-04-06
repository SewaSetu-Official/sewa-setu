"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  CheckCircle2, XCircle, Loader2, Calendar, Clock,
  User, Building2, Package, Phone, Stethoscope, Hash,
  ShieldCheck, AlertTriangle,
} from "lucide-react";
import Link from "next/link";

type BookingVerify = {
  id: string;
  displayId: string;
  status: string;
  scheduledAt: string;
  slotTime: string | null;
  mode: string;
  amountPaid: number | null;
  currency: string | null;
  createdAt: string;
  hospital: { name: string; city: string | null; addressLine: string | null } | null;
  doctor:   { fullName: string } | null;
  package:  { title: string } | null;
  patient:  { fullName: string; phone: string | null } | null;
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatTime(iso: string, slotTime: string | null) {
  if (slotTime) return slotTime;
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function isUpcoming(scheduledAt: string, slotTime: string | null) {
  const dt = new Date(scheduledAt);
  if (slotTime) {
    const [h, m = 0] = slotTime.split("-")[0].trim().split(":").map(Number);
    dt.setHours(h, m, 0, 0);
  }
  return dt.getTime() >= Date.now();
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  CONFIRMED: { label: "Confirmed",  color: "#059669", bg: "rgba(5,150,105,.08)",  border: "rgba(5,150,105,.2)"  },
  REQUESTED: { label: "Requested",  color: "#d97706", bg: "rgba(217,119,6,.08)",  border: "rgba(217,119,6,.2)"  },
  COMPLETED: { label: "Completed",  color: "#6b7a96", bg: "rgba(107,122,150,.08)", border: "rgba(107,122,150,.2)" },
  CANCELLED: { label: "Cancelled",  color: "#e53e3e", bg: "rgba(229,62,62,.08)",  border: "rgba(229,62,62,.2)"  },
  DRAFT:     { label: "Draft",      color: "#9aa3b0", bg: "rgba(154,163,176,.08)", border: "rgba(154,163,176,.2)" },
};

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3.5" style={{ borderBottom: "1px solid rgba(15,30,56,.06)" }}>
      <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(200,169,110,.1)" }}>
        <Icon className="h-4 w-4" style={{ color: "#a88b50" }} />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "#9aa3b0" }}>{label}</p>
        <p className="text-sm font-semibold mt-0.5" style={{ color: "#0f1e38" }}>{value}</p>
      </div>
    </div>
  );
}

import type React from "react";

export default function VerifyPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<"loading" | "valid" | "invalid">("loading");
  const [booking, setBooking] = useState<BookingVerify | null>(null);

  useEffect(() => {
    fetch(`/api/booking/verify/${id}`)
      .then(async (res) => {
        if (!res.ok) { setState("invalid"); return; }
        const data = await res.json();
        setBooking(data);
        setState("valid");
      })
      .catch(() => setState("invalid"));
  }, [id]);

  /* ── Loading ── */
  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f7f4ef" }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin" style={{ color: "#c8a96e" }} />
          <p className="text-sm font-semibold text-navy">Verifying booking…</p>
        </div>
      </div>
    );
  }

  /* ── Invalid ── */
  if (state === "invalid" || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#f7f4ef" }}>
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex h-20 w-20 rounded-2xl items-center justify-center mb-5"
            style={{ background: "#fef2f2", border: "2px solid #fecaca" }}>
            <XCircle className="h-10 w-10 text-red-500" />
          </div>
          <h1 className="text-xl font-extrabold text-navy mb-2">Booking Not Found</h1>
          <p className="text-sm text-slate leading-relaxed">
            This QR code is invalid or the booking has been removed. Please ask the patient to show their booking ID manually.
          </p>
          <Link href="/"
            className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "#0f1e38", color: "#fff" }}>
            Go to Sewa Setu
          </Link>
        </div>
      </div>
    );
  }

  const upcoming = isUpcoming(booking.scheduledAt, booking.slotTime);
  const isValid  = (booking.status === "CONFIRMED" || booking.status === "REQUESTED") && upcoming;
  const meta     = STATUS_META[booking.status] ?? STATUS_META.DRAFT;

  return (
    <div className="min-h-screen py-10 px-4" style={{ background: "#f7f4ef" }}>
      <div className="max-w-md mx-auto">

        {/* Valid / Invalid banner */}
        <div
          className="rounded-2xl px-6 py-5 mb-6 flex items-center gap-4"
          style={{
            background: isValid ? "linear-gradient(135deg,#052e16,#064e3b)" : "#1c0a0a",
            boxShadow: isValid ? "0 8px 32px rgba(5,78,59,.35)" : "0 8px 32px rgba(229,62,62,.25)",
          }}
        >
          <div className="flex-shrink-0">
            {isValid
              ? <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              : <AlertTriangle className="h-10 w-10 text-red-400" />
            }
          </div>
          <div>
            <p className="font-extrabold text-lg text-white leading-tight">
              {isValid ? "Valid Booking" : "Booking Inactive"}
            </p>
            <p className="text-sm mt-0.5" style={{ color: isValid ? "rgba(167,243,208,.8)" : "rgba(252,165,165,.8)" }}>
              {isValid
                ? "This patient has a confirmed appointment."
                : booking.status === "CANCELLED"
                  ? "This booking has been cancelled."
                  : !upcoming
                    ? "This appointment date has already passed."
                    : "This booking is not confirmed yet."
              }
            </p>
          </div>
        </div>

        {/* Booking card */}
        <div className="rounded-3xl overflow-hidden shadow-lg"
          style={{ background: "#fff", border: "1px solid #f0ece4" }}>

          {/* Header */}
          <div className="px-6 py-5 flex items-center justify-between"
            style={{ background: "#0f1e38" }}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ color: "rgba(200,169,110,.7)" }}>Sewa Setu</p>
              <p className="text-white font-bold text-base leading-tight">Booking Verification</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider font-semibold"
                style={{ color: "rgba(255,255,255,.4)" }}>Booking ID</p>
              <p className="font-mono font-bold tracking-widest text-base" style={{ color: "#c8a96e" }}>
                #{booking.displayId}
              </p>
            </div>
          </div>

          {/* Status pill */}
          <div className="px-6 py-4 flex items-center justify-between"
            style={{ background: "#fdf9f5", borderBottom: "1px solid #f0ece4" }}>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" style={{ color: meta.color }} />
              <span className="text-sm font-bold" style={{ color: meta.color }}>{meta.label}</span>
            </div>
            <span
              className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold"
              style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
            >
              {upcoming ? "Upcoming" : "Past"}
            </span>
          </div>

          {/* Details */}
          <div className="px-6 py-2">
            <Row icon={User}        label="Patient"     value={booking.patient?.fullName ?? ""} />
            <Row icon={Phone}       label="Phone"       value={booking.patient?.phone ?? ""} />
            <Row icon={Building2}   label="Hospital"    value={booking.hospital?.name ?? ""} />
            <Row icon={Package}     label="Package"     value={booking.package?.title ?? (booking.doctor ? `Consultation — ${booking.doctor.fullName}` : "")} />
            <Row icon={Calendar}    label="Date"        value={formatDate(booking.scheduledAt)} />
            <Row icon={Clock}       label="Time Slot"   value={formatTime(booking.scheduledAt, booking.slotTime)} />
            <Row icon={Stethoscope} label="Mode"        value={booking.mode.charAt(0) + booking.mode.slice(1).toLowerCase()} />
          </div>

          {/* Footer */}
          <div className="px-6 py-4 flex items-center justify-between"
            style={{ background: "#fdf9f5", borderTop: "1px solid #f0ece4" }}>
            <p className="text-[10px] text-slate/40 font-medium">
              Verified via Sewa Setu
            </p>
            <div className="flex items-center gap-1">
              <Hash size={10} style={{ color: "#c8a96e" }} />
              <span className="font-mono text-[10px] font-bold" style={{ color: "#c8a96e" }}>
                {booking.displayId}
              </span>
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate/40 mt-5">
          This page is for hospital reception use only.
        </p>
      </div>
    </div>
  );
}
