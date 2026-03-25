"use client";

import { motion } from "framer-motion";
import { MapPin, Star, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import type { ApiHospital } from "@/types/hospital";
import { formatMoneyCents } from "@/lib/money";

interface HospitalCardProps {
  hospital: ApiHospital;
  index: number;
}

export function HospitalCard({ hospital, index }: HospitalCardProps) {
  const formattedPrice = formatMoneyCents(hospital.fromPrice, hospital.currency);
  const location = hospital.area ? `${hospital.area}, ${hospital.city}` : hospital.city;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="group bg-white rounded-2xl overflow-hidden border border-navy/7 hover:border-gold/35 transition-all duration-500"
      style={{ boxShadow: "0 2px 12px rgba(15,30,56,0.06)" }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 16px 48px rgba(15,30,56,0.13)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 2px 12px rgba(15,30,56,0.06)")}
    >
      {/* ── Image ── */}
      <div className="relative h-52 overflow-hidden">
        <img
          src={hospital.image ?? "https://picsum.photos/seed/hospital-fallback/800/600"}
          alt={hospital.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-navy/75 via-navy/20 to-transparent" />

        {/* Rating pill — top right */}
        <div
          className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-sm"
          style={{ background: "rgba(15,30,56,0.65)", color: "#c8a96e", border: "1px solid rgba(200,169,110,0.3)" }}
        >
          <Star className="w-3 h-3 fill-gold" />
          {hospital.rating}
        </div>

        {/* Type badge — bottom left */}
        <div className="absolute bottom-3 left-3">
          <Badge
            variant="secondary"
            className="bg-white/90 backdrop-blur-sm text-xs font-medium text-navy border-0"
          >
            {hospital.type}
          </Badge>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-5">

        {/* Name */}
        <h3 className="font-bold text-lg text-navy line-clamp-1 mb-2 group-hover:text-navy-mid transition-colors duration-300">
          {hospital.name}
        </h3>

        {/* Location */}
        <div className="flex items-center gap-1.5 text-slate mb-1.5">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-sm">{location}</span>
        </div>

        {/* Specialty */}
        <p className="text-sm text-slate line-clamp-1 mb-5">{hospital.specialty}</p>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-navy/8 to-transparent mb-4" />

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-widest uppercase text-slate mb-0.5">Starting from</p>
            <p className="text-xl font-bold text-gold-dim">{formattedPrice}</p>
          </div>

          <Link href={`/hospital/${hospital.slug}`}>
            <button
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 group/btn"
              style={{
                background: "#0f1e38",
                color: "#c8a96e",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "#c8a96e";
                (e.currentTarget as HTMLButtonElement).style.color = "#0f1e38";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "#0f1e38";
                (e.currentTarget as HTMLButtonElement).style.color = "#c8a96e";
              }}
            >
              View Packages
              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover/btn:translate-x-0.5" />
            </button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}