import Link from "next/link";

const FALLBACK_PARTNERS = [
  "Himalaya Hospital",
  "Annapurna Care",
  "Bagmati Medical",
  "Sagarmatha Health",
  "Lumbini Clinic",
  "Pokhara General",
  "Everest Medicare",
  "Gandaki Wellness",
  "Janaki Polyclinic",
];

const BADGE_COLORS = ["#0C6B57", "#0C6B57", "#C9912F", "#E0913A", "#7A3E8E", "#E0913A", "#7B857F", "#C9912F", "#0C6B57"];

function PartnerCard({ name, index }: { name: string; index: number }) {
  const initial = name.trim().charAt(0).toUpperCase() || "S";
  const color = BADGE_COLORS[index % BADGE_COLORS.length];
  return (
    <div className="flex h-[108px] w-[232px] flex-none items-center justify-center gap-3 rounded-md border border-[rgba(20,33,29,0.06)] bg-white shadow-[8px_10px_0_-2px_rgba(20,33,29,0.045),14px_20px_34px_-16px_rgba(20,33,29,0.42)]">
      <span
        className="font-display flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] text-base font-bold text-white"
        style={{ background: color }}
      >
        {initial}
      </span>
      <span className="font-display whitespace-nowrap text-[16.5px] font-bold tracking-[-0.015em] text-ink-soft">
        {name}
      </span>
    </div>
  );
}

export function TrustedNationwide({ partners }: { partners?: string[] }) {
  const list = partners && partners.length >= 4 ? partners : FALLBACK_PARTNERS;

  return (
    <section className="overflow-hidden bg-page py-16 md:py-[72px]">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-10">
        <span className="block text-[12.5px] font-semibold uppercase tracking-[0.32em] text-ink-muted">
          Who we work with
        </span>
        <h2 className="font-display mt-4 text-[clamp(2.2rem,4.6vw,3.375rem)] font-semibold leading-[1.02] tracking-[-0.025em] text-brand">
          Trusted nationwide
        </h2>
        <p className="mt-4 max-w-[440px] text-[17.5px] leading-[1.5] text-ink-soft">
          From national hospital networks to independent clinics, we power bookings and care
          journeys across all 7 provinces — every month.
        </p>
      </div>

      {/* marquee */}
      <div
        className="ss-marquee relative mt-12"
        style={{
          WebkitMaskImage: "linear-gradient(90deg,transparent,#000 5%,#000 95%,transparent)",
          maskImage: "linear-gradient(90deg,transparent,#000 5%,#000 95%,transparent)",
        }}
      >
        <div className="ss-marquee-track flex gap-[30px] px-3 pb-10 pt-3.5">
          {list.map((name, i) => (
            <PartnerCard key={`a-${i}`} name={name} index={i} />
          ))}
          {list.map((name, i) => (
            <PartnerCard key={`b-${i}`} name={name} index={i} />
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-10">
        <Link href="/search" className="text-[15px] font-semibold text-brand transition-colors hover:text-brand-dark">
          Browse all partner hospitals →
        </Link>
      </div>
    </section>
  );
}
