import { Navbar } from "@/components/navbar";
import { HeroSection } from "@/components/herosection";
import { HowItWorks } from "@/components/howitworks";
import { Footer } from "@/components/footer";
import { HospitalCard } from "@/components/hospital-card";
import { TrustedNationwide } from "@/components/trusted-nationwide";
import { BuiltOnTrust } from "@/components/built-on-trust";
import { TestimonialsSection } from "@/components/testimonials-section";
import { DepartmentHelper } from "@/components/department-helper";
import { QueueAware } from "@/components/queue-aware";
import { FamilyBooking } from "@/components/family-booking";
import { ImpactBand, type ImpactStat } from "@/components/impact-band";
import { GetTheApp } from "@/components/get-the-app";
import { SpecialtiesGrid, type SpecialtyItem } from "@/components/specialties-grid";
import { DoctorsShowcase, type LandingDoctor } from "@/components/doctors-showcase";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FloatingAI } from "@/components/floating-ai";
import { db } from "@/lib/db";
import { formatMoneyCents } from "@/lib/money";
import type { ApiHospital } from "@/types/hospital";

async function loadLandingDirectory(): Promise<{
  specialties: SpecialtyItem[];
  specialtyTotal: number;
  doctors: LandingDoctor[];
}> {
  try {
    const [rawSpecialties, specialtyTotal, rawDoctors] = await Promise.all([
      db.specialty.findMany({
        select: { name: true, slug: true, _count: { select: { doctors: true } } },
        orderBy: { doctors: { _count: "desc" } },
        take: 8,
      }),
      db.specialty.count(),
      db.doctor.findMany({
        where: { verified: true },
        orderBy: [{ experienceYears: "desc" }],
        take: 3,
        include: {
          media: { where: { isPrimary: true }, take: 1 },
          specialties: { include: { specialty: true } },
          hospitals: { where: { isPrimary: true }, include: { hospital: true }, take: 1 },
        },
      }),
    ]);

    const specialties: SpecialtyItem[] = rawSpecialties
      .filter((s) => s._count.doctors > 0)
      .map((s) => ({ name: s.name, slug: s.slug, count: s._count.doctors }));

    const doctors: LandingDoctor[] = rawDoctors.map((d) => {
      const primarySpecialty =
        d.specialties.find((s) => s.isPrimary)?.specialty.name ??
        d.specialties[0]?.specialty.name ??
        "Doctor";
      const langs = Array.isArray(d.languages) ? (d.languages as string[]) : [];
      const name = /^(dr\.?|prof\.?)\s/i.test(d.fullName.trim()) ? d.fullName.trim() : `Dr. ${d.fullName.trim()}`;
      return {
        id: d.id,
        name,
        image: d.media[0]?.url ?? null,
        specialty: primarySpecialty,
        hospital: d.hospitals[0]?.hospital.name ?? null,
        fee: d.feeMin != null ? formatMoneyCents(d.feeMin, d.currency ?? "EUR") : null,
        experience: d.experienceYears != null ? `${d.experienceYears} yrs exp` : null,
        languages: langs.length ? langs.slice(0, 2).join(" · ") : null,
        verified: d.verified,
      };
    });

    return { specialties, specialtyTotal, doctors };
  } catch (error) {
    console.warn("Landing directory unavailable on home page:", error instanceof Error ? error.message : error);
    return { specialties: [], specialtyTotal: 0, doctors: [] };
  }
}

async function loadHomeStats(): Promise<{
  hospitalCount: number;
  partnerNames: string[];
  bookingCount: number;
}> {
  try {
    const [hospitalCount, bookingCount, partnerRows] = await Promise.all([
      db.hospital.count(),
      db.booking.count(),
      db.hospital.findMany({ select: { name: true }, orderBy: { createdAt: "desc" }, take: 12 }),
    ]);
    return { hospitalCount, bookingCount, partnerNames: partnerRows.map((h) => h.name) };
  } catch (error) {
    console.warn("Home stats unavailable on home page:", error instanceof Error ? error.message : error);
    return { hospitalCount: 0, partnerNames: [], bookingCount: 0 };
  }
}

