"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import {
  CheckCircle2, Loader2, AlertCircle, Download, Home,
  Calendar, Clock, User, Building2, Package, CreditCard,
  Phone, Stethoscope, Users, Accessibility,
} from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";
import type React from "react";

type BookingData = {
  fullId: string;
  id: string;
  patientName: string;
  patientAge: string;
  patientGender: string;
  patientDisability: string;
  patientPhone: string;
  packageName: string;
  hospitalName: string;
  bookingDate: string;
  slotTime: string;
  consultationMode: string;
  amountPaid: string;
  type: string;
};

function formatDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

function formatMode(mode: string) {
  if (!mode) return "—";
  return mode.charAt(0) + mode.slice(1).toLowerCase();
}

function QRDisplay({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvasRef.current || !url) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: 148,
      margin: 1,
      color: { dark: "#0f1e38", light: "#ffffff" },
    });
  }, [url]);
  return <canvas ref={canvasRef} style={{ borderRadius: 8, display: "block" }} />;
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  if (!value || value === "—") return null;
  return (
    <div className="flex items-center gap-3 py-2.5" style={{ borderBottom: "1px solid rgba(15,30,56,.05)" }}>
      <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(200,169,110,.1)" }}>
        <Icon className="h-3.5 w-3.5" style={{ color: "#a88b50" }} />
      </div>
      <div className="flex-1 min-w-0 flex items-center justify-between gap-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] flex-shrink-0" style={{ color: "#9aa3b0" }}>{label}</p>
        <p className="text-sm font-semibold text-right truncate" style={{ color: "#0f1e38" }}>{value}</p>
      </div>
    </div>
  );
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus]   = useState<"loading" | "success" | "error">("loading");
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [origin, setOrigin]   = useState("");

  useEffect(() => { setOrigin(window.location.origin); }, []);

  useEffect(() => {
    if (!sessionId) { setStatus("error"); setErrorMsg("No session ID found."); return; }
    fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) { setStatus("success"); setBooking(data.booking); }
        else { setStatus("error"); setErrorMsg(data.error ?? "Unable to verify payment."); }
      })
      .catch(() => { setStatus("error"); setErrorMsg("Network error. Please try again."); });
  }, [sessionId]);

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-16 w-16 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(200,169,110,.12)", border: "1.5px solid rgba(200,169,110,.25)" }}>
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#c8a96e" }} />
        </div>
        <div className="text-center">
          <p className="font-bold text-navy">Verifying Payment</p>
          <p className="text-sm text-slate mt-1">This usually takes a few seconds…</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="h-16 w-16 rounded-2xl flex items-center justify-center"
          style={{ background: "#fef2f2", border: "1.5px solid #fecaca" }}>
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <div>
          <p className="font-bold text-navy text-lg">Something went wrong</p>
          <p className="text-sm text-slate mt-1 max-w-sm">{errorMsg}</p>
        </div>
        <div className="flex gap-3 mt-2">
          <Link href="/profile/bookings"
            className="px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ border: "1.5px solid #e8e3da", color: "#6b7a96", background: "#fafaf9" }}>
            My Bookings
          </Link>
          <Link href="/"
            className="px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "#0f1e38", color: "#fff" }}>
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const qrUrl = booking ? `${origin}/booking/verify/${booking.fullId}` : "";

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">

      {/* ── Success header ── */}
      <div className="text-center mb-8">
        <div className="inline-flex h-20 w-20 rounded-2xl items-center justify-center mb-4"
          style={{ background: "linear-gradient(135deg,#c8a96e22,#c8a96e44)", border: "2px solid #c8a96e55" }}>
          <CheckCircle2 className="h-10 w-10" style={{ color: "#c8a96e" }} />
        </div>
        <h1 className="text-2xl font-extrabold text-navy">Booking Confirmed!</h1>
        <p className="text-sm text-slate mt-1">Your boarding pass is ready. Show it at the hospital reception.</p>
      </div>

      {/* ── Boarding pass card ── */}
      <div className="rounded-3xl overflow-visible shadow-2xl" style={{ filter: "drop-shadow(0 20px 60px rgba(15,30,56,.15))" }}>
        <div className="rounded-3xl overflow-hidden" style={{ background: "#fff", border: "1px solid #f0ece4" }}>

          {/* Header — full width navy strip */}
          <div className="px-6 py-4 flex items-center justify-between" style={{ background: "#0f1e38" }}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "rgba(200,169,110,.6)" }}>Sewa Setu</p>
              <p className="text-white font-bold text-base leading-tight">Health Booking Receipt</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "rgba(255,255,255,.35)" }}>Booking ID</p>
              <p className="font-mono font-black text-xl tracking-widest" style={{ color: "#c8a96e" }}>#{booking?.id}</p>
            </div>
          </div>

          {/* Body — two columns with perforated divider */}
          <div className="flex" style={{ minHeight: 280 }}>

            {/* ── LEFT: QR + status ── */}
            <div className="flex flex-col items-center justify-center gap-5 px-8 py-8 flex-shrink-0"
              style={{ background: "#fdf9f5", width: 220 }}>

              {/* QR */}
              <div className="p-2.5 rounded-2xl"
                style={{ background: "#fff", border: "1.5px solid #f0ece4", boxShadow: "0 4px 16px rgba(15,30,56,.08)" }}>
                {booking && origin && <QRDisplay url={qrUrl} />}
              </div>

              {/* Status */}
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                  style={{ background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.2)" }}>
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-bold text-emerald-700">Confirmed & Paid</span>
                </div>
                <p className="text-xl font-black text-navy">{booking?.amountPaid}</p>
                <p className="text-[10px] text-slate/50 font-medium leading-relaxed">
                  Scan at reception or show booking ID
                </p>
              </div>
            </div>

            {/* ── Perforated vertical divider ── */}
            <div className="relative flex-shrink-0 flex flex-col items-center"
              style={{ width: 1 }}>
              {/* Top notch */}
              <div className="absolute -top-3 h-6 w-6 rounded-full z-10"
                style={{ background: "#f7f4ef", border: "1px solid #e8e3da", left: "50%", transform: "translateX(-50%)" }} />
              {/* Dashed line */}
              <div className="flex-1 w-0" style={{ borderLeft: "2px dashed #e8e3da", margin: "12px 0" }} />
              {/* Bottom notch */}
              <div className="absolute -bottom-3 h-6 w-6 rounded-full z-10"
                style={{ background: "#f7f4ef", border: "1px solid #e8e3da", left: "50%", transform: "translateX(-50%)" }} />
            </div>

            {/* ── RIGHT: Details ── */}
            <div className="flex-1 px-7 py-6">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] mb-3" style={{ color: "#c8a96e" }}>
                Booking Details
              </p>
              <DetailRow icon={User}         label="Patient"      value={booking?.patientName ?? ""} />
              <DetailRow icon={Users}        label="Age"          value={booking?.patientAge ? `${booking.patientAge} years` : ""} />
              <DetailRow icon={Users}        label="Gender"       value={booking?.patientGender ?? ""} />
              <DetailRow icon={Accessibility}label="Special Needs"value={booking?.patientDisability || ""} />
              <DetailRow icon={Phone}        label="Phone"        value={booking?.patientPhone ?? ""} />
              <DetailRow icon={Building2}    label="Hospital"     value={booking?.hospitalName ?? ""} />
              <DetailRow icon={Package}      label="Package"      value={booking?.packageName ?? ""} />
              <DetailRow icon={Calendar}     label="Date"         value={formatDate(booking?.bookingDate ?? "")} />
              <DetailRow icon={Clock}        label="Time Slot"    value={booking?.slotTime || "To be confirmed"} />
              <DetailRow icon={Stethoscope}  label="Mode"         value={formatMode(booking?.consultationMode ?? "")} />
              <DetailRow icon={CreditCard}   label="Amount Paid"  value={booking?.amountPaid ?? ""} />
            </div>
          </div>

          {/* Footer strip */}
          <div className="px-6 py-3.5 flex items-center justify-between"
            style={{ background: "#fdf9f5", borderTop: "1px solid #f0ece4" }}>
            <p className="text-[10px] text-slate/40 font-medium">Keep this receipt for your visit.</p>
            <p className="text-[10px] font-mono font-bold" style={{ color: "#c8a96e" }}>#{booking?.id}</p>
          </div>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-3 mt-6 max-w-sm mx-auto">
        <button
          onClick={() => window.print()}
          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-colors"
          style={{ border: "1.5px solid #e8e3da", color: "#6b7a96", background: "#fff" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#f7f4ef")}
          onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
        >
          <Download size={14} /> Save / Print
        </button>
        <Link href="/"
          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-bold"
          style={{ background: "#0f1e38", color: "#fff" }}>
          <Home size={14} /> Back to Home
        </Link>
      </div>

      <p className="text-center text-[11px] text-slate/40 mt-4">
        Need help? Contact your hospital or reach out to Sewa Setu support.
      </p>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <main className="min-h-screen" style={{ background: "#f7f4ef" }}>
      <Navbar />
      <div className="pt-24 pb-12">
        <Suspense fallback={
          <div className="flex justify-center items-center min-h-[60vh]">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#c8a96e" }} />
          </div>
        }>
          <SuccessContent />
        </Suspense>
      </div>
    </main>
  );
}
