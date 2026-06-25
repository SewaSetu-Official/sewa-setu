import Image from "next/image";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";

export type LandingDoctor = {
  id: string;
  name: string;
  image: string | null;
  specialty: string;
  hospital: string | null;
  fee: string | null;
  experience: string | null;
  languages: string | null;
  verified: boolean;
};

const WaveEyebrow = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-2.5 text-[12.5px] font-extrabold uppercase tracking-[0.12em] text-brand">
    <svg width="22" height="9" viewBox="0 0 22 9" fill="none" className="shrink-0" aria-hidden>
      <path d="M1 8C5 2 17 2 21 8" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
    {children}
  </span>
);

function DoctorCardItem({ d }: { d: LandingDoctor }) {
  return (
    <div className="rounded-[22px] border border-[rgba(20,33,29,0.07)] bg-white p-[18px] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_56px_-30px_rgba(20,33,29,0.45)]">
      <div className="relative">
        <div className="relative h-[240px] w-full overflow-hidden rounded-[16px] bg-brand-soft">
          {d.image ? (
            <Image
              loader={({ src }) => src}
              unoptimized
              src={d.image}
              alt={d.name}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="font-display text-5xl font-bold text-brand/30">
                {d.name.replace(/^Dr\.?\s*/i, "").charAt(0)}
              </span>
            </div>
          )}
        </div>
        {d.verified && (
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1.5 text-[12.5px] font-bold text-ink backdrop-blur">
            <BadgeCheck className="h-3.5 w-3.5 text-brand" />
            Verified
          </span>
        )}
      </div>

      <div className="mt-4">
        <h3 className="font-display text-[21px] font-bold tracking-[-0.01em] text-ink">{d.name}</h3>
        <div className="mt-0.5 text-[14px] font-semibold text-brand">{d.specialty}</div>
        {d.hospital && <div className="mt-0.5 text-[13.5px] text-ink-muted">{d.hospital}</div>}
      </div>

      {(d.experience || d.languages) && (
        <div className="mt-3.5 flex flex-wrap gap-2">
          {d.experience && (
            <span className="rounded-lg bg-page px-2.5 py-1.5 text-[12px] font-semibold text-ink-soft">{d.experience}</span>
          )}
          {d.languages && (
            <span className="rounded-lg bg-page px-2.5 py-1.5 text-[12px] font-semibold text-ink-soft">{d.languages}</span>
          )}
        </div>
      )}

      <div className="mt-[18px] flex items-center justify-between border-t border-[rgba(20,33,29,0.07)] pt-4">
        <div>
          <div className="text-[11.5px] text-ink-muted">Consultation</div>
          <div className="font-display text-[18px] font-bold text-ink">{d.fee ?? "—"}</div>
        </div>
        <Link
          href={`/doctor/${d.id}`}
          className="rounded-full bg-brand px-6 py-2.5 text-[14px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-brand-dark"
        >
          Book
        </Link>
      </div>
    </div>
  );
}

export function DoctorsShowcase({ doctors }: { doctors: LandingDoctor[] }) {
  if (!doctors.length) return null;

  return (
    <section id="doctors" className="scroll-mt-24 bg-page py-16 md:py-20">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-10">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-6">
          <div>
            <WaveEyebrow>Top rated near you</WaveEyebrow>
            <h2 className="font-display mt-3 text-[clamp(2rem,4vw,2.625rem)] font-bold leading-[1.05] tracking-[-0.025em] text-ink">
              Meet trusted doctors
            </h2>
          </div>
          <Link href="/search" className="text-[15px] font-semibold text-brand transition-colors hover:text-brand-dark">
            Browse all doctors →
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-3">
          {doctors.map((d) => (
            <DoctorCardItem key={d.id} d={d} />
          ))}
        </div>
      </div>
    </section>
  );
}
