import { ChevronLeft, MapPin, Star, Building2, Stethoscope, Beaker, CheckCircle2, Siren, Banknote, ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { HospitalDetailClient } from "./HospitalDetailClient";
import { HospitalHeroActions } from "./hospital-hero-actions";
import { Navbar } from "@/components/navbar";
import { getHospitalBySlug } from "@/lib/get-hospital";
import { formatMoneyCents } from "@/lib/money";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function HospitalDetails({ params }: PageProps) {
  const { slug } = await params;
  const hospital = await getHospitalBySlug(slug);

  if (!hospital) notFound();

  const packages = hospital.services.map((s) => ({
    id: s.id,
    name: s.name,
    price: s.price,
    currency: s.currency ?? "EUR",
    discount: undefined as string | undefined,
    features: s.features?.length ? s.features : s.description ? [s.description] : [],
  }));

  const currency = packages[0]?.currency ?? hospital.doctors[0]?.currency ?? "EUR";
  const prices = [
    ...packages.map((p) => p.price),
    ...hospital.doctors.map((d) => d.feeMin),
  ].filter((n): n is number => typeof n === "number" && n > 0);
  const startingFrom = prices.length ? formatMoneyCents(Math.min(...prices), currency) : null;

  const TypeIcon = hospital.type === "CLINIC" ? Stethoscope : hospital.type === "LAB" ? Beaker : Building2;

  const stats: { value: string; label: string; Icon: typeof Banknote; bg: string; fg: string }[] = [
    ...(startingFrom ? [{ value: startingFrom, label: "Starting from", Icon: Banknote, bg: "#E6F0EC", fg: "#0C6B57" }] : []),
    { value: String(hospital.doctors.length), label: "Doctors", Icon: Stethoscope, bg: "#FAEBD9", fg: "#C0763A" },
    { value: String(hospital.departments?.length ?? 0), label: "Departments", Icon: Building2, bg: "#F0E9F4", fg: "#7A3E8E" },
    { value: hospital.location.city, label: "Location", Icon: MapPin, bg: "#E6EEF4", fg: "#3F6B8C" },
  ];

  return (
    <main className="min-h-screen bg-page">
      <Navbar />
      <div className="mx-auto max-w-[1160px] px-5 pt-[88px] pb-2 sm:px-9">

        {/* back */}
        <Link href="/search" className="mb-4 inline-flex items-center gap-2 text-[13.5px] font-semibold text-ink-soft transition-colors hover:text-brand">
          <ChevronLeft className="h-4 w-4" /> Back to hospitals
        </Link>

        {/* ── HERO ── */}
        <div className="relative h-[300px] overflow-hidden rounded-[26px] shadow-[0_30px_70px_-36px_rgba(12,107,87,0.7)] sm:h-[360px]" style={{ background: "linear-gradient(140deg,#1C7A64,#0C6B57 55%,#0a5848)" }}>
          {hospital.image && (
            <Image unoptimized src={hospital.image} alt={hospital.name} fill priority className="object-cover" />
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top,rgba(8,42,34,.78),transparent 62%)" }} />
          {!hospital.image && <TypeIcon className="absolute -bottom-12 right-2 h-72 w-72 text-white/10" strokeWidth={1.4} />}

          {/* badges */}
          <div className="absolute left-6 top-5 flex flex-wrap gap-2.5">
            <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-brand">
              <span className="h-[7px] w-[7px] rounded-[2px] bg-brand" />
              {hospital.type.charAt(0) + hospital.type.slice(1).toLowerCase()}
            </span>
            {hospital.verified && (
              <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white" style={{ background: "rgba(63,164,131,.95)" }}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Verified
              </span>
            )}
            {hospital.emergencyAvailable && (
              <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white" style={{ background: "rgba(192,85,107,.95)" }}>
                <Siren className="h-3.5 w-3.5" /> Emergency 24/7
              </span>
            )}
          </div>

          {/* title block */}
          <div className="absolute inset-x-6 bottom-9 flex items-end justify-between gap-5">
            <div className="min-w-0">
              <h1 className="font-display text-[30px] font-bold leading-[1.05] tracking-[-0.025em] text-white sm:text-[38px]">{hospital.name}</h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm font-medium text-[#D6E5DE]">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-[15px] w-[15px]" />
                  {[hospital.location.area, hospital.location.city].filter(Boolean).join(", ")}
                </span>
                {hospital.rating > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Star className="h-[15px] w-[15px] fill-[#FFC368] text-[#FFC368]" />
                    <strong className="font-bold text-white">{hospital.rating.toFixed(1)}</strong>
                    <span>· {hospital.reviewCount.toLocaleString()} reviews</span>
                  </span>
                )}
              </div>
            </div>
            <HospitalHeroActions hospitalId={hospital.id} />
          </div>
        </div>

        {/* ── QUICK STATS BAR ── */}
        <div className="relative z-[2] mx-auto -mt-[30px] flex max-w-[calc(100%-24px)] flex-wrap items-center gap-4 rounded-[18px] border border-[rgba(20,33,29,0.07)] bg-white px-5 py-4 shadow-[0_22px_50px_-30px_rgba(20,33,29,0.5)]">
          {stats.map((s) => {
            const Icon = s.Icon;
            return (
              <div key={s.label} className="flex min-w-[140px] flex-1 items-center gap-3">
                <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[12px]" style={{ background: s.bg, color: s.fg }}>
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-display text-[19px] font-bold leading-none tracking-[-0.01em] text-ink">{s.value}</div>
                  <div className="mt-1 text-[11.5px] font-semibold text-ink-muted">{s.label}</div>
                </div>
              </div>
            );
          })}
          <a href="#services-section" className="flex items-center gap-2 whitespace-nowrap rounded-[12px] bg-brand px-5 py-3 text-[14.5px] font-semibold text-white shadow-[0_12px_24px_-12px_rgba(12,107,87,0.8)] transition-colors hover:bg-brand-dark">
            Book appointment
            <ArrowRight className="h-[15px] w-[15px]" />
          </a>
        </div>
      </div>

      <HospitalDetailClient hospital={hospital} packages={packages} />
    </main>
  );
}
