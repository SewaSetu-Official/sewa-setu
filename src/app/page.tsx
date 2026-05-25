import { Navbar } from "@/components/navbar";
import { HeroSection } from "@/components/herosection";
import { HowItWorks } from "@/components/howitworks";
import { Footer } from "@/components/footer";
import { HospitalCard } from "@/components/hospital-card";
import { TrustSection } from "@/components/trust-section";
import { WhyChooseUsSection } from "@/components/why-choose-us";
import { TestimonialsSection } from "@/components/testimonials-section";
import { FAQSection } from "@/components/faq-section";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FloatingAI } from "@/components/floating-ai";
import { db } from "@/lib/db";
import type { ApiHospital } from "@/types/hospital";

async function loadFeaturedHospitals(): Promise<{
  featuredHospitals: ApiHospital[];
  featuredHospitalsUnavailable: boolean;
}> {
  try {
    const rawHospitals = await db.hospital.findMany({
      include: {
        location: true,
        media: { where: { isPrimary: true }, take: 1 },
        packages: {
          where: { isActive: true },
          orderBy: [{ price: "asc" }],
          take: 1,
        },
        _count: { select: { reviews: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    const hospitalIds = rawHospitals.map((hospital) => hospital.id);
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
  const { featuredHospitals, featuredHospitalsUnavailable } = await loadFeaturedHospitals();
  const params = await searchParams;
  const shouldOpenAI = params?.openAI === "true";
  const conversationId = params?.conversationId;

  return (
    <main className="min-h-screen bg-[#f7f4ef]">
      <Navbar />
      <FloatingAI autoOpen={shouldOpenAI} conversationId={conversationId} />

      <HeroSection />
      <TrustSection />
      <HowItWorks />
      <WhyChooseUsSection />

      {/* ── Top Rated Hospitals ── */}
      <section className="py-28 bg-white relative overflow-hidden">
        {/* Subtle top line */}
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(200,169,110,0.3), transparent)" }} />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="flex items-end justify-between mb-14">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#a88b50] mb-3">
                Featured
              </p>
              <h2 className="text-4xl md:text-5xl font-bold text-[#0f1e38]">
                Top Rated Hospitals
              </h2>
              <p className="mt-3 text-[#6b7a96] text-lg max-w-md">
                {featuredHospitalsUnavailable
                  ? "Featured hospital cards are temporarily unavailable while we reconnect to the database."
                  : "Trusted by thousands of families. Book your checkup today."}
              </p>
            </div>
            {!featuredHospitalsUnavailable && (
              <Link
                href="/search"
                className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-[#a88b50] border border-[rgba(200,169,110,0.3)] hover:bg-[#0f1e38] hover:text-[#c8a96e] hover:border-[#0f1e38] transition-all duration-300"
              >
                View All
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>

          {/* Cards */}
          {featuredHospitals.length > 0 ? (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {featuredHospitals.map((hospital, index) => (
                <HospitalCard key={hospital.id} hospital={hospital} index={index} />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-[rgba(15,30,56,0.08)] bg-[#f7f4ef] px-6 py-12 text-center">
              <p className="text-xl font-bold text-[#0f1e38]">
                Featured hospitals are temporarily unavailable.
              </p>
              <p className="mt-3 max-w-2xl mx-auto text-[#6b7a96] leading-relaxed">
                The homepage is still working, but the database connection for this section could not be reached just now.
                Once the connection is back, these cards will load automatically.
              </p>
            </div>
          )}

          {/* Mobile view all */}
          {!featuredHospitalsUnavailable && (
            <div className="mt-10 text-center sm:hidden">
              <Link
                href="/search"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-[#a88b50] border border-[rgba(200,169,110,0.3)]"
              >
                View All Hospitals
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </section>

      <TestimonialsSection />
      <FAQSection />

      {/* ── Final CTA ── */}
      <section className="py-32 bg-[#0f1e38] relative overflow-hidden">

        {/* Animated blobs */}
        <div className="absolute top-[-80px] left-[-80px] w-72 h-72 rounded-full opacity-10 animate-blob"
          style={{ background: "radial-gradient(circle, #c8a96e, transparent)" }} />
        <div className="absolute bottom-[-60px] right-[-60px] w-96 h-96 rounded-full opacity-10 animate-blob animation-delay-2000"
          style={{ background: "radial-gradient(circle, #3b8bd4, transparent)" }} />

        {/* Grid texture */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
          backgroundSize: "48px 48px"
        }} />

        <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center z-10">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#c8a96e] mb-6 opacity-80">
            Get started today
          </p>
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-[1.1]">
            Your family&apos;s health,{" "}
            <span className="gold-shimmer">always within reach.</span>
          </h2>
          <p className="text-lg text-slate-400 mb-10 max-w-xl mx-auto leading-relaxed">
            Find and coordinate trusted care with Sewa-Setu from Nepal or
            anywhere else, whenever it matters most.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/search"
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl text-[#0f1e38] font-bold text-base transition-all duration-300 hover:shadow-xl hover:shadow-[rgba(200,169,110,0.35)] hover:scale-105"
              style={{ background: "linear-gradient(135deg, #e8d5b0, #c8a96e, #a88b50)" }}
            >
              Start Booking Now
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/search"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-slate-300 font-medium text-base border border-white/10 hover:border-white/25 hover:text-white transition-all duration-300"
            >
              Browse hospitals
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
