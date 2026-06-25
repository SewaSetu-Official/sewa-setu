import Link from "next/link";

export type SpecialtyItem = { name: string; slug: string; count: number };

// tint / border / dot accents cycled across the grid (from the redesign palette)
const ACCENTS = [
  { dot: "#0C6B57", tint: "#E6F0EC", bd: "rgba(12,107,87,.14)" },
  { dot: "#C9912F", tint: "#F6ECD7", bd: "rgba(224,145,58,.18)" },
  { dot: "#0C6B57", tint: "#E6F0EC", bd: "rgba(12,107,87,.15)" },
  { dot: "#E0913A", tint: "#F6ECD7", bd: "rgba(224,145,58,.15)" },
  { dot: "#7A3E8E", tint: "#F0E9F3", bd: "rgba(122,62,142,.15)" },
  { dot: "#E0913A", tint: "#E6F0EC", bd: "rgba(224,145,58,.15)" },
  { dot: "#C9912F", tint: "#F6ECD7", bd: "rgba(181,133,42,.18)" },
  { dot: "#7B857F", tint: "#E6F0EC", bd: "rgba(74,107,90,.15)" },
];

export function SpecialtiesGrid({ specialties, total }: { specialties: SpecialtyItem[]; total: number }) {
  if (!specialties.length) return null;

  return (
    <section id="specialties" className="scroll-mt-24 bg-page py-16 md:py-20">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-10">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-6">
          <h2 className="font-display text-[clamp(2rem,4vw,2.625rem)] font-bold leading-[1.05] tracking-[-0.025em] text-ink">
            Browse by specialty
          </h2>
          <Link href="/search" className="text-[15px] font-semibold text-brand transition-colors hover:text-brand-dark">
            View all {total} specialties →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {specialties.map((sp, i) => {
            const a = ACCENTS[i % ACCENTS.length];
            return (
              <Link
                key={sp.slug}
                href={`/search?q=${encodeURIComponent(sp.name)}`}
                className="flex min-h-[128px] flex-col gap-3.5 rounded-[18px] border p-[22px] transition-transform duration-200 hover:-translate-y-1"
                style={{ background: a.tint, borderColor: a.bd }}
              >
                <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-white">
                  <span className="h-[13px] w-[13px] rounded-[5px]" style={{ background: a.dot }} />
                </span>
                <div className="mt-auto">
                  <div className="font-display text-[18px] font-bold tracking-[-0.01em] text-ink">{sp.name}</div>
                  <div className="mt-0.5 text-[13px] text-ink-muted">
                    {sp.count} {sp.count === 1 ? "doctor" : "doctors"}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
