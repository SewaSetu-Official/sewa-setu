import { Clock, Target, Lock, ShieldCheck, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const WaveEyebrow = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-2.5 text-[12.5px] font-extrabold uppercase tracking-[0.12em] text-brand">
    <svg width="22" height="9" viewBox="0 0 22 9" fill="none" className="shrink-0" aria-hidden>
      <path d="M1 8C5 2 17 2 21 8" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
    {children}
  </span>
);

const CARDS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Clock,
    title: "Live hospital sync",
    body: "We connect directly to hospital systems, so the slots and queue updates you see are always real-time — never outdated guesses.",
  },
  {
    icon: Target,
    title: "Right-department matching",
    body: "Smart guidance points you to the correct specialist for your concern — so you never waste a visit in the wrong line.",
  },
  {
    icon: Lock,
    title: "Private & secure",
    body: "Your health details are encrypted end-to-end, never sold, and shared only with the hospital you choose to book.",
  },
  {
    icon: ShieldCheck,
    title: "Verified providers",
    body: "Every doctor and hospital is verified, with ratings from real patients — so you always know exactly who you're seeing.",
  },
];

const TRUST_STRIP = [
  "End-to-end encryption",
  "Verified doctors & hospitals",
  "We never sell your data",
  "Built & hosted in Nepal",
];

export function BuiltOnTrust() {
  return (
    <section id="trust" className="scroll-mt-24 bg-page py-16 md:py-20">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-10">
        {/* header */}
        <div className="mx-auto mb-11 max-w-[640px] text-center">
          <WaveEyebrow>Built on trust</WaveEyebrow>
          <h2 className="font-display mt-3 text-[clamp(2rem,4vw,2.625rem)] font-bold leading-[1.05] tracking-[-0.025em] text-ink">
            A smarter system you can rely on
          </h2>
          <p className="mt-3.5 text-[17px] leading-[1.55] text-ink-soft">
            SewaSetu connects directly to hospitals, so everything you see is real, live, and secure —
            not a guess. Here&apos;s what&apos;s working behind the scenes.
          </p>
        </div>

        {/* cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {CARDS.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-[20px] border border-[rgba(20,33,29,0.07)] bg-white p-7 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_56px_-30px_rgba(20,33,29,0.4)]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-[13px] bg-brand-soft text-brand">
                <Icon className="h-6 w-6" />
              </span>
              <h3 className="font-display mt-[18px] text-[19px] font-bold tracking-[-0.01em] text-ink">{title}</h3>
              <p className="mt-2.5 text-[14.5px] leading-[1.5] text-ink-soft">{body}</p>
            </div>
          ))}
        </div>

        {/* trust strip */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[20px] bg-brand-deep px-6 py-6 md:px-9">
          {TRUST_STRIP.map((t) => (
            <span key={t} className="flex items-center gap-2.5 text-[15px] font-semibold text-[#E3EAE7]">
              <Check className="h-[18px] w-[18px] text-accent" strokeWidth={2.6} />
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
