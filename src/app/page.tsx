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
import type { ApiHospital } from "@/types/hospital";

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ openAI?: string; conversationId?: string }>;
}) {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const res = await fetch(`${baseUrl}/api/hospitals`, {
    cache: "no-store",
  });

  const data = await res.json();
  const hospitals: ApiHospital[] = data?.hospitals ?? [];

  const featuredHospitals = hospitals.slice(0, 3);

  // Await searchParams before accessing its properties
  const params = await searchParams;
  const shouldOpenAI = params?.openAI === "true";
  const conversationId = params?.conversationId;

  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <FloatingAI autoOpen={shouldOpenAI} conversationId={conversationId} />

      <HeroSection />

      {/* Nepal flag wave — visual transition from dark hero into light trust section */}
      <div className="relative w-full overflow-hidden bg-[#f7f4ef]" style={{ height: '160px' }}>
        {/* Gradient overlay: fade hero dark blue into the flag */}
        <div
          className="absolute inset-x-0 top-0 z-10 h-24 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, #0a1628 0%, transparent 100%)' }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/flagwave.svg"
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover object-center"
          style={{ mixBlendMode: 'multiply', opacity: 0.85 }}
        />
      </div>

      {/* Trust Section with Stats */}
      <TrustSection />
      
      {/* How It Works */}
      <HowItWorks />

      {/* Why Choose Us */}
      <WhyChooseUsSection />

      {/* Top Rated Hospitals */}
      <section className="py-24 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-3xl font-bold text-[#0f1e38]">
                Top Rated Hospitals
              </h2>
              <p className="mt-2 text-[#6b7a96]">
                Trusted by thousands of families. Book your checkup today.
              </p>
            </div>
            <Link
              href="/search"
              className="hidden sm:flex items-center text-[#a88b50] font-semibold hover:text-[#c8a96e] hover:gap-2 transition-all"
            >
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {featuredHospitals.map((hospital, index) => (
              <HospitalCard
                key={hospital.id}
                hospital={hospital}
                index={index}
              />
            ))}
          </div>

          <div className="mt-12 text-center sm:hidden">
            <Link
              href="/search"
              className="inline-flex items-center text-[#a88b50] font-semibold"
            >
              View All Hospitals <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <TestimonialsSection />

      {/* FAQ */}
      <FAQSection />

      {/* Final CTA Section */}
      <section className="py-24 bg-[#0f1e38] relative overflow-hidden">
        {/* Mesh grid */}
        <div className="absolute inset-0 opacity-5" style={{backgroundImage:'linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)', backgroundSize:'48px 48px'}}></div>
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Take Care of Your Family's Health?
          </h2>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Join thousands of families who trust Sewa-Setu for hassle-free healthcare management
          </p>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#c8a96e] to-[#a88b50] text-[#0f1e38] font-bold rounded-xl hover:shadow-xl hover:shadow-[rgba(200,169,110,0.4)] transition-all transform hover:scale-105"
          >
            Start Booking Now
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}