async function loadFeaturedHospitals(): Promise<{
  featuredHospitals: ApiHospital[];
  featuredHospitalsUnavailable: boolean;
}> {
  try {
    const rawHospitals = await db.hospital.findMany({
      include: {
        location: true,
        media: { where: { isPrimary: true }, take: 1 },
        packages: { where: { isActive: true }, orderBy: [{ price: "asc" }], take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    const hospitalIds = rawHospitals.map((h) => h.id);
    const reviewAggs = hospitalIds.length
      ? await db.review.groupBy({
          by: ["hospitalId"],
          where: { hospitalId: { in: hospitalIds } },
          _avg: { rating: true },
          _count: { rating: true },
        })
      : [];
    const aggMap = Object.fromEntries(reviewAggs.map((agg) => [agg.hospitalId, agg]));

    const featuredHospitals: ApiHospital[] = rawHospitals.map((hospital) => ({
      id: hospital.id,
      slug: hospital.slug,
      name: hospital.name,
      type: hospital.type,
      rating: aggMap[hospital.id]?._avg.rating ? Math.round(aggMap[hospital.id]._avg.rating! * 10) / 10 : 0,
      reviewCount: aggMap[hospital.id]?._count.rating ?? 0,
      specialty: hospital.servicesSummary || "General",
      city: hospital.location.city,
      district: hospital.location.district,
      area: hospital.location.area,
      image: hospital.media[0]?.url || null,
      fromPrice: hospital.packages[0]?.price ?? null,
      currency: hospital.packages[0]?.currency ?? "EUR",
      emergencyAvailable: hospital.emergencyAvailable,
    }));

    return { featuredHospitals, featuredHospitalsUnavailable: false };
  } catch (error) {
    console.warn("Featured hospitals unavailable on home page:", error instanceof Error ? error.message : error);
    return { featuredHospitals: [], featuredHospitalsUnavailable: true };
  }
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ openAI?: string; conversationId?: string }>;
}) {
  const { hospitalCount, partnerNames, bookingCount } = await loadHomeStats();
  const { specialties, specialtyTotal, doctors } = await loadLandingDirectory();
  const { featuredHospitals, featuredHospitalsUnavailable } = await loadFeaturedHospitals();

  const impactStats: ImpactStat[] = [
    { n: bookingCount > 0 ? `${bookingCount.toLocaleString()}+` : "30,000+", l: "Appointments booked" },
    { n: hospitalCount > 0 ? `${hospitalCount.toLocaleString()}+` : "120+", l: "Partner hospitals & clinics" },
    { n: "~5 hrs", l: "Saved per visit, on average" },
    { n: "7", l: "Provinces covered" },
  ];
  const params = await searchParams;
  const shouldOpenAI = params?.openAI === "true";
  const conversationId = params?.conversationId;

  return (
    <main className="min-h-screen bg-page">
      <Navbar />
      <FloatingAI autoOpen={shouldOpenAI} conversationId={conversationId} />

      <HeroSection hospitalCount={hospitalCount} />
      <TrustedNationwide partners={partnerNames} />
      <HowItWorks />
      <QueueAware />
      <BuiltOnTrust />
      <DepartmentHelper />
      <SpecialtiesGrid specialties={specialties} total={specialtyTotal} />
      <DoctorsShowcase doctors={doctors} />

      {/* ── Top rated hospitals ── */}
      {!featuredHospitalsUnavailable && featuredHospitals.length > 0 && (
        <section id="hospitals" className="scroll-mt-24 bg-page py-16 md:py-20">
          <div className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-10">
            <div className="mb-9 flex flex-wrap items-end justify-between gap-6">
              <div>
                <span className="inline-flex items-center gap-2.5 text-[12.5px] font-extrabold uppercase tracking-[0.12em] text-brand">
                  <svg width="22" height="9" viewBox="0 0 22 9" fill="none" className="shrink-0" aria-hidden>
                    <path d="M1 8C5 2 17 2 21 8" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  Featured
                </span>
                <h2 className="font-display mt-3 text-[clamp(2rem,4vw,2.625rem)] font-bold leading-[1.05] tracking-[-0.025em] text-ink">
                  Top rated hospitals
                </h2>
                <p className="mt-3 max-w-md text-[17px] text-ink-soft">
                  Trusted by thousands of families across Nepal. Book your checkup today.
                </p>
              </div>
              <Link
                href="/search"
                className="hidden items-center gap-2 rounded-full border border-[rgba(20,33,29,0.12)] px-5 py-2.5 text-sm font-semibold text-brand transition-all duration-300 hover:border-brand hover:bg-brand hover:text-white sm:flex"
              >
                View All
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-[22px] sm:grid-cols-2 lg:grid-cols-3">
              {featuredHospitals.map((hospital, index) => (
                <HospitalCard key={hospital.id} hospital={hospital} index={index} />
              ))}
            </div>

            <div className="mt-10 text-center sm:hidden">
              <Link
                href="/search"
                className="inline-flex items-center gap-2 rounded-full border border-[rgba(20,33,29,0.12)] px-6 py-3 text-sm font-semibold text-brand"
              >
                View All Hospitals
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      <FamilyBooking />
      <ImpactBand stats={impactStats} />
      <GetTheApp />
      <TestimonialsSection />

      {/* ── Final CTA ── */}
      <section id="cta" className="bg-page pb-20">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-10">
          <div className="relative overflow-hidden rounded-[32px] bg-brand-soft px-6 py-16 text-center md:px-10 md:py-[72px]">
            <span className="inline-flex items-center gap-2.5 text-[12.5px] font-extrabold uppercase tracking-[0.12em] text-brand">
              <svg width="22" height="9" viewBox="0 0 22 9" fill="none" className="shrink-0" aria-hidden>
                <path d="M1 8C5 2 17 2 21 8" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Care without the queue
            </span>
            <h2 className="font-display mx-auto mt-3.5 max-w-[640px] text-[clamp(2.2rem,5vw,3.25rem)] font-bold leading-[1.04] tracking-[-0.03em] text-ink">
              Book care before you go
            </h2>
            <p className="mx-auto mt-5 max-w-[480px] text-[18px] leading-[1.5] text-ink-soft">
              Join thousands of patients across Nepal getting the right care, at the right time — without standing in line.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3.5">
              <Link
                href="/search"
                className="rounded-full bg-brand px-8 py-4 text-base font-semibold text-white shadow-[0_12px_30px_-10px_rgba(12,107,87,0.6)] transition-all hover:-translate-y-0.5 hover:bg-brand-dark"
              >
                Get started — it&apos;s free
              </Link>
              <Link
                href="/partner"
                className="rounded-full border border-[rgba(20,33,29,0.1)] bg-white px-8 py-4 text-base font-semibold text-ink transition-all hover:-translate-y-0.5"
              >
                For hospitals
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
