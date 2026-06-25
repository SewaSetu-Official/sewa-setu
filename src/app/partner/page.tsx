"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

/* ═══════════════════════════════════════════════════════════
   DESIGN TOKENS
   ═══════════════════════════════════════════════════════════ */
const GOLD = "#E0913A";
const GOLD_LIGHT = "#EBB36B";
const GOLD_DARK = "#C0763A";
const NAVY = "#14211D";
const CREAM = "#F6F4EE";

const FACILITY_TYPES = [
  { value: "HOSPITAL", label: "Hospital", icon: "🏥", desc: "Full-service hospital" },
  { value: "CLINIC", label: "Clinic", icon: "🩺", desc: "Outpatient clinic" },
  { value: "LAB", label: "Diagnostic Lab", icon: "🔬", desc: "Laboratory services" },
];

const EMPTY = { hospitalName: "", type: "", contactName: "", email: "", phone: "", city: "", message: "" };

const MOCK_APPOINTMENTS = [
  { name: "Rajesh Sharma", time: "09:00", dept: "Cardiology", status: "confirmed", avatar: "RS" },
  { name: "Sita Thapa", time: "10:30", dept: "General OPD", status: "pending", avatar: "ST" },
  { name: "Binod Karmacharya", time: "11:00", dept: "Orthopedics", status: "confirmed", avatar: "BK" },
  { name: "Anita Gurung", time: "14:00", dept: "Dermatology", status: "confirmed", avatar: "AG" },
];

const STATS = [
  { label: "Bookings Today", value: "12", change: "+3", icon: "📅" },
  { label: "Total Patients", value: "1,240", change: "+34%", icon: "👥" },
  { label: "Avg Rating", value: "4.9", change: "★", icon: "⭐" },
];

const FEATURES = [
  { icon: "📊", title: "Live Dashboard", desc: "Real-time appointment tracking & analytics" },
  { icon: "🔔", title: "Instant Alerts", desc: "Push notifications for every new booking" },
  { icon: "🛡️", title: "Verified Badge", desc: "Build trust with a verified hospital seal" },
  { icon: "📈", title: "Growth Insights", desc: "Monthly reports on patient acquisition" },
];

/* ═══════════════════════════════════════════════════════════
   PARTICLE CANVAS
   ═══════════════════════════════════════════════════════════ */
type Particle = { x: number; y: number; r: number; dx: number; dy: number; o: number };

function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const animId = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d")!;
    let w = canvas.width = canvas.offsetWidth * 2;
    let h = canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);

    const count = 60;
    particles.current = Array.from({ length: count }, () => ({
      x: Math.random() * w / 2,
      y: Math.random() * h / 2,
      r: Math.random() * 1.5 + 0.3,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      o: Math.random() * 0.4 + 0.1,
    }));

    function draw() {
      ctx.clearRect(0, 0, w / 2, h / 2);
      for (const p of particles.current) {
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0) p.x = w / 2;
        if (p.x > w / 2) p.x = 0;
        if (p.y < 0) p.y = h / 2;
        if (p.y > h / 2) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,169,110,${p.o})`;
        ctx.fill();
      }
      // Draw connections
      for (let i = 0; i < particles.current.length; i++) {
        for (let j = i + 1; j < particles.current.length; j++) {
          const a = particles.current[i], b = particles.current[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(200,169,110,${0.06 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animId.current = requestAnimationFrame(draw);
    }
    draw();
    const onResize = () => {
      w = canvas.width = canvas.offsetWidth * 2;
      h = canvas.height = canvas.offsetHeight * 2;
      ctx.scale(2, 2);
    };
    window.addEventListener("resize", onResize);
    return () => {
      if (animId.current !== null) cancelAnimationFrame(animId.current);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />;
}

/* ═══════════════════════════════════════════════════════════
   ANIMATED COUNTER
   ═══════════════════════════════════════════════════════════ */
function AnimCounter({ value, duration = 1500 }: { value: string; duration?: number }) {
  const numericPart = value.replace(/[^0-9.]/g, "");
  const suffix = value.replace(/[0-9.,]/g, "");
  const hasComma = value.includes(",");
  const [display, setDisplay] = useState(() => {
    const target = parseFloat(numericPart.replace(",", ""));
    return isNaN(target) ? value : "0";
  });

  useEffect(() => {
    const target = parseFloat(numericPart.replace(",", ""));
    if (isNaN(target)) return;

    const start = performance.now();
    let frameId = 0;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * target;
      if (hasComma) {
        setDisplay(Math.round(current).toLocaleString() + suffix);
      } else if (value.includes(".")) {
        setDisplay(current.toFixed(1) + suffix);
      } else {
        setDisplay(Math.round(current) + suffix);
      }
      if (progress < 1) frameId = requestAnimationFrame(tick);
    }
    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [duration, hasComma, numericPart, suffix, value]);

  return <span>{display}</span>;
}

/* ═══════════════════════════════════════════════════════════
   3D TILT CARD
   ═══════════════════════════════════════════════════════════ */
function TiltCard({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("");

  const handleMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTransform(`perspective(800px) rotateX(${-y * 6}deg) rotateY(${x * 6}deg) scale3d(1.01,1.01,1.01)`);
  }, []);

  const handleLeave = useCallback(() => {
    setTransform("perspective(800px) rotateX(0) rotateY(0) scale3d(1,1,1)");
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={className}
      style={{ ...style, transform, transition: "transform 0.4s cubic-bezier(0.03,0.98,0.52,0.99)", willChange: "transform" }}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FLOATING NOTIFICATION
   ═══════════════════════════════════════════════════════════ */
function FloatingNotif({ icon, title, sub, color, style, delay }: {
  icon: string; title: string; sub: string; color: string;
  style: React.CSSProperties; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: [0, -8, 0] }}
      transition={{
        opacity: { delay, duration: 0.5 },
        scale: { delay, duration: 0.5 },
        y: { delay: delay + 0.5, duration: 5, repeat: Infinity, ease: "easeInOut" },
      }}
      style={{
        position: "absolute",
        ...style,
        background: "rgba(8,14,28,0.95)",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(20px)",
        borderRadius: 16,
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 170,
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${color}10`,
        zIndex: 20,
        pointerEvents: "none",
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `${color}15`, border: `1px solid ${color}25`,
        fontSize: 14,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{title}</div>
        <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>{sub}</div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */
