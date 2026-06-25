import { Check, Plus } from "lucide-react";

const WaveEyebrow = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-2.5 text-[12.5px] font-extrabold uppercase tracking-[0.12em] text-brand">
    <svg width="22" height="9" viewBox="0 0 22 9" fill="none" className="shrink-0" aria-hidden>
      <path d="M1 8C5 2 17 2 21 8" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
    {children}
  </span>
);

const FAMILY = [
  { name: "Sushma Adhikari", rel: "Myself", initial: "S", av: "#0C6B57", checked: true },
  { name: "Ramesh Adhikari", rel: "Father", initial: "R", av: "#0C6B57", checked: false },
  { name: "Gita Adhikari", rel: "Mother", initial: "G", av: "#E0913A", checked: false },
  { name: "Aarav Adhikari", rel: "Child", initial: "A", av: "#E0913A", checked: false },
];

export function FamilyBooking() {
  return (
    <section className="bg-page py-16 md:py-20">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-10">
        <div className="grid items-center gap-12 lg:grid-cols-[.92fr_1fr] lg:gap-[52px]">
          {/* Left — mock card */}
          <div className="rounded-[26px] bg-brand-soft p-6 md:p-9">
            <div className="rounded-[18px] bg-white p-5 shadow-[0_20px_40px_-26px_rgba(20,33,29,0.3)]">
              <div className="mb-3.5 text-[13px] font-bold text-ink-muted">Booking appointment for</div>
              <div className="flex flex-col gap-2.5">
                {FAMILY.map((m) => (
                  <div
                    key={m.name}
                    className="flex items-center gap-3 rounded-[13px] border-[1.5px] px-3 py-2.5"
                    style={{
                      borderColor: m.checked ? "#0C6B57" : "rgba(20,33,29,0.09)",
                      background: m.checked ? "var(--brand-soft)" : "#fff",
                    }}
                  >
                    <span
                      className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[14px] font-bold text-white"
                      style={{ background: m.av }}
                    >
                      {m.initial}
                    </span>
                    <div className="flex-1">
                      <div className="text-[14.5px] font-bold text-ink">{m.name}</div>
                      <div className="text-[12px] text-ink-muted">{m.rel}</div>
                    </div>
                    {m.checked && (
                      <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-brand">
                        <Check className="h-3 w-3 text-white" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="flex items-center justify-center gap-1.5 rounded-[13px] border-[1.5px] border-dashed border-[rgba(20,33,29,0.18)] py-2.5 text-[14px] font-semibold text-ink-soft transition-colors hover:border-brand/50 hover:text-brand"
                >
                  <Plus className="h-4 w-4" />
                  Add family member
                </button>
              </div>
            </div>
          </div>

          {/* Right — copy */}
          <div>
            <WaveEyebrow>Built for Nepali families</WaveEyebrow>
            <h2 className="font-display mt-3 text-[clamp(2rem,4vw,2.625rem)] font-bold leading-[1.05] tracking-[-0.025em] text-ink">
              Book for the whole family
            </h2>
            <p className="mt-4 max-w-[440px] text-[17px] leading-[1.55] text-ink-soft">
              Manage appointments for your parents, grandparents, children and spouse from one account.
              Save their details once and book in seconds — every time.
            </p>
            <div className="mt-7 flex gap-8">
              <div>
                <div className="font-display text-[30px] font-bold text-brand">1 account</div>
                <div className="text-[13.5px] text-ink-muted">for everyone you care for</div>
              </div>
              <div>
                <div className="font-display text-[30px] font-bold text-brand">Saved profiles</div>
                <div className="text-[13.5px] text-ink-muted">no re-typing details</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
