"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Search, ArrowUpRight, Check, Stethoscope } from "lucide-react";
import { LogoIntro } from "@/components/logo-intro";

const SEARCH_TABS = ["Doctor", "Specialty", "Hospital"] as const;
type SearchTab = (typeof SEARCH_TABS)[number];

const PLACEHOLDERS: Record<SearchTab, string> = {
  Doctor: "Search doctors by name…",
  Specialty: "e.g. Cardiology, Skin, Pediatrics…",
  Hospital: "Search hospitals near you…",
};

const ease = [0.16, 1, 0.3, 1] as const;

export function HeroSection({
  hospitalCount,
  provinceCount = 7,
  patientCount = "9k",
}: {
  hospitalCount?: number;
  provinceCount?: number;
  patientCount?: string;
}) {
  const router = useRouter();
  const [showIntro, setShowIntro] = useState(
    () => typeof window !== "undefined" && !window.sessionStorage.getItem("ss-intro")
  );
  const [tab, setTab] = useState<SearchTab>("Doctor");
  const [query, setQuery] = useState("");

  const handleIntroDone = () => {
    sessionStorage.setItem("ss-intro", "1");
    setShowIntro(false);
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  return (
    <>
      {showIntro && <LogoIntro onDoneAction={handleIntroDone} />}

      <section id="top" className="relative overflow-hidden bg-page pt-28 pb-16 md:pt-32 md:pb-20">
        {/* soft ambient wash */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-24 h-[460px] w-[460px] rounded-full opacity-60"
          style={{ background: "radial-gradient(circle, rgba(12,107,87,0.10), transparent 65%)" }}
        />

        <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1.04fr_.96fr] lg:gap-14 lg:px-10">

          {/* ── Left ── */}
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(20,33,29,0.09)] bg-white px-3.5 py-1.5 text-[13px] font-semibold text-ink-soft">
              <span className="h-[7px] w-[7px] rounded-full bg-accent" />
              Nepal&apos;s healthcare access platform
            </span>

            <h1 className="font-display mt-5 text-[clamp(2.6rem,6vw,4rem)] font-bold leading-[1.02] tracking-[-0.03em] text-ink">
              Care without
              <br />
              the queue.
            </h1>

            <p className="mt-5 max-w-[480px] text-[17px] leading-relaxed text-ink-soft sm:text-lg">
              Find the right doctor, compare hospitals near you, and book your appointment
              online — then arrive exactly when it&apos;s your turn. No more 5 a.m. queues.
            </p>

            {/* search card */}
            <form
              onSubmit={submitSearch}
              className="mt-7 max-w-[520px] rounded-[20px] border border-[rgba(20,33,29,0.08)] bg-white p-3.5 shadow-[0_24px_50px_-28px_rgba(20,33,29,0.28)]"
            >
              <div className="mb-3 flex gap-1.5">
                {SEARCH_TABS.map((t) => {
                  const active = tab === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTab(t)}
                      className={`rounded-full px-4 py-2 text-[13.5px] font-semibold transition-colors ${
                        active ? "bg-brand text-white" : "bg-page text-ink-soft hover:bg-brand-soft"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2.5">
                <div className="flex flex-1 items-center gap-2.5 rounded-[13px] bg-page px-4 py-3">
                  <Search className="h-[18px] w-[18px] shrink-0 text-ink-muted" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={PLACEHOLDERS[tab]}
                    aria-label={`Search ${tab}`}
                    className="w-full border-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-[13px] bg-brand px-5 py-3 text-[15px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-brand-dark"
                >
                  Search
                </button>
              </div>
            </form>

            {/* social proof */}
            <div className="mt-6 flex items-center gap-3">
              <div className="flex">
                <span className="h-8 w-8 rounded-full border-2 border-page bg-[#CFE0D8]" />
                <span className="-ml-2.5 h-8 w-8 rounded-full border-2 border-page bg-[#E7D3B6]" />
                <span className="-ml-2.5 h-8 w-8 rounded-full border-2 border-page bg-[#C8D4E2]" />
                <span className="-ml-2.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-page bg-brand text-[11px] font-bold text-white">
                  +{patientCount}
                </span>
              </div>
              <span className="text-sm font-medium text-ink-soft">
                Booked by patients across all {provinceCount} provinces
              </span>
            </div>
          </motion.div>

          {/* ── Right (visual) ── */}
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.1 }}
            className="relative hidden pt-4 lg:block"
          >
            <div className="grid grid-cols-[1.4fr_1fr] items-stretch gap-3.5">
              {/* portrait */}
              <div className="relative h-[520px] overflow-hidden rounded-[24px] bg-brand-soft ring-1 ring-[rgba(20,33,29,0.06)] shadow-[0_30px_60px_-30px_rgba(20,33,29,0.35)]">
                <Image
                  src="/herosectionmain.svg"
                  alt="Trusted care across Nepal"
                  fill
                  priority
                  sizes="(max-width: 1024px) 0vw, 40vw"
                  className="object-cover object-top"
                />
              </div>

              {/* right column */}
              <div className="flex flex-col gap-3.5">
                {/* stat card */}
                <div className="rounded-[22px] bg-brand-soft p-5">
                  <div className="flex items-start justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-ink-muted">
                      — Saves up to
                    </span>
                    <svg width="30" height="30" viewBox="0 0 36 36" aria-hidden>
                      <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(20,33,29,.13)" strokeWidth="4" />
                      <circle cx="18" cy="18" r="15" fill="none" stroke="var(--brand)" strokeWidth="4" strokeLinecap="round" strokeDasharray="68 94" transform="rotate(-90 18 18)" />
                    </svg>
                  </div>
                  <div className="font-display mt-3.5 text-[42px] font-bold leading-none tracking-[-0.03em] text-ink">
                    5 hrs
                  </div>
                  <div className="mt-1.5 text-[13.5px] font-medium text-ink-soft">
                    saved every hospital visit
                  </div>
                </div>

                {/* secondary image card (design layout: chips overlay the photo) */}
                <div className="relative min-h-[236px] flex-1 overflow-hidden rounded-[22px] bg-brand-soft ring-1 ring-[rgba(20,33,29,0.06)]">
                  <Image
                    src="/grande-hopsital.webp"
                    alt="Verified hospitals"
                    fill
                    sizes="(max-width: 1024px) 0vw, 28vw"
                    className="object-cover"
                  />
                  <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center justify-between">
                    <span className="rounded-full bg-white/95 px-3 py-1.5 text-[13px] font-bold text-ink backdrop-blur">
                      Verified doctors
                    </span>
                    <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/95">
                      <ArrowUpRight className="h-3.5 w-3.5 text-ink" />
                    </span>
                  </div>
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                </div>
              </div>
            </div>

            {/* floating: GREEN — top-center on the column seam */}
            <div className="ss-float absolute left-[57%] top-0 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-3.5 py-2 shadow-[0_14px_30px_-12px_rgba(20,33,29,0.35)]">
              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-brand-soft">
                <Check className="h-3.5 w-3.5 text-brand" strokeWidth={3} />
              </span>
              <span className="text-[13px] font-bold text-ink">Know when to go</span>
            </div>

            {/* floating: RED — left edge, upper quarter */}
            <div className="ss-float2 absolute -left-4 top-[24%] z-10 flex items-center gap-2 rounded-full bg-white px-3.5 py-2 shadow-[0_14px_30px_-12px_rgba(20,33,29,0.35)]">
              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-brand-soft">
                <Check className="h-3.5 w-3.5 text-brand" strokeWidth={3} />
              </span>
              <span className="text-[13px] font-bold text-ink">No more 5 a.m. lines</span>
            </div>

            {/* floating: YELLOW — department card (title on top, pills below) */}
            <div className="absolute left-[57%] top-[80%] z-20 w-[280px] -translate-x-1/2 rounded-[18px] bg-white p-4 shadow-[0_24px_50px_-20px_rgba(20,33,29,0.42)]">
              <div className="mb-2.5 text-[14px] font-bold text-ink">
                {hospitalCount ? `${hospitalCount}+ hospitals onboard` : "Find the right department"}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-page px-3 py-1.5 text-[12.5px] font-semibold text-ink-soft">Fever</span>
                <span className="rounded-full bg-page px-3 py-1.5 text-[12.5px] font-semibold text-ink-soft">Skin</span>
                <span className="rounded-full bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-white">Child health</span>
              </div>
            </div>

            {/* floating: PURPLE — specialty badge with a 3-sector ring */}
            <div className="ss-float absolute -right-3 top-[55%] z-30 flex h-[82px] w-[82px] items-center justify-center rounded-full bg-white shadow-[0_18px_36px_-14px_rgba(20,33,29,0.45)]">
              <svg viewBox="0 0 82 82" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
                {[
                  { color: "#0C6B57", offset: 0 },
                  { color: "#E0913A", offset: -77 },
                  { color: "#7A3E8E", offset: -154 },
                ].map((s, i) => (
                  <circle
                    key={i}
                    cx="41"
                    cy="41"
                    r="37"
                    fill="none"
                    stroke={s.color}
                    strokeWidth="3"
                    strokeDasharray="69 163"
                    strokeDashoffset={s.offset}
                    strokeLinecap="round"
                  />
                ))}
              </svg>
              <div className="relative z-10 flex flex-col items-center text-center">
                <Stethoscope className="h-5 w-5 text-brand" />
                <span className="mt-0.5 text-[9.5px] font-bold text-ink-soft">Cardiology</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
