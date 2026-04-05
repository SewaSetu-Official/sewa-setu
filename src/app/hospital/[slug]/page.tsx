import { ArrowLeft, MapPin, Star, Building2, Stethoscope, Beaker } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { HospitalDetailClient } from "./HospitalDetailClient";
import { Navbar } from "@/components/navbar";
import { getHospitalBySlug } from "@/lib/get-hospital";

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
    currency: s.currency ?? "NPR",
    discount: undefined as string | undefined,
    features: s.features?.length ? s.features : s.description ? [s.description] : [],
  }));

  return (
    <>
      <Navbar />
      <main style={{ minHeight: "100vh", background: "#f7f4ef", padding: "calc(80px + 1.25rem) 0 3rem" }}>
        <div className="px-4 sm:px-8 lg:px-[10%]">
          <div className="bg-white rounded-[2rem] overflow-hidden shadow-xl shadow-slate-200/50 border border-slate-100" style={{ marginBottom: "2rem" }}>
            {/* Hero */}
            <div className="relative h-80 sm:h-96 lg:h-[450px] w-full">
              <Image
                src={hospital.image ?? "/SewaSetu-Logo.webp"}
                alt={hospital.name}
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

              {/* Back button */}
              <div className="absolute top-4 left-6">
                <Link
                  href="/search"
                  className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-all bg-black/25 backdrop-blur-md text-white border border-white/30 hover:border-gold hover:text-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back To Hospitals
                </Link>
              </div>

              <div className="absolute bottom-0 left-0 w-full p-6 sm:p-8 text-white">
                {/* Type Badge */}
                <div className="mb-3 flex items-center gap-2">
                  {hospital.type === "HOSPITAL" && <Building2 className="h-5 w-5" />}
                  {hospital.type === "CLINIC" && <Stethoscope className="h-5 w-5" />}
                  {hospital.type === "LAB" && <Beaker className="h-5 w-5" />}
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/30 backdrop-blur">
                    {hospital.type}
                  </span>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {hospital.tags?.slice(0, 4).map((tag, i) => (
                    <span
                      key={tag}
                      className={`px-3 py-1 rounded-full text-xs font-semibold text-navy ${
                        i === 0 ? "bg-gold" : "bg-gold/70"
                      }`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3 tracking-tight text-white drop-shadow-lg" style={{ textShadow: "0 4px 6px rgba(0,0,0,0.7)" }}>
                  {hospital.name}
                </h1>

                <div className="flex flex-wrap items-center gap-4 text-sm sm:text-base font-medium text-slate-200">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    <span>{hospital.location.area}, {hospital.location.city}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-orange-400 fill-orange-400" />
                    <span className="text-white">{hospital.rating.toFixed(1)}</span>
                    <span className="text-slate-300 font-normal">({hospital.reviewCount}+ reviews)</span>
                  </div>
                </div>
              </div>
            </div>

            <HospitalDetailClient hospital={hospital} packages={packages} />
          </div>
        </div>
      </main>
    </>
  );
}
