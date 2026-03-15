"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

/* ─────────────────────────────────────────────────────────────────────────────
   PREMIUM TIMING CONFIGURATION
───────────────────────────────────────────────────────────────────────────── */
const T = {
  aurora: 0.1,
  lightPool: 0.5,
  logoFocus: 0.8,
  ripple: 1.2,
  brandText: 1.5,
  tagline: 2.5,
  embers: 1.5,
  autoClose: 5500,
};

// High-end cinematic easing (Apple-like fluid motion)
const luxEase = [0.16, 1, 0.3, 1] as const;

/* ─────────────────────────────────────────────────────────────────────────────
   SCENE: Floating Embers (Organic Life / Healing)
───────────────────────────────────────────────────────────────────────────── */
function FloatingEmbers() {
  const embers = useMemo(() => Array.from({ length: 24 }).map((_, i) => ({
    id: i,
    x: 20 + Math.random() * 60, // Concentrate in middle 60% of screen
    size: Math.random() * 3 + 1,
    delay: Math.random() * 3,
    duration: 4 + Math.random() * 6,
    gold: Math.random() > 0.3,
  })), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
      {embers.map((ember) => (
        <motion.div
          key={ember.id}
          className="absolute rounded-full"
          style={{
            left: `${ember.x}%`,
            bottom: "-5%",
            width: ember.size,
            height: ember.size,
            background: ember.gold ? "#c8a96e" : "#7eb8d4",
            boxShadow: `0 0 ${ember.size * 3}px ${ember.gold ? "#c8a96e88" : "#7eb8d488"}`,
          }}
          initial={{ opacity: 0, y: 0, x: 0 }}
          animate={{
            opacity: [0, 0.8, 0.8, 0],
            y: -1000,
            x: Math.sin(ember.id) * 50, // Gentle drift left/right
          }}
          transition={{
            delay: T.embers + ember.delay,
            duration: ember.duration,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   SCENE: Dynamic Aurora Background
───────────────────────────────────────────────────────────────────────────── */
function EtherealAurora() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 mix-blend-screen">
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[40vh] rounded-[100%]"
        style={{
          background: "radial-gradient(ellipse, rgba(200,169,110,0.15) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
        initial={{ opacity: 0, scale: 0.8, rotate: -15 }}
        animate={{ opacity: 1, scale: [0.8, 1.2, 1], rotate: [ -15, 10, -5 ] }}
        transition={{ duration: 8, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vw] h-[50vh] rounded-[100%]"
        style={{
          background: "radial-gradient(ellipse, rgba(126,184,212,0.08) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
        initial={{ opacity: 0, scale: 1.2, rotate: 15 }}
        animate={{ opacity: 1, scale: [1.2, 0.9, 1.1], rotate: [ 15, -10, 5 ] }}
        transition={{ duration: 10, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   SCENE: Glassmorphism Shockwave
───────────────────────────────────────────────────────────────────────────── */
function GlassRipple() {
  return (
    <motion.div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#c8a96e]/20 z-0 pointer-events-none"
      style={{
        boxShadow: "inset 0 0 40px rgba(200,169,110,0.1), 0 0 40px rgba(200,169,110,0.1)",
        backdropFilter: "blur(4px)",
      }}
      initial={{ width: 100, height: 100, opacity: 0 }}
      animate={{ width: "120vw", height: "120vw", opacity: [0, 1, 0] }}
      transition={{ delay: T.ripple, duration: 3.5, ease: luxEase }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   SCENE: Cinematic Text Reveal
───────────────────────────────────────────────────────────────────────────── */
function BrandName() {
  const letters = "SEWA-SETU".split("");
  
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: T.brandText }
    }
  };

  const item = {
    hidden: { opacity: 0, filter: "blur(12px)", y: 20, scale: 0.9 },
    show: { 
      opacity: 1, 
      filter: "blur(0px)", 
      y: 0, 
      scale: 1,
      transition: { duration: 1.2, ease: luxEase }
    }
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex items-center justify-center tracking-[0.18em]"
    >
      {letters.map((ch, i) => {
        const isGold = ch === "-" || i > 4; // Colors "SETU" and "-" gold
        return (
          <motion.span
            key={i}
            variants={item}
            style={{
              fontFamily: "'Cinzel Decorative', 'Cinzel', serif",
              fontSize: "clamp(32px, 6vw, 56px)",
              fontWeight: 800,
              background: isGold
                ? "linear-gradient(180deg, #fef4cd 0%, #c8a96e 50%, #8a6225 100%)"
                : "linear-gradient(180deg, #ffffff 0%, #a4d0e8 50%, #528ba8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: `drop-shadow(0 4px 12px ${isGold ? "rgba(200,169,110,0.3)" : "rgba(126,184,212,0.3)"})`,
            }}
          >
            {ch}
          </motion.span>
        );
      })}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────────────────── */
export function LogoIntro({ onDoneAction }: { onDoneAction: () => void }) {
  const [exiting, setExiting] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const dismiss = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    setTimeout(onDoneAction, 1200);
  }, [exiting, onDoneAction]);

  useEffect(() => {
    if (prefersReducedMotion) {
      onDoneAction();
      return;
    }
    const t = setTimeout(dismiss, T.autoClose);
    return () => clearTimeout(t);
  }, [dismiss, prefersReducedMotion, onDoneAction]);

  if (prefersReducedMotion) return null;

  return (
    <AnimatePresence>
      {!exiting && (
        <motion.div
          key="intro"
          className="fixed inset-0 z-[200] overflow-hidden flex flex-col items-center justify-center select-none bg-[#02070e]"
          exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
          transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Base Atmosphere */}
          <EtherealAurora />
          <FloatingEmbers />
          <GlassRipple />

          {/* Central Light Pool that activates before the logo */}
          <motion.div
            className="absolute rounded-full z-0"
            style={{
              width: 300, height: 300,
              background: "radial-gradient(circle, rgba(200,169,110,0.15) 0%, transparent 60%)",
              filter: "blur(40px)",
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: T.lightPool, duration: 2, ease: "easeOut" }}
          />

          {/* Main Content Container (Breathing/Floating effect) */}
          <motion.div
            className="relative z-20 flex flex-col items-center"
            animate={{ y: [-5, 5, -5] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* LOGO: Camera pull-focus effect */}
            <motion.div
              initial={{ opacity: 0, scale: 1.3, filter: "blur(28px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ delay: T.logoFocus, duration: 2.2, ease: luxEase }}
              className="mb-8 relative"
            >
              {/* Outer soft glow halo */}
              <motion.div
                className="absolute rounded-full pointer-events-none"
                style={{
                  inset: -60,
                  background: "radial-gradient(circle, rgba(200,169,110,0.25) 0%, transparent 65%)",
                  filter: "blur(40px)",
                }}
                animate={{ opacity: [0.15, 0.4, 0.15], scale: [0.92, 1.12, 0.92] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
              />
              {/* Inner backlight flare */}
              <motion.div
                className="absolute rounded-full pointer-events-none"
                style={{
                  inset: -20,
                  background: "radial-gradient(circle, rgba(200,169,110,0.35) 0%, transparent 60%)",
                  filter: "blur(22px)",
                }}
                animate={{ opacity: [0.2, 0.45, 0.2], scale: [0.95, 1.08, 0.95] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              />
              {/* Gold ring */}
              <motion.div
                className="absolute rounded-full border border-[#c8a96e]/30 pointer-events-none"
                style={{ inset: -16 }}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: T.logoFocus + 1.2, duration: 1, ease: luxEase }}
              />
              {/* Second outer ring */}
              <motion.div
                className="absolute rounded-full border border-[#c8a96e]/15 pointer-events-none"
                style={{ inset: -34 }}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: T.logoFocus + 1.5, duration: 1.1, ease: luxEase }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/SewaSetu-Logo.svg"
                alt="Sewa-Setu"
                className="w-64 h-auto sm:w-72 md:w-80 lg:w-96 object-contain relative z-10 drop-shadow-[0_0_50px_rgba(200,169,110,0.45)]"
              />
            </motion.div>

            {/* Typography */}
            <BrandName />

            {/* Taglines */}
            <div className="flex flex-col items-center mt-6 space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 15, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: T.tagline, duration: 1.2, ease: luxEase }}
                className="flex items-center gap-4"
              >
                <div className="w-12 h-[1px] bg-gradient-to-r from-transparent to-[#c8a96e]/60" />
                <span className="font-serif text-[#a4d0e8] text-sm uppercase tracking-[0.4em]">
                  Connecting Healthcare
                </span>
                <div className="w-12 h-[1px] bg-gradient-to-l from-transparent to-[#c8a96e]/60" />
              </motion.div>

              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: T.tagline + 0.8, duration: 1.5 }}
                className="font-serif text-[#c8a96e]/50 text-xs tracking-[0.3em]"
              >
                सेवा • सेतु
              </motion.span>
            </div>
          </motion.div>

          {/* Premium Minimal Skip Button */}
          <motion.button
            className="absolute bottom-8 right-8 z-[110] group flex items-center gap-3 px-6 py-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            whileHover={{ opacity: 1 }}
            transition={{ delay: 2.0, duration: 1 }}
            onClick={dismiss}
          >
            <span className="font-serif text-[#c8a96e] text-[10px] uppercase tracking-[0.3em] group-hover:tracking-[0.4em] transition-all duration-500">
              Skip Intro
            </span>
            <div className="w-8 h-[1px] bg-[#c8a96e]/40 group-hover:w-12 group-hover:bg-[#c8a96e] transition-all duration-500" />
          </motion.button>

        </motion.div>
      )}
    </AnimatePresence>
  );
}