"use client";

import React from "react";
import { motion } from "framer-motion";
import { Search, ArrowLeftRight, CalendarCheck, BellRing, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

const WaveEyebrow = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-2.5 text-[12.5px] font-extrabold uppercase tracking-[0.12em] text-brand">
    <svg width="22" height="9" viewBox="0 0 22 9" fill="none" className="shrink-0" aria-hidden>
      <path d="M1 8C5 2 17 2 21 8" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
    {children}
  </span>
);

// ── Per-step mini visuals (lively, on-brand — not flat placeholders) ──

const SearchMini = () => (
  <div className="flex h-full flex-col justify-center gap-2.5">
    <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 shadow-[0_6px_16px_-10px_rgba(20,33,29,0.4)]">
      <Search className="h-3.5 w-3.5 text-ink-muted" />
      <span className="text-[12px] font-medium text-ink-muted">fever, cough…</span>
    </div>
    <div className="flex flex-wrap gap-1.5">
      {["Fever", "Skin", "Child"].map((t, i) => (
        <span
          key={t}
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            i === 0 ? "bg-brand text-white" : "bg-white text-ink-soft"
          }`}
        >
          {t}
        </span>
      ))}
    </div>
  </div>
);

const CompareMini = () => (
  <div className="flex h-full flex-col justify-center gap-2">
    {[
      { n: "Dr. Anita", r: "4.9", f: "Rs 1,200", top: true },
      { n: "Dr. Bishal", r: "4.8", f: "Rs 900", top: false },
    ].map((d) => (
      <div
        key={d.n}
        className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
          d.top ? "bg-white shadow-[0_6px_16px_-10px_rgba(20,33,29,0.45)] ring-1 ring-brand/20" : "bg-white/60"
        }`}
      >
        <span className="h-7 w-7 shrink-0 rounded-full bg-brand-soft" />
        <span className="flex-1 truncate text-[12px] font-bold text-ink">{d.n}</span>
        <span className="flex items-center gap-0.5 text-[11px] font-semibold text-ink-soft">
          <Star className="h-3 w-3 fill-accent text-accent" />
          {d.r}
        </span>
        <span className="text-[11px] font-bold text-brand">{d.f}</span>
      </div>
    ))}
  </div>
);

const CalendarMini = () => (
  <div className="flex h-full flex-col justify-center gap-2.5">
    <div className="grid grid-cols-5 gap-1.5">
      {[12, 13, 14, 15, 16].map((d, i) => (
        <span
          key={d}
          className={`flex aspect-square items-center justify-center rounded-lg text-[11px] font-bold ${
            i === 2 ? "bg-brand text-white shadow-[0_6px_16px_-8px_rgba(12,107,87,0.7)]" : "bg-white text-ink-soft"
          }`}
        >
          {d}
        </span>
      ))}
    </div>
    <div className="flex gap-1.5">
      {["9:00", "11:30", "2:00"].map((s, i) => (
        <span
          key={s}
          className={`rounded-md px-2 py-1 text-[10.5px] font-semibold ${
            i === 1 ? "bg-accent-soft text-[#8A6418]" : "bg-white text-ink-muted"
          }`}
        >
          {s}
        </span>
      ))}
    </div>
  </div>
);

const ReminderMini = () => (
  <div className="flex h-full flex-col justify-center gap-2">
    <div className="rounded-xl bg-white px-3 py-2.5 shadow-[0_6px_16px_-10px_rgba(20,33,29,0.4)]">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-bold text-ink">Token A-042</span>
        <span className="font-semibold text-brand">4 ahead</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#EBE7DD]">
        <div className="h-full w-[62%] rounded-full bg-brand" />
      </div>
    </div>
    <div className="flex items-center gap-2 rounded-xl bg-accent-soft px-3 py-2 text-[11px] font-bold text-[#8A6418]">
      <BellRing className="h-3.5 w-3.5" />
      Leave home by 11:25 AM
    </div>
  </div>
);

type Step = {
  num: string;
  title: string;
  body: string;
  icon: LucideIcon;
  tone: "brand" | "accent";
  numColor: string;
  Visual: () => React.JSX.Element;
};

const STEPS: Step[] = [
  { num: "01", title: "Tell us what’s wrong", body: "Search by symptom, specialty, doctor, or hospital near you.", icon: Search, tone: "brand", numColor: "#CFE0D8", Visual: SearchMini },
  { num: "02", title: "Compare your options", body: "See doctors, fees, ratings, and real-time available slots side by side.", icon: ArrowLeftRight, tone: "accent", numColor: "#ECDCB6", Visual: CompareMini },
  { num: "03", title: "Pick a date & time", body: "Choose a slot that works for you and confirm in seconds — for free.", icon: CalendarCheck, tone: "brand", numColor: "#CFE0D8", Visual: CalendarMini },
  { num: "04", title: "Know when to go", body: "Get reminders and live queue updates so you arrive at the right moment.", icon: BellRing, tone: "accent", numColor: "#ECCED3", Visual: ReminderMini },
];

function StepCard({ step, index }: { step: Step; index: number }) {
  const Icon = step.icon;
  const Visual = step.Visual;
  const stagger = index % 2 === 1; // push 02 & 04 down on the 4-col layout
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease, delay: index * 0.08 }}
      className={`group flex flex-col rounded-[22px] border border-[rgba(20,33,29,0.07)] bg-white p-6 shadow-[0_18px_46px_-30px_rgba(20,33,29,0.4)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_56px_-28px_rgba(20,33,29,0.46)] ${
        stagger ? "xl:mt-[52px]" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="font-display text-[52px] font-bold leading-[0.85]" style={{ color: step.numColor }}>
          {step.num}
        </span>
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] ${
            step.tone === "brand" ? "bg-brand-soft text-brand" : "bg-accent-soft text-accent"
          }`}
        >
          <Icon className="h-[22px] w-[22px]" />
        </span>
      </div>
      <h3 className="font-display mt-[18px] text-[20px] font-bold tracking-[-0.01em] text-ink">{step.title}</h3>
      <p className="mt-2.5 text-[14.5px] leading-relaxed text-ink-soft">{step.body}</p>
      <div className="mt-[18px] h-[152px] rounded-[14px] bg-brand-soft/55 p-3">
        <Visual />
      </div>
    </motion.div>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 bg-page py-20 md:py-24">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-10">
        {/* header */}
        <div className="mb-11 flex flex-wrap items-end justify-between gap-6">
          <div>
            <WaveEyebrow>How it works</WaveEyebrow>
            <h2 className="font-display mt-3 text-[clamp(2rem,4vw,2.625rem)] font-bold leading-[1.05] tracking-[-0.025em] text-ink">
              Book care in four simple steps
            </h2>
          </div>
          <p className="max-w-[340px] text-base leading-relaxed text-ink-soft">
            From feeling unwell to a confirmed slot — without a single phone call or physical visit.
          </p>
        </div>

        {/* wave connector */}
        <div aria-hidden className="hidden px-[3%] pb-3.5 pt-1.5 opacity-50 xl:block">
          <svg viewBox="0 0 1200 50" width="100%" height="44" fill="none" preserveAspectRatio="none">
            <path
              d="M0 25 C 150 -6 300 -6 450 25 S 750 56 900 25 S 1150 -6 1200 25"
              stroke="var(--accent)"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* steps */}
        <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((s, i) => (
            <StepCard key={s.num} step={s} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default HowItWorks;