export default function PartnerPage() {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [step, setStep] = useState(0); // 0 = type, 1 = details, 2 = message
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [liveTime, setLiveTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  function set(k: keyof typeof EMPTY, v: string) { setForm(f => ({ ...f, [k]: v })); setError(""); }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.type) { setError("Please select a facility type."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/partner-inquiry", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setDone(true);
      } else {
        setError((await res.json()).error || "Something went wrong.");
      }
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  }

  const formSteps = [
    { label: "Facility", complete: !!form.type },
    { label: "Details", complete: !!form.hospitalName && !!form.email && !!form.contactName },
    { label: "Submit", complete: done },
  ];

  /* ─── SUCCESS ─── */
  if (done) return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: `linear-gradient(160deg, ${NAVY} 0%, #0a1628 50%, #0d1f3c 100%)`,
      fontFamily: "'DM Sans', 'Outfit', sans-serif",
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        style={{ textAlign: "center", maxWidth: 440, padding: "0 24px" }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
          style={{
            width: 96, height: 96, borderRadius: "50%", margin: "0 auto 32px",
            background: `linear-gradient(135deg, ${GOLD}20, ${GOLD}08)`,
            border: `2px solid ${GOLD}40`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 60px ${GOLD}15`,
          }}
        >
          <span style={{ fontSize: 40 }}>✓</span>
        </motion.div>
        <h2 style={{ fontSize: 32, fontWeight: 800, color: "#fff", marginBottom: 12, fontFamily: "Outfit" }}>
          Application Received
        </h2>
        <p style={{ color: "#64748b", marginBottom: 8, fontSize: 15 }}>Our team will reach out to</p>
        <p style={{ color: GOLD, fontWeight: 600, fontSize: 17, marginBottom: 8 }}>{form.email}</p>
        <p style={{ color: "#475569", fontSize: 13, marginBottom: 40 }}>within 2–3 business days</p>
        <Link href="/">
          <motion.div
            style={{
              padding: "16px 40px", borderRadius: 14,
              background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD}, ${GOLD_DARK})`,
              color: NAVY, fontWeight: 700, fontSize: 14, cursor: "pointer",
              display: "inline-block", fontFamily: "Outfit",
            }}
            whileHover={{ y: -2, boxShadow: `0 12px 40px ${GOLD}40` }}
            whileTap={{ scale: 0.98 }}
          >
            Back to Home
          </motion.div>
        </Link>
      </motion.div>
    </div>
  );

  /* ─── MAIN ─── */
  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "row" }}>

        {/* ══════════════════════════════════════════════
            LEFT — Immersive Dashboard Preview
        ══════════════════════════════════════════════ */}
        <div className="partner-left" style={{
          width: "55%", position: "relative", overflow: "hidden",
          display: "flex", flexDirection: "column", justifyContent: "center",
          padding: "64px 60px",
          background: `linear-gradient(160deg, #040a18 0%, #071222 40%, #0a1a30 100%)`,
        }}>
          <ParticleField />

          {/* Ambient orbs */}
          <div style={{
            position: "absolute", top: -100, left: -100, width: 500, height: 500,
            borderRadius: "50%", pointerEvents: "none",
            background: `radial-gradient(circle, ${GOLD}12 0%, transparent 60%)`,
            filter: "blur(40px)",
          }} />
          <div style={{
            position: "absolute", bottom: -80, right: -80, width: 400, height: 400,
            borderRadius: "50%", pointerEvents: "none",
            background: "radial-gradient(circle, rgba(99,179,237,0.06) 0%, transparent 60%)",
            filter: "blur(30px)",
          }} />

          <div style={{ position: "relative", zIndex: 10 }}>

            {/* Back link */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Link href="/" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                color: "#64748b", fontSize: 13, marginBottom: 24, cursor: "pointer",
                textDecoration: "none",
              }}>
                ← Back to home
              </Link>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              style={{
                fontSize: 54, fontWeight: 800, lineHeight: 1.08,
                color: "#fff", marginBottom: 20, fontFamily: "Outfit",
                letterSpacing: "-0.03em",
              }}
            >
              Bring Your<br />
              Hospital{" "}
              <span style={{
                background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD}, ${GOLD_DARK})`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                Online.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              style={{ color: "#94a3b8", fontSize: 15, lineHeight: 1.6, maxWidth: 440, marginBottom: 20 }}
            >
              Connect with thousands of patients actively searching for quality
              healthcare across Nepal — and manage every booking from one powerful dashboard.
            </motion.p>

            {/* Feature pills */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}
            >
              {FEATURES.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8 + i * 0.1 }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 16px", borderRadius: 100,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    fontSize: 12, color: "#94a3b8",
                  }}
                >
                  <span style={{ fontSize: 14 }}>{f.icon}</span>
                  {f.title}
                </motion.div>
              ))}
            </motion.div>

            {/* Dashboard Card with 3D Tilt */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 1, ease: [0.16, 1, 0.3, 1] }}
              style={{ position: "relative", maxWidth: 460, marginTop: 56, marginLeft: "auto", marginRight: "auto", paddingLeft: 32 }}
            >
              {/* Floating notifs */}
              <FloatingNotif icon="🔔" title="New Booking" sub="Amit Poudel · Dental" color={GOLD} style={{ top: "-8%", right: -30 }} delay={1.2} />
              <FloatingNotif icon="⭐" title="5★ Review" sub='"Excellent service!"' color="#f59e0b" style={{ bottom: "22%", left: -40 }} delay={1.8} />
              <FloatingNotif icon="📈" title="+34% Patients" sub="vs last month" color="#34d399" style={{ bottom: "-2%", right: "2%" }} delay={2.2} />

              <TiltCard style={{
                borderRadius: 20, overflow: "hidden",
                background: "#f5f1ea",
                border: "1.5px solid rgba(200,169,110,0.45)",
                boxShadow: `0 24px 60px rgba(0,0,0,0.3), 0 4px 20px rgba(200,169,110,0.15)`,
              }}>
                {/* Dashboard Header */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "16px 20px",
                  borderBottom: "1.5px solid rgba(200,169,110,0.3)",
                  background: "#fff",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 10,
                      background: `${GOLD}20`, border: `1px solid ${GOLD}50`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14,
                    }}>🏥</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#07111e" }}>Bir Hospital</div>
                      <div style={{ fontSize: 9, color: "#64748b" }}>Kathmandu · Dashboard</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: "50%", background: "#34d399",
                      boxShadow: "0 0 8px #34d39960",
                      animation: "livePulse 2s ease-in-out infinite",
                    }} />
                    <span suppressHydrationWarning style={{ fontSize: 9, color: "#475569", fontWeight: 600 }}>
                      {liveTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>
                </div>

                {/* Stats Row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: "1.5px solid rgba(200,169,110,0.25)" }}>
                  {STATS.map((s, i) => (
                    <div key={i} style={{
                      padding: "16px 14px", textAlign: "center",
                      borderRight: i < 2 ? "1.5px solid rgba(200,169,110,0.25)" : "none",
                      background: "#fff",
                    }}>
                      <div style={{ fontSize: 13, marginBottom: 6 }}>{s.icon}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#07111e", fontFamily: "Outfit" }}>
                        <AnimCounter value={s.value} />
                      </div>
                      <div style={{ fontSize: 9, color: "#475569", marginTop: 2 }}>{s.label}</div>
                      <div style={{
                        display: "inline-block", marginTop: 4,
                        fontSize: 9, fontWeight: 700, color: "#34d399",
                        background: "#34d39915", padding: "2px 8px", borderRadius: 100,
                      }}>{s.change}</div>
                    </div>
                  ))}
                </div>

                {/* Appointments */}
                <div style={{ padding: "16px 20px" }}>
                  <div style={{
                    fontSize: 9, fontWeight: 800, color: "#475569",
                    textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12,
                  }}>Today&apos;s Appointments</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {MOCK_APPOINTMENTS.map((a, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.5 + i * 0.15 }}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "8px 12px", borderRadius: 12,
                          background: "#fff",
                          border: "1.5px solid rgba(200,169,110,0.2)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: "50%",
                            background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 9, fontWeight: 800, color: NAVY,
                          }}>{a.avatar}</div>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#07111e" }}>{a.name}</div>
                            <div style={{ fontSize: 9, color: "#64748b" }}>{a.dept}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 9, color: "#334155", fontFamily: "monospace", fontWeight: 600 }}>{a.time}</span>
                          <span style={{
                            fontSize: 8, fontWeight: 700, padding: "3px 10px", borderRadius: 100,
                            background: a.status === "confirmed" ? "#34d39915" : `${GOLD}15`,
                            color: a.status === "confirmed" ? "#059669" : GOLD_DARK,
                            border: `1px solid ${a.status === "confirmed" ? "#34d39940" : GOLD + "50"}`,
                            textTransform: "uppercase", letterSpacing: "0.05em",
                          }}>{a.status}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div style={{
                  display: "flex", justifyContent: "space-between", padding: "10px 20px",
                  borderTop: "1.5px solid rgba(200,169,110,0.25)",
                  background: "rgba(200,169,110,0.06)",
                }}>
                  {[
                    { icon: "🛡️", text: "Verified Hospital" },
                    { icon: "💚", text: "All systems normal" },
                    { icon: "🔒", text: "HIPAA Compliant" },
                  ].map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 10 }}>{f.icon}</span>
                      <span style={{ fontSize: 8, color: "#475569", fontWeight: 600 }}>{f.text}</span>
                    </div>
                  ))}
                </div>
              </TiltCard>
            </motion.div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            RIGHT — Multi-Step Form
        ══════════════════════════════════════════════ */}
        <div className="partner-right" style={{
          width: "45%", display: "flex", alignItems: "center", justifyContent: "center",
          padding: "48px 48px",
          background: CREAM,
          position: "relative", overflow: "hidden",
        }}>
          {/* Subtle pattern */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.4,
            backgroundImage: `radial-gradient(${GOLD}08 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }} />

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            style={{ width: "100%", maxWidth: 460, position: "relative", zIndex: 1 }}
          >
            {/* Header */}
            <div style={{ marginBottom: 36 }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: 48 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                style={{ height: 3, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})`, borderRadius: 2, marginBottom: 20 }}
              />
              <h2 style={{ fontSize: 34, fontWeight: 800, color: "#14211D", fontFamily: "Outfit", letterSpacing: "-0.02em" }}>
                Apply to Partner
              </h2>
              <p style={{ color: "#64748b", fontSize: 15, marginTop: 8, lineHeight: 1.6 }}>
                Our team reviews every application and contacts you within 2–3 days.
              </p>
            </div>

            {/* Step indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 32 }}>
              {formSteps.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center" }}>
                  <div
                    onClick={() => { if (i < step || s.complete) setStep(i); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                      padding: "6px 14px", borderRadius: 100,
                      background: i === step ? `${GOLD}15` : s.complete ? "#34d39910" : "transparent",
                      border: `1.5px solid ${i === step ? GOLD + "50" : s.complete ? "#34d39930" : "#e2ddd6"}`,
                      transition: "all 0.3s",
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 800,
                      background: s.complete ? "#34d399" : i === step ? GOLD : "#cbd5e1",
                      color: "#fff",
                    }}>
                      {s.complete ? "✓" : i + 1}
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: i === step ? GOLD_DARK : s.complete ? "#34d399" : "#94a3b8",
                    }}>{s.label}</span>
                  </div>
                  {i < formSteps.length - 1 && (
                    <div style={{ width: 24, height: 1, background: "#e2ddd6", margin: "0 4px" }} />
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={submit}>
              <AnimatePresence mode="wait">

                {/* STEP 0: Facility Type */}
                {step === 0 && (
                  <motion.div
                    key="step0"
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.35 }}
                  >
                    <label style={{
                      display: "block", fontSize: 10, fontWeight: 800,
                      textTransform: "uppercase", letterSpacing: "0.15em",
                      color: "#475569", marginBottom: 14,
                    }}>
                      Select Facility Type <span style={{ color: GOLD }}>*</span>
                    </label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {FACILITY_TYPES.map((t) => {
                        const active = form.type === t.value;
                        return (
                          <motion.div
                            key={t.value}
                            whileHover={{ x: 4 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => { set("type", t.value); setTimeout(() => setStep(1), 300); }}
                            style={{
                              display: "flex", alignItems: "center", gap: 18,
                              padding: "22px 24px", borderRadius: 18, cursor: "pointer",
                              background: active ? `${GOLD}10` : "#fff",
                              border: `1.5px solid ${active ? GOLD + "60" : "#e8e3db"}`,
                              boxShadow: active ? `0 4px 20px ${GOLD}15` : "0 1px 4px rgba(0,0,0,0.04)",
                              transition: "all 0.3s",
                            }}
                          >
                            <div style={{
                              width: 52, height: 52, borderRadius: 16,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              background: active ? `${GOLD}18` : "#f8f6f2",
                              border: `1px solid ${active ? GOLD + "30" : "#e8e3db"}`,
                              fontSize: 26, transition: "all 0.3s",
                            }}>{t.icon}</div>
                            <div>
                              <div style={{ fontSize: 16, fontWeight: 700, color: active ? GOLD_DARK : "#14211D" }}>{t.label}</div>
                              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 3 }}>{t.desc}</div>
                            </div>
                            <div style={{
                              marginLeft: "auto", width: 22, height: 22, borderRadius: "50%",
                              border: `2px solid ${active ? GOLD : "#d1d5db"}`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              transition: "all 0.3s",
                            }}>
                              {active && <div style={{ width: 10, height: 10, borderRadius: "50%", background: GOLD }} />}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* STEP 1: Details */}
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.35 }}
                    style={{ display: "flex", flexDirection: "column", gap: 20 }}
                  >
                    <FormField label="Hospital / Clinic Name" required placeholder="e.g. Bir Hospital, Kathmandu"
                      value={form.hospitalName} onChange={v => set("hospitalName", v)}
                      focused={focusedField === "hospitalName"}
                      onFocus={() => setFocusedField("hospitalName")}
                      onBlur={() => setFocusedField(null)} />

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <FormField label="Contact Person" required placeholder="Full name"
                        value={form.contactName} onChange={v => set("contactName", v)}
                        focused={focusedField === "contactName"}
                        onFocus={() => setFocusedField("contactName")}
                        onBlur={() => setFocusedField(null)} />
                      <FormField label="Work Email" required type="email" placeholder="you@hospital.com"
                        value={form.email} onChange={v => set("email", v)}
                        focused={focusedField === "email"}
                        onFocus={() => setFocusedField("email")}
                        onBlur={() => setFocusedField(null)} />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <FormField label="Phone" required type="tel" placeholder="+977 98XXXXXXXX"
                        value={form.phone} onChange={v => set("phone", v)}
                        focused={focusedField === "phone"}
                        onFocus={() => setFocusedField("phone")}
                        onBlur={() => setFocusedField(null)} />
                      <FormField label="City" required placeholder="e.g. Kathmandu"
                        value={form.city} onChange={v => set("city", v)}
                        focused={focusedField === "city"}
                        onFocus={() => setFocusedField("city")}
                        onBlur={() => setFocusedField(null)} />
                    </div>

                    <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                      <motion.button type="button" onClick={() => setStep(0)}
                        whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}
                        style={{
                          padding: "16px 28px", borderRadius: 14, fontSize: 14, fontWeight: 700,
                          background: "#fff", border: "1.5px solid #e2ddd6", color: "#64748b",
                          cursor: "pointer", fontFamily: "DM Sans",
                        }}>← Back</motion.button>
                      <motion.button type="button"
                        onClick={() => {
                          if (form.hospitalName && form.email && form.contactName && form.phone && form.city) setStep(2);
                          else setError("Please fill in all required fields.");
                        }}
                        whileHover={{ y: -2, boxShadow: `0 8px 30px ${GOLD}30` }}
                        whileTap={{ scale: 0.98 }}
                        style={{
                          flex: 1, padding: "16px 28px", borderRadius: 14, fontSize: 14, fontWeight: 700,
                          background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD}, ${GOLD_DARK})`,
                          border: "none", color: NAVY, cursor: "pointer", fontFamily: "Outfit",
                        }}>Continue →</motion.button>
                    </div>
                  </motion.div>
                )}

                {/* STEP 2: Message + Submit */}
                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.35 }}
                    style={{ display: "flex", flexDirection: "column", gap: 20 }}
                  >
                    {/* Summary card */}
                    <div style={{
                      padding: 20, borderRadius: 16, background: "#fff",
                      border: "1.5px solid #e8e3db",
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#94a3b8", marginBottom: 14 }}>
                        Application Summary
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        {[
                          { l: "Facility", v: FACILITY_TYPES.find(f => f.value === form.type)?.label },
                          { l: "Name", v: form.hospitalName },
                          { l: "Contact", v: form.contactName },
                          { l: "Email", v: form.email },
                        ].map((item, i) => (
                          <div key={i}>
                            <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>{item.l}</div>
                            <div style={{ fontSize: 14, color: "#14211D", fontWeight: 600, marginTop: 3 }}>{item.v}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label style={{
                        display: "block", fontSize: 11, fontWeight: 800,
                        textTransform: "uppercase", letterSpacing: "0.15em",
                        color: "#475569", marginBottom: 10,
                      }}>
                        Additional Info <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "#94a3b8" }}>(optional)</span>
                      </label>
                      <textarea
                        rows={4}
                        placeholder="Departments, number of doctors, anything useful..."
                        value={form.message}
                        onChange={e => set("message", e.target.value)}
                        onFocus={e => { e.target.style.borderColor = GOLD + "90"; e.target.style.boxShadow = `0 0 0 3px ${GOLD}12`; }}
                        onBlur={e => { e.target.style.borderColor = "#e2ddd6"; e.target.style.boxShadow = "none"; }}
                        style={{
                          width: "100%", borderRadius: 14, padding: "16px 18px",
                          fontSize: 14, border: "1.5px solid #e2ddd6",
                          background: "#fff", color: "#14211D", resize: "none",
                          outline: "none", transition: "all 0.3s", fontFamily: "DM Sans",
                        }}
                      />
                    </div>

                    {error && (
                      <div style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "12px 16px", borderRadius: 12,
                        background: "#fef2f2", border: "1px solid #fecaca",
                      }}>
                        <span style={{ fontSize: 16 }}>⚠️</span>
                        <span style={{ fontSize: 13, color: "#dc2626" }}>{error}</span>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                      <motion.button type="button" onClick={() => setStep(1)}
                        whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}
                        style={{
                          padding: "16px 28px", borderRadius: 14, fontSize: 14, fontWeight: 700,
                          background: "#fff", border: "1.5px solid #e2ddd6", color: "#64748b",
                          cursor: "pointer", fontFamily: "DM Sans",
                        }}>← Back</motion.button>
                      <motion.button
                        type="submit"
                        disabled={loading}
                        whileHover={loading ? {} : { y: -2, boxShadow: `0 12px 40px ${GOLD}35` }}
                        whileTap={loading ? {} : { scale: 0.98 }}
                        style={{
                          flex: 1, padding: "16px 28px", borderRadius: 14, fontSize: 15, fontWeight: 800,
                          background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD}, ${GOLD_DARK})`,
                          border: "none", color: NAVY, cursor: loading ? "not-allowed" : "pointer",
                          opacity: loading ? 0.7 : 1, fontFamily: "Outfit",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                          position: "relative", overflow: "hidden",
                        }}
                      >
                        {loading ? (
                          <>
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              style={{ width: 16, height: 16, border: `2px solid ${NAVY}40`, borderTopColor: NAVY, borderRadius: "50%" }}
                            />
                            Submitting…
                          </>
                        ) : (
                          <>Submit Application →</>
                        )}
                      </motion.button>
                    </div>

                    <p style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                      🔒 Access granted only after manual verification · No spam
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </motion.div>
        </div>
      </div>

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px #34d39960; }
          50% { opacity: 0.4; box-shadow: 0 0 4px #34d39930; }
        }
        @media (max-width: 1024px) {
          .partner-left { display: none !important; }
          .partner-right { width: 100% !important; min-height: calc(100vh - 72px) !important; padding: 40px 24px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FORM FIELD COMPONENT
   ═══════════════════════════════════════════════════════════ */
function FormField({ label, required, type = "text", placeholder, value, onChange, focused, onFocus, onBlur }: {
  label: string; required?: boolean; type?: string; placeholder?: string;
  value: string; onChange: (v: string) => void;
  focused: boolean; onFocus: () => void; onBlur: () => void;
}) {
  return (
    <div>
      <label style={{
        display: "block", fontSize: 11, fontWeight: 800,
        textTransform: "uppercase", letterSpacing: "0.15em",
        color: "#475569", marginBottom: 10,
      }}>
        {label} {required && <span style={{ color: GOLD }}>*</span>}
      </label>
      <input
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        style={{
          width: "100%", borderRadius: 14, padding: "15px 18px",
          fontSize: 14, outline: "none",
          background: "#fff",
          border: `1.5px solid ${focused ? GOLD + "90" : "#e2ddd6"}`,
          boxShadow: focused ? `0 0 0 3px ${GOLD}12` : "none",
          color: "#14211D", transition: "all 0.3s", fontFamily: "DM Sans",
        }}
      />
    </div>
  );
}
