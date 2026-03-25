"use client";

import { Shield, Zap, Lock, Award, Users, Headphones } from "lucide-react";
import { useEffect, useRef } from "react";

const benefits = [
  { icon: Shield,     title: "Trusted Network",  description: "50+ verified hospitals rigorously screened for quality and safety standards.", accent: "#c8a96e" },
  { icon: Zap,        title: "Quick Booking",     description: "From search to confirmed appointment in under 3 minutes, any time of day.",      accent: "#3b8bd4" },
  { icon: Lock,       title: "Secure Payments",   description: "Bank-grade encryption powers every transaction. Your data never stored.",         accent: "#1d9e75" },
  { icon: Award,      title: "Top Quality",       description: "Only the highest-rated facilities with consistent patient satisfaction scores.",   accent: "#c8a96e" },
  { icon: Users,      title: "24/7 Support",      description: "A real human team ready to assist you across time zones, always.",                accent: "#3b8bd4" },
  { icon: Headphones, title: "Instant Reports",   description: "Digital test reports delivered to your inbox within hours of the checkup.",       accent: "#1d9e75" },
];

export function WhyChooseUsSection() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("visible"); }),
      { threshold: 0.15 }
    );
    ref.current?.querySelectorAll(".reveal").forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={ref} className="py-28 bg-cream-warm relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "radial-gradient(circle, #0f1e38 1px, transparent 1px)",
        backgroundSize: "32px 32px"
      }} />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20 reveal">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-gold-dim mb-4">Why Sewa-Setu</p>
          <h2 className="text-4xl md:text-5xl font-bold text-navy mb-5">
            Built for families far from home
          </h2>
          <p className="text-lg text-slate max-w-xl mx-auto leading-relaxed">
            Every feature designed around one mission — making distance disappear when your family's health is on the line.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((b, i) => (
            <div
              key={i}
              className="reveal group relative p-8 rounded-2xl bg-white border border-navy/7 hover:border-transparent hover:shadow-2xl hover:shadow-navy/8 transition-all duration-500 cursor-default overflow-hidden"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: `linear-gradient(90deg, transparent, ${b.accent}, transparent)` }}
              />
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition-all duration-500"
                style={{ background: `${b.accent}18`, border: `1px solid ${b.accent}35` }}
              >
                <b.icon className="h-5 w-5 transition-all duration-500" style={{ color: b.accent }} />
              </div>
              <h3 className="text-xl font-bold text-navy mb-3">{b.title}</h3>
              <p className="text-slate leading-relaxed text-[15px]">{b.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}