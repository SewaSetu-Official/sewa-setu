"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Heart, Shield, Zap, Globe, Search, CalendarCheck } from "lucide-react";
import Link from "next/link";
import { LogoIntro } from "@/components/logo-intro";

const trustItems = [
  { icon: Heart, text: "Verified Hospitals" },
  { icon: Shield, text: "Secure Payments" },
  { icon: Zap, text: "Instant Appointment" },
  { icon: Globe, text: "Nationwide Access" },
];

export function HeroSection() {
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    const seen = sessionStorage.getItem("ss-intro");
    if (!seen) setShowIntro(true);
  }, []);

  const handleIntroDone = () => {
    sessionStorage.setItem("ss-intro", "1");
    setShowIntro(false);
  };

  return (
    <>
      {showIntro && <LogoIntro onDoneAction={handleIntroDone} />}

      <section className="relative min-h-[92vh] overflow-hidden bg-[#0a1628] pt-5 sm:pt-6">

        <img
          src="/herosectionmain.svg"
          alt=""
          className="absolute right-0 top-1 h-full w-auto max-w-[75%] object-cover object-right"
          style={{
            maskImage:
              "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.3) 15%, black 40%), linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
            maskComposite: "intersect",
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.3) 15%, black 40%), linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
            WebkitMaskComposite: "source-in",
          }}
        />

        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, #0a1628 0%, #0a1628 25%, rgba(10,22,40,0.6) 50%, transparent 70%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to bottom, #0a1628 0%, transparent 25%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to top, #0a1628 0%, transparent 30%)",
          }}
        />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 70% 40%, rgba(200,169,110,0.06) 0%, transparent 60%)" }} />

        {/* ─── Content pushed to right side ─── */}
        <div
          className="relative z-10 flex min-h-[92vh] w-full items-center pt-28 pb-40 md:pt-32"
          style={{ paddingLeft: "9%", paddingRight: "3%" }}
        >
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-xl"
             style={{ marginTop: "40px" }}
          >
            <h1 className="mb-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
              Connecting Nepal
              <br />
              <span className="text-white">to Better Healthcare.</span>
            </h1>

            <p className="mb-8 max-w-lg text-base leading-relaxed text-slate-300 sm:text-lg">
              Sewa-Setu connects patients with trusted hospitals
              and doctors across Nepal. Search, compare and
              book appointments instantly from anywhere.
            </p>

            <div className="mb-8 flex flex-col items-start gap-4 sm:flex-row">
              <Link
                href="/search"
                className="inline-flex items-center gap-2.5 rounded-xl px-8 py-4 text-base font-bold text-[#0f1e38] bg-gradient-to-r from-[#c8a96e] to-[#a88b50] shadow-lg shadow-[rgba(200,169,110,0.32)] transition-all hover:scale-105 hover:shadow-xl hover:shadow-[rgba(200,169,110,0.45)]"
              >
                <Search className="h-5 w-5" />
                Search Doctors
              </Link>

              <Link
                href="/book"
                className="inline-flex items-center gap-2.5 rounded-xl border-2 border-[#c8a96e]/70 bg-transparent px-8 py-4 text-base font-semibold text-[#c8a96e] transition-all hover:border-[#c8a96e] hover:bg-[#c8a96e]/10"
              >
                <CalendarCheck className="h-5 w-5" />
                Book Appointment
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {trustItems.map((item, i) => (
                <motion.div
                  key={item.text}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
                  className="flex items-center gap-2 text-sm text-white/90 sm:text-base"
                >
                  <item.icon className="h-5 w-5 shrink-0 text-[#c8a96e]" />
                  <span className="font-medium">{item.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}