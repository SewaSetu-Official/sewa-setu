import { Check, Navigation } from "lucide-react";

const FEATURES = [
  "Live token number and how many patients are ahead",
  "Doctor delay notices, the moment they happen",
  "A recommended time to leave home",
  "Reminders so you never miss your slot",
];

export function QueueAware() {
  return (
    <section id="queue" className="scroll-mt-24 bg-page py-12 md:py-16">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-10">
        <div className="grid items-center gap-12 overflow-hidden rounded-[32px] bg-brand-deep p-7 text-white md:p-14 lg:grid-cols-[1fr_.9fr] lg:gap-[52px]">
          {/* Left */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-3.5 py-1.5 text-[13px] font-semibold text-[#CFE0D8]">
              The SewaSetu difference
            </span>
            <h2 className="font-display mt-5 text-[clamp(2rem,4.4vw,2.75rem)] font-bold leading-[1.04] tracking-[-0.03em] text-white">
              Don&apos;t just book.
              <br />
              Know <span className="text-accent">when to go.</span>
            </h2>
            <p className="mt-4 max-w-[430px] text-[17px] leading-[1.55] text-[#B9C4BF]">
              The real pain isn&apos;t booking — it&apos;s waiting. SewaSetu tracks your appointment
              live and tells you the right time to leave home.
            </p>

            <div className="mt-7 grid gap-3.5">
              {FEATURES.map((f) => (
                <div key={f} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] bg-[rgba(224,145,58,0.18)]">
                    <Check className="h-3.5 w-3.5 text-accent" strokeWidth={3} />
                  </span>
                  <span className="text-[15.5px] font-medium text-[#E3EAE7]">{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — live status mock (static demo) */}
          <div className="rounded-[24px] bg-white p-[22px] text-ink shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-ink-muted">Today · Cardiology OPD</span>
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-brand">
                <span className="relative h-2 w-2">
                  <span className="ss-pulse absolute inset-0 rounded-full bg-brand" />
                  <span className="absolute inset-0 rounded-full bg-brand" />
                </span>
                LIVE TRACKING
              </span>
            </div>

            <div className="mt-[18px] rounded-[16px] border border-[rgba(20,33,29,0.09)] p-[18px]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-semibold text-ink-muted">Your token</div>
                  <div className="font-display text-[34px] font-bold tracking-[-0.02em]">A-042</div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-semibold text-ink-muted">Now serving</div>
                  <div className="font-display text-[34px] font-bold tracking-[-0.02em] text-brand">A-038</div>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#EBE7DD]">
                <div className="h-full w-[62%] rounded-full bg-brand" />
              </div>
              <div className="mt-2 text-[12.5px] text-ink-muted">4 patients ahead of you</div>
            </div>

            <div className="mt-3.5 rounded-[14px] border border-[#ECDCB6] bg-[#FBF3E6] px-4 py-3.5">
              <div className="text-[13px] font-bold text-[#8A6418]">Dr. Anita is running ~20 min late</div>
              <div className="mt-0.5 text-[13px] text-[#8A6418]">
                Leave home by <b>11:25 AM</b> · ~15 min away
              </div>
            </div>

            <button
              type="button"
              className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-[14px] bg-brand py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-dark"
            >
              <Navigation className="h-4 w-4" />
              Get directions
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
