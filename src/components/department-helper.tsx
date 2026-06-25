"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

// Curated symptom → department guidance. The CTA runs a real search on /search.
const SYMPTOMS = [
  { label: "Fever / cough",      dept: "General Physician",      note: "For fever, cough, body ache, and common everyday illness." },
  { label: "Skin problem",       dept: "Dermatology",            note: "For rashes, acne, allergies, and skin or hair concerns." },
  { label: "Child health",       dept: "Pediatrics",             note: "For your child’s checkups, fever, growth, and vaccines." },
  { label: "Pregnancy",          dept: "Obstetrics & Gynecology",note: "For pregnancy care, checkups, and women’s health." },
  { label: "Bone or joint pain", dept: "Orthopedics",            note: "For fractures, back pain, and joint or muscle problems." },
  { label: "Heart problem",      dept: "Cardiology",             note: "For chest pain, blood pressure, and heart-related concerns." },
  { label: "Mental health",      dept: "Psychiatry",             note: "For stress, anxiety, sleep, and emotional wellbeing." },
  { label: "Stomach issue",      dept: "Gastroenterology",       note: "For stomach pain, acidity, and digestion problems." },
] as const;

const WaveEyebrow = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-2.5 text-[12.5px] font-extrabold uppercase tracking-[0.12em] text-brand">
    <svg width="22" height="9" viewBox="0 0 22 9" fill="none" className="shrink-0" aria-hidden>
      <path d="M1 8C5 2 17 2 21 8" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
    {children}
  </span>
);

export function DepartmentHelper() {
  const [active, setActive] = useState(0);
  const selected = SYMPTOMS[active];
  const searchHref = `/search?q=${encodeURIComponent(selected.dept)}`;

  return (
    <section id="department-helper" className="bg-page py-12 md:py-16">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-10">
        <div className="grid items-center gap-12 rounded-[28px] border border-[rgba(20,33,29,0.07)] bg-white p-7 md:grid-cols-[1fr_.82fr] md:p-12">
          {/* Left */}
          <div>
            <WaveEyebrow>Not sure who to see?</WaveEyebrow>
            <h2 className="font-display mt-3 text-[clamp(1.8rem,3.4vw,2.375rem)] font-bold leading-[1.06] tracking-[-0.025em] text-ink">
              Find the right department
            </h2>
            <p className="mb-7 mt-3.5 max-w-[420px] text-base leading-relaxed text-ink-soft">
              Tell us what&apos;s bothering you and we&apos;ll point you to the right specialist. Tap a concern below.
            </p>

            <div className="flex flex-wrap gap-2.5">
              {SYMPTOMS.map((s, i) => {
                const isActive = i === active;
                return (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setActive(i)}
                    aria-pressed={isActive}
                    className={`rounded-full border-[1.5px] px-4 py-2.5 text-sm font-semibold transition-all ${
                      isActive
                        ? "border-brand bg-brand text-white"
                        : "border-[rgba(20,33,29,0.12)] bg-white text-ink-soft hover:border-brand/45 hover:text-brand"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>

            <p className="mt-6 max-w-[420px] text-[12.5px] leading-relaxed text-ink-muted">
              SewaSetu guides you to the right department — it does not diagnose any condition.
            </p>
          </div>

          {/* Right — suggestion panel */}
          <div className="rounded-[22px] bg-brand-soft p-8 text-center">
            <div className="text-[13px] font-bold uppercase tracking-[0.04em] text-brand">We suggest</div>
            <motion.div
              key={selected.dept}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="font-display mt-3.5 text-[clamp(1.6rem,3vw,2.125rem)] font-bold leading-[1.1] tracking-[-0.02em] text-ink">
                {selected.dept}
              </div>
              <p className="mx-auto mt-3 max-w-[280px] text-[14.5px] leading-relaxed text-ink-soft">
                {selected.note}
              </p>
            </motion.div>
            <Link
              href={searchHref}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-[14.5px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-brand-dark"
            >
              See available doctors
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
