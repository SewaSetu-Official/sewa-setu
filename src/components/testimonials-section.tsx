import { Star } from "lucide-react";

const FEATURE_QUOTE = {
  text: "My father needed a cardiologist. I booked from home in Butwal, picked the time, and SewaSetu told us exactly when to leave. No 5 a.m. line, no wasted day.",
  name: "Sushma Adhikari",
  loc: "Butwal, Lumbini Province",
  initial: "S",
};

const QUOTES = [
  {
    text: "I found a skin doctor in Pokhara and booked the same evening. The reminder and token info made the visit so calm.",
    name: "Prakash Rai",
    loc: "Pokhara, Gandaki",
  },
  {
    text: "Booking for my mother's checkup used to mean a full day off work. Now it's five minutes on my phone.",
    name: "Anjali Maharjan",
    loc: "Kathmandu, Bagmati",
  },
];

const Stars = () => (
  <div className="mb-3 flex gap-1">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} className="h-[15px] w-[15px] fill-accent text-accent" />
    ))}
  </div>
);

export function TestimonialsSection() {
  return (
    <section className="bg-page py-16 md:py-20">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-10">
        <h2 className="font-display mb-9 max-w-[560px] text-[clamp(2rem,4vw,2.625rem)] font-bold leading-[1.05] tracking-[-0.025em] text-ink">
          Patients across Nepal, finally out of the queue
        </h2>

        <div className="grid gap-[22px] lg:grid-cols-[1.1fr_1fr]">
          {/* Feature quote (dark) */}
          <div className="flex flex-col rounded-[24px] bg-brand-deep p-9 text-white">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M10 8H6a3 3 0 0 0-3 3v3a3 3 0 0 0 3 3h2v-3H6v-2h4zM21 8h-4a3 3 0 0 0-3 3v3a3 3 0 0 0 3 3h2v-3h-2v-2h4z"
                fill="rgba(224,145,58,.6)"
              />
            </svg>
            <p className="font-display mt-4 text-[24px] font-medium leading-[1.4] tracking-[-0.01em]">
              &ldquo;{FEATURE_QUOTE.text}&rdquo;
            </p>
            <div className="mt-auto flex items-center gap-3.5 pt-7">
              <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-brand text-lg font-bold text-white">
                {FEATURE_QUOTE.initial}
              </span>
              <div>
                <div className="text-[15px] font-bold">{FEATURE_QUOTE.name}</div>
                <div className="text-[13px] text-[#9FB0AA]">{FEATURE_QUOTE.loc}</div>
              </div>
            </div>
          </div>

          {/* Two light quotes */}
          <div className="grid gap-[22px]">
            {QUOTES.map((q) => (
              <div
                key={q.name}
                className="flex flex-col rounded-[22px] border border-[rgba(20,33,29,0.07)] bg-white p-7"
              >
                <Stars />
                <p className="text-[15.5px] leading-[1.55] text-[#2C3733]">{q.text}</p>
                <div className="mt-auto pt-5">
                  <div className="text-[14px] font-bold text-ink">{q.name}</div>
                  <div className="text-[12.5px] text-ink-muted">{q.loc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
