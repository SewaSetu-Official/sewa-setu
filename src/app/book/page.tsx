'use client'

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Input } from "@/components/ui/input";
import { AlertCircle, Loader2, Lock } from "lucide-react";

function validate(field: string, value: string): string {
  switch (field) {
    case "name":  return value.trim().length < 2 ? "Please enter your full name" : "";
    case "age": {
      const n = Number(value);
      return !value ? "Age is required" : (isNaN(n) || n < 1 || n > 120) ? "Enter a valid age (1–120)" : "";
    }
    case "email": return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? "Enter a valid email address" : "";
    case "phone": return !/^\+?[\d\s\-()+]{7,15}$/.test(value) ? "Enter a valid phone number" : "";
    default: return "";
  }
}

function BookForm() {
  const searchParams = useSearchParams();
  const packageId = searchParams.get("package") ?? "";

  const [loading, setLoading]   = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [touched, setTouched]   = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", date: "", age: "" });

  const errors = {
    name:  touched.name  ? validate("name",  formData.name)  : "",
    age:   touched.age   ? validate("age",   formData.age)   : "",
    email: touched.email ? validate("email", formData.email) : "",
    phone: touched.phone ? validate("phone", formData.phone) : "",
  };

  const formValid =
    !validate("name",  formData.name)  &&
    !validate("age",   formData.age)   &&
    !validate("email", formData.email) &&
    !validate("phone", formData.phone) &&
    !!formData.date;

  const handleBlur = (field: string) => setTouched(p => ({ ...p, [field]: true }));

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, age: true, email: true, phone: true });
    if (!formValid) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId,
          patientName:  formData.name,
          patientPhone: formData.phone,
          patientAge:   formData.age,
          bookingDate:  formData.date,
          buyerEmail:   formData.email,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setErrorMsg(data.error ?? "Failed to start checkout. Please try again.");
        setLoading(false);
      }
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 pt-28 pb-16">
      <div className="overflow-hidden rounded-[28px] border border-[rgba(20,33,29,0.08)] bg-white shadow-[0_28px_56px_-30px_rgba(20,33,29,0.4)]">

        {/* Card header */}
        <div className="relative overflow-hidden px-8 py-8" style={{ background: "linear-gradient(135deg,#0C6B57 0%,#0A5446 100%)" }}>
          <span className="inline-flex items-center gap-2.5 text-[12px] font-extrabold uppercase tracking-[0.14em] text-white/80">
            <svg width="22" height="9" viewBox="0 0 22 9" fill="none" className="shrink-0" aria-hidden>
              <path d="M1 8C5 2 17 2 21 8" stroke="#E0913A" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Appointment Booking
          </span>
          <h1 className="font-display mt-3 text-[1.65rem] font-bold leading-[1.15] tracking-[-0.02em] text-white">
            Book Appointment
          </h1>
          {packageId && (
            <p className="mt-2 text-[0.78rem] text-white/55">
              Package: {packageId}
            </p>
          )}
        </div>

        {/* Form body */}
        <div style={{ background: "#FBFAF6", padding: "32px" }}>

          {errorMsg && (
            <div
              className="flex items-start gap-2 mb-6 p-3 rounded-xl"
              style={{ background: "rgba(229,62,62,.08)", border: "1px solid rgba(229,62,62,.25)" }}
            >
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "#e53e3e" }} />
              <p style={{ fontSize: "0.82rem", color: "#c53030" }}>{errorMsg}</p>
            </div>
          )}

          <form onSubmit={handleConfirm} className="space-y-5" noValidate>

            {/* Full Name */}
            <div>
              <label htmlFor="bp-name" style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#46524D", marginBottom: 6 }}>
                Full Name
              </label>
              <Input
                id="bp-name"
                value={formData.name}
                onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                onBlur={() => handleBlur("name")}
                placeholder="Enter your full name"
                aria-invalid={!!errors.name}
                style={{ background: "#fff", border: `1.5px solid ${errors.name ? "#e53e3e" : "rgba(20,33,29,.14)"}`, borderRadius: 10, height: 44 }}
              />
              {errors.name && (
                <p className="flex items-center gap-1 mt-1.5" style={{ fontSize: "0.72rem", color: "#e53e3e" }}>
                  <AlertCircle className="h-3 w-3 flex-shrink-0" /> {errors.name}
                </p>
              )}
            </div>

            {/* Age + Phone */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="bp-age" style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#46524D", marginBottom: 6 }}>Age</label>
                <Input
                  id="bp-age"
                  type="number"
                  min={1} max={120}
                  value={formData.age}
                  onChange={(e) => setFormData(p => ({ ...p, age: e.target.value }))}
                  onBlur={() => handleBlur("age")}
                  placeholder="30"
                  aria-invalid={!!errors.age}
                  style={{ background: "#fff", border: `1.5px solid ${errors.age ? "#e53e3e" : "rgba(20,33,29,.14)"}`, borderRadius: 10, height: 44 }}
                />
                {errors.age && (
                  <p className="flex items-center gap-1 mt-1.5" style={{ fontSize: "0.72rem", color: "#e53e3e" }}>
                    <AlertCircle className="h-3 w-3 flex-shrink-0" /> {errors.age}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="bp-phone" style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#46524D", marginBottom: 6 }}>Phone</label>
                <Input
                  id="bp-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                  onBlur={() => handleBlur("phone")}
                  placeholder="98XXXXXXXX"
                  aria-invalid={!!errors.phone}
                  style={{ background: "#fff", border: `1.5px solid ${errors.phone ? "#e53e3e" : "rgba(20,33,29,.14)"}`, borderRadius: 10, height: 44 }}
                />
                {errors.phone && (
                  <p className="flex items-center gap-1 mt-1.5" style={{ fontSize: "0.72rem", color: "#e53e3e" }}>
                    <AlertCircle className="h-3 w-3 flex-shrink-0" /> {errors.phone}
                  </p>
                )}
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="bp-email" style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#46524D", marginBottom: 6 }}>
                Email Address
              </label>
              <Input
                id="bp-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                onBlur={() => handleBlur("email")}
                placeholder="you@example.com"
                aria-invalid={!!errors.email}
                style={{ background: "#fff", border: `1.5px solid ${errors.email ? "#e53e3e" : "rgba(20,33,29,.14)"}`, borderRadius: 10, height: 44 }}
              />
              {errors.email && (
                <p className="flex items-center gap-1 mt-1.5" style={{ fontSize: "0.72rem", color: "#e53e3e" }}>
                  <AlertCircle className="h-3 w-3 flex-shrink-0" /> {errors.email}
                </p>
              )}
            </div>

            {/* Date */}
            <div>
              <label htmlFor="bp-date" style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#46524D", marginBottom: 6 }}>
                Appointment Date
              </label>
              <Input
                id="bp-date"
                type="date"
                value={formData.date}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setFormData(p => ({ ...p, date: e.target.value }))}
                style={{ background: "#fff", border: "1.5px solid rgba(20,33,29,.14)", borderRadius: 10, height: 44 }}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", height: 52, borderRadius: 999, border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                background: loading ? "#e6e2da" : "linear-gradient(135deg,#0C6B57 0%,#0A5446 100%)",
                color: loading ? "#9aa0a0" : "#ffffff",
                fontSize: "0.95rem", fontWeight: 700,
                boxShadow: loading ? "none" : "0 12px 30px -10px rgba(12,107,87,.6)",
                transition: "all .16s ease",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Initializing Payment…</>
                : <><Lock className="h-4 w-4" /> Confirm & Pay Now</>
              }
            </button>

            <p className="flex items-center gap-1.5 justify-center" style={{ fontSize: "0.7rem", color: "#9aa3b0" }}>
              <Lock className="h-3 w-3 flex-shrink-0" />
              Secured by Stripe · Card details never stored
            </p>

          </form>
        </div>
      </div>
    </div>
  );
}

export default function BookingPage() {
  return (
    <main className="min-h-screen bg-page">
      <Navbar />
      <Suspense fallback={
        <div className="flex items-center justify-center pt-40">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#0C6B57" }} />
        </div>
      }>
        <BookForm />
      </Suspense>
    </main>
  );
}
