"use client";

import { useEffect, useRef, useState } from "react";
import { Users, Building2, Heart, CheckCircle } from "lucide-react";

const stats = [
  { icon: Users,       value: 5000,  suffix: "+", label: "Families Served"     },
  { icon: Building2,   value: 50,    suffix: "+", label: "Partner Hospitals"   },
  { icon: Heart,       value: 12000, suffix: "+", label: "Checkups Completed"  },
  { icon: CheckCircle, value: 98,    suffix: "%", label: "Satisfaction Rate"   },
];

function useCountUp(target: number, duration = 1800, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [start, target, duration]);
  return count;
}

function StatCard({ icon: Icon, value, suffix, label, delay }: typeof stats[0] & { delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const count = useCountUp(value, 1800, started);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setStarted(true); obs.disconnect(); } },
      { threshold: 0.5 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="group text-center" style={{ animationDelay: `${delay}ms` }}>
      <div className="relative mb-5 mx-auto w-16 h-16 flex items-center justify-center">
        <div className="absolute inset-0 rounded-2xl bg-navy opacity-0 group-hover:opacity-100 transition-all duration-500 scale-90 group-hover:scale-100" />
        <div className="relative z-10 w-full h-full flex items-center justify-center rounded-2xl border border-gold/25 bg-white shadow-sm group-hover:border-transparent transition-all duration-500">
          <Icon className="h-7 w-7 text-gold-dim group-hover:text-gold transition-colors duration-500" />
        </div>
      </div>
      <p className="text-4xl md:text-5xl font-bold text-navy mb-1 tabular-nums">
        {count.toLocaleString()}{suffix}
      </p>
      <p className="text-slate font-medium text-sm tracking-wide uppercase">{label}</p>
    </div>
  );
}

export function TrustSection() {
  return (
    <section className="py-24 bg-white relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(200,169,110,0.4)] to-transparent" />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
          {stats.map((s, i) => <StatCard key={i} {...s} delay={i * 120} />)}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(200,169,110,0.2)] to-transparent" />
    </section>
  );
}