"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { MapPin, Star, ArrowRight, Building2, Stethoscope, FlaskConical, Siren } from "lucide-react";
import Link from "next/link";
import type { ApiHospital } from "@/types/hospital";
import { formatMoneyCents } from "@/lib/money";

interface HospitalCardProps {
  hospital: ApiHospital;
  index: number;
}

const TYPE_THEME = {
  HOSPITAL: { label: "Hospital", fg: "#0C6B57", badge: "#E6F0EC", tone: "linear-gradient(140deg,#1C7A64,#0C6B57 55%,#0a5848)", Icon: Building2 },
  CLINIC:   { label: "Clinic",   fg: "#C0763A", badge: "#FAEBD9", tone: "linear-gradient(140deg,#E89B47,#E0913A 55%,#c87d2c)", Icon: Stethoscope },
  LAB:      { label: "Lab",      fg: "#7A3E8E", badge: "#F0E9F4", tone: "linear-gradient(140deg,#9356A6,#7A3E8E 55%,#693279)", Icon: FlaskConical },
} as const;

export function HospitalCard({ hospital, index }: HospitalCardProps) {
  const formattedPrice = formatMoneyCents(hospital.fromPrice, hospital.currency);
  const location = hospital.area ? `${hospital.area}, ${hospital.city}` : hospital.city;
  const theme = TYPE_THEME[hospital.type] ?? TYPE_THEME.HOSPITAL;
  const WatermarkIcon = theme.Icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: Math.min(index, 6) * 0.06 }}
    >
      <Link
        href={`/hospital/${hospital.slug}`}
        className="group flex h-full flex-col overflow-hidden rounded-[18px] border border-[rgba(20,33,29,0.07)] bg-white shadow-[0_14px_30px_-24px_rgba(20,33,29,0.5)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_24px_44px_-24px_rgba(20,33,29,0.55)]"
      >
        {/* ── Header ── */}
        <div className="relative h-[120px] overflow-hidden" style={{ background: theme.tone }}>
          {hospital.image ? (
            <Image
              loader={({ src }) => src}
              unoptimized
              src={hospital.image}
              alt={hospital.name}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <WatermarkIcon className="absolute -bottom-5 -right-3.5 h-[116px] w-[116px] text-white/20" strokeWidth={1.6} />
          )}

          {/* type badge — top left */}
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11.5px] font-bold" style={{ background: theme.badge, color: theme.fg }}>
            <span className="h-[7px] w-[7px] rounded-[2px]" style={{ background: theme.fg }} />
            {theme.label}
          </span>

          {/* rating — top right */}
          {hospital.rating > 0 && (
            <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11.5px] font-bold text-white backdrop-blur" style={{ background: "rgba(20,33,29,.78)" }}>
              <Star className="h-[11px] w-[11px] fill-[#FFC368] text-[#FFC368]" />
              {hospital.rating}
            </span>
          )}
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 flex-col px-[15px] pb-[15px] pt-3.5">
          <div className="font-display text-[16.5px] font-bold leading-[1.2] tracking-[-0.01em] text-ink">{hospital.name}</div>

          <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-ink-muted">
            <MapPin className="h-3 w-3 shrink-0" /> {location}
          </div>

          {hospital.emergencyAvailable && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className="flex items-center gap-1.5 rounded-full bg-[#FBEAEE] px-2.5 py-1 text-[11px] font-bold text-[#C0556B]">
                <Siren className="h-[11px] w-[11px]" /> Emergency 24/7
              </span>
            </div>
          )}

          {hospital.specialty && (
            <p className="mt-2.5 line-clamp-2 flex-1 text-[12.5px] leading-[1.45] text-ink-soft">{hospital.specialty}</p>
          )}

          <div className="mt-3 flex items-end justify-between border-t border-[rgba(20,33,29,0.07)] pt-3">
            <div>
              <div className="text-[10.5px] font-semibold text-ink-muted">Starting from</div>
              <div className="font-display text-[18px] font-bold text-brand">{formattedPrice}</div>
            </div>
            <span className="flex items-center gap-1.5 rounded-[10px] bg-brand px-3 py-2.5 text-[12.5px] font-semibold text-white transition-colors group-hover:bg-brand-dark">
              View packages
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
