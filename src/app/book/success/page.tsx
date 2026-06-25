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
      color: { dark: "#14211D", light: "#ffffff" },
    });
  }, [url]);
  return <canvas ref={canvasRef} style={{ borderRadius: 8, display: "block" }} />;
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  if (!value || value === "—") return null;
  return (
    <div className="flex items-center gap-3 py-2.5" style={{ borderBottom: "1px solid rgba(20,33,29,.06)" }}>
      <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: "#E6F0EC" }}>
        <Icon className="h-3.5 w-3.5" style={{ color: "#0C6B57" }} />
      </div>
      <div className="flex-1 min-w-0 flex items-center justify-between gap-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] flex-shrink-0" style={{ color: "#9AA39E" }}>{label}</p>
        <p className="text-sm font-semibold text-right truncate" style={{ color: "#14211D" }}>{value}</p>
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
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (!sessionId) {
        setStatus("error");
        setErrorMsg("No session ID found.");
        return;
      }

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
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [sessionId]);

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-16 w-16 rounded-2xl flex items-center justify-center"
          style={{ background: "#E6F0EC", border: "1.5px solid rgba(12,107,87,.25)" }}>
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#0C6B57" }} />
        </div>
        <div className="text-center">
          <p className="font-bold text-ink">Verifying payment</p>
          <p className="text-sm text-ink-muted mt-1">This usually takes a few seconds…</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="h-16 w-16 rounded-2xl flex items-center justify-center"
          style={{ background: "#FBEAEE", border: "1.5px solid rgba(192,85,107,.3)" }}>
          <AlertCircle className="h-8 w-8" style={{ color: "#C0556B" }} />
        </div>
        <div>
          <p className="font-bold text-ink text-lg">Something went wrong</p>
          <p className="text-sm text-ink-muted mt-1 max-w-sm">{errorMsg}</p>
        </div>
        <div className="flex gap-3 mt-2">
          <Link href="/profile/bookings"
            className="px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ border: "1.5px solid rgba(20,33,29,.14)", color: "#46524D", background: "#fff" }}>
            My Bookings
          </Link>
          <Link href="/"
            className="px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "#0C6B57", color: "#fff" }}>
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const qrUrl = booking ? `${origin}/booking/verify/${booking.fullId}` : "";

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">

      {/* ── Success header ── */}
      <div className="text-center mb-8">
        <div className="inline-flex h-20 w-20 rounded-2xl items-center justify-center mb-4"
          style={{ background: "linear-gradient(135deg,#E6F0EC,#cfe6dd)", border: "2px solid rgba(12,107,87,.35)" }}>
          <CheckCircle2 className="h-10 w-10" style={{ color: "#0C6B57" }} />
        </div>
        <h1 className="font-display text-2xl font-extrabold text-ink">Booking Confirmed!</h1>
        <p className="text-sm text-ink-muted mt-1">Your boarding pass is ready. Show it at the hospital reception.</p>
      </div>

      {/* ── Boarding pass card ── */}
      <div className="rounded-3xl overflow-visible" style={{ filter: "drop-shadow(0 20px 60px rgba(20,33,29,.15))" }}>
        <div className="rounded-3xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(20,33,29,.08)" }}>

          {/* Header — full width dark-green strip */}
          <div className="px-6 py-4 flex items-center justify-between" style={{ background: "linear-gradient(135deg,#14211D,#0a2620)" }}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "rgba(224,145,58,.7)" }}>Sewa Setu</p>
              <p className="text-white font-bold text-base leading-tight">Health Booking Receipt</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "rgba(255,255,255,.35)" }}>Booking ID</p>
              <p className="font-mono font-black text-xl tracking-widest" style={{ color: "#E0913A" }}>#{booking?.id}</p>
            </div>
          </div>

          {/* Body — two columns with perforated divider */}
          <div className="flex" style={{ minHeight: 280 }}>

            {/* ── LEFT: QR + status ── */}
            <div className="flex flex-col items-center justify-center gap-5 px-8 py-8 flex-shrink-0"
              style={{ background: "#F8FBF7", width: 240 }}>

              {/* QR */}
              <div className="p-2.5 rounded-2xl"
                style={{ background: "#fff", border: "1.5px solid rgba(20,33,29,.08)", boxShadow: "0 4px 16px rgba(20,33,29,.08)" }}>
                {booking && origin && <QRDisplay url={qrUrl} />}
              </div>

              {/* Status */}
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                  style={{ background: "rgba(12,107,87,.08)", border: "1px solid rgba(12,107,87,.2)" }}>
                  <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "#0C6B57" }} />
                  <span className="text-[11px] font-bold" style={{ color: "#0C6B57" }}>Confirmed &amp; Paid</span>
                </div>
                <p className="font-display text-xl font-black text-ink">{booking?.amountPaid}</p>
                <p className="text-[10px] font-medium leading-relaxed" style={{ color: "#9AA39E" }}>
                  Scan at reception or show booking ID
                </p>
              </div>
            </div>

            {/* ── Perforated vertical divider ── */}
            <div className="relative flex-shrink-0 flex flex-col items-center"
              style={{ width: 1 }}>
              {/* Top notch */}
              <div className="absolute -top-3 h-6 w-6 rounded-full z-10"
                style={{ background: "#F6F4EE", border: "1px solid rgba(20,33,29,.12)", left: "50%", transform: "translateX(-50%)" }} />
              {/* Dashed line */}
              <div className="flex-1 w-0" style={{ borderLeft: "2px dashed rgba(20,33,29,.14)", margin: "12px 0" }} />
              {/* Bottom notch */}
              <div className="absolute -bottom-3 h-6 w-6 rounded-full z-10"
                style={{ background: "#F6F4EE", border: "1px solid rgba(20,33,29,.12)", left: "50%", transform: "translateX(-50%)" }} />
            </div>

            {/* ── RIGHT: Details ── */}
            <div className="flex-1 px-7 py-6">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] mb-3" style={{ color: "#C0763A" }}>
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
            style={{ background: "#F8FBF7", borderTop: "1px solid rgba(20,33,29,.08)" }}>
            <p className="text-[10px] font-medium" style={{ color: "#9AA39E" }}>Keep this receipt for your visit.</p>
            <p className="text-[10px] font-mono font-bold" style={{ color: "#C0763A" }}>#{booking?.id}</p>
          </div>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-3 mt-6 max-w-sm mx-auto">
        <button
          onClick={() => window.print()}
          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-colors"
          style={{ border: "1.5px solid rgba(20,33,29,.14)", color: "#46524D", background: "#fff" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#F6F4EE")}
          onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
        >
          <Download size={14} /> Save / Print
        </button>
        <Link href="/"
          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-bold transition-colors"
          style={{ background: "#0C6B57", color: "#fff" }}>
          <Home size={14} /> Back to Home
        </Link>
      </div>

      <p className="text-center text-[11px] mt-4" style={{ color: "#9AA39E" }}>
        Need help? Contact your hospital or reach out to Sewa Setu support.
      </p>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <main className="min-h-screen bg-page">
      <Navbar />
      <div className="pt-24 pb-12">
        <Suspense fallback={
          <div className="flex justify-center items-center min-h-[60vh]">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#0C6B57" }} />
          </div>
        }>
          <SuccessContent />
        </Suspense>
      </div>
    </main>
  );
}
