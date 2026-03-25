// src/components/package-card.tsx
"use client";

import { useMemo, useState } from "react";
import { Check, Sparkles, Heart } from "lucide-react";
import type { UiPackage } from "@/types/package";
import { BookingModal } from "@/components/booking-modal";
import { formatMoneyCents } from "@/lib/money";

interface PackageCardProps {
  pkg: UiPackage;
  hospitalName: string;
  hospitalId?: string;
  featured?: boolean;
}

export function PackageCard({ pkg, hospitalName, hospitalId, featured = false }: PackageCardProps) {
  const [showModal, setShowModal] = useState(false);

  const priceText = useMemo(() => {
    return formatMoneyCents(pkg.price, pkg.currency);
  }, [pkg.price, pkg.currency]);

  return (
    <>
      <div
        className={`group relative bg-white rounded-2xl border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden flex flex-col ${
          featured
            ? "border-gold shadow-lg shadow-gold/20"
            : "border-navy/10 hover:border-gold"
        }`}
      >
        {/* Featured Badge */}
        {featured && (
          <div className="absolute top-0 right-0 z-10">
            <div className="bg-gradient-to-br from-gold to-gold-dim text-navy px-4 py-1.5 rounded-bl-2xl flex items-center gap-1 shadow-lg">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-bold">POPULAR</span>
            </div>
          </div>
        )}

        {/* Gradient Background Decoration */}
        <div
          className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-br opacity-5 ${
            featured
              ? "from-gold via-gold-dim to-gold/40"
              : "from-navy to-gold/30"
          }`}
        />

        {/* Card Content */}
        <div className="relative p-6 flex flex-col flex-1">
          {/* Package Name */}
          <div className="mb-4">
            <h3 className="text-xl font-bold text-slate-900 mb-1">{pkg.name}</h3>
            <div className="h-1 w-12 rounded-full bg-gradient-to-r from-gold to-gold-dim" />
          </div>

          {/* Price Section */}
          <div className="mb-6">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-gold">
                {priceText}
              </span>
              {pkg.discount && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                  {pkg.discount}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1">One-time payment</p>
          </div>

          {/* Features List */}
          <div className="flex-1 mb-6">
            {pkg.features
              // defensive: if any element still contains \n, split it now
              .flatMap((f) => f.split("\n").map((l) => l.trim()).filter(Boolean))
              .map((line, i) =>
                line.startsWith("- ") ? (
                  <div key={i} className="flex items-start gap-2.5 py-1">
                    <div className="flex-shrink-0 mt-1">
                      <div className="h-4 w-4 rounded-full bg-gold/15 flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-gold-dim" />
                      </div>
                    </div>
                    <span className="text-sm text-slate-700 leading-relaxed">{line.slice(2)}</span>
                  </div>
                ) : (
                  <div key={i} className="flex items-center gap-2 pt-4 pb-1 first:pt-1">
                    <div className="h-px flex-1 bg-navy/10" />
                    <span className="text-[0.68rem] font-bold tracking-widest uppercase text-gold-dim whitespace-nowrap">
                      {line}
                    </span>
                    <div className="h-px flex-1 bg-navy/10" />
                  </div>
                )
              )}
          </div>

          {/* Book Button */}
          <button
            onClick={() => setShowModal(true)}
            className={`mt-auto w-full rounded-xl py-3.5 text-sm font-semibold transition-all duration-300 shadow-md text-center ${
              featured
                ? "bg-gold text-navy hover:bg-gold-dim hover:shadow-lg hover:shadow-gold/30 hover:scale-105"
                : "bg-navy text-gold hover:bg-navy-mid hover:shadow-lg"
            }`}
          >
            Book Now — {priceText}
          </button>
        </div>

        {/* Hover Effect Border */}
        <div className="absolute inset-0 rounded-2xl border-2 border-gold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </div>

      <BookingModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        hospitalName={hospitalName}
        hospitalId={hospitalId}
        selectedPackage={pkg}
        packageId={pkg.id}
      />
    </>
  );
}
