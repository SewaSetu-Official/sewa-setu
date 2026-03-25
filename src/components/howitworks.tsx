import { Search, CalendarCheck, FileHeart } from "lucide-react";

const steps = [
  {
    icon: Search,
    step: "01",
    title: "Find a Hospital",
    desc: "Browse top-rated hospitals in Kathmandu, Pokhara, or Lalitpur.",
  },
  {
    icon: CalendarCheck,
    step: "02",
    title: "Book & Pay",
    desc: "Choose a checkup package and pay securely online from miles away.",
  },
  {
    icon: FileHeart,
    step: "03",
    title: "Receive Report",
    desc: "Loved ones visit the hospital. You get the digital report instantly.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-28 bg-navy scroll-mt-20 relative overflow-hidden">

      {/* Subtle background texture */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: "radial-gradient(circle, rgba(200,169,110,0.8) 1px, transparent 1px)",
        backgroundSize: "40px 40px"
      }} />

      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] opacity-10 blur-3xl rounded-full"
        style={{ background: "radial-gradient(ellipse, #c8a96e, transparent)" }} />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-20">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-gold mb-4 opacity-80">Simple Process</p>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-5">How Sewa-Setu Works</h2>
          <p className="text-lg text-slate-400 max-w-md mx-auto">
            Three simple steps to ensure your family's health from anywhere.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3 relative">

          {/* Connector line */}
          <div className="hidden md:block absolute top-[52px] left-[22%] right-[22%] h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(200,169,110,0.35), rgba(200,169,110,0.35), transparent)" }} />

          {steps.map((step, i) => (
            <div key={i} className="group relative flex flex-col items-center text-center">

              {/* Step number badge */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                <span className="text-[10px] font-bold tracking-widest text-gold opacity-60">{step.step}</span>
              </div>

              {/* Icon circle */}
              <div className="relative mb-8 mt-4">
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 group-hover:scale-110"
                  style={{
                    background: "rgba(200,169,110,0.08)",
                    border: "1.5px solid rgba(200,169,110,0.2)",
                    boxShadow: "0 0 0 8px rgba(200,169,110,0.04)",
                  }}
                >
                  {/* Inner glow on hover */}
                  <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ background: "radial-gradient(circle, rgba(200,169,110,0.15), transparent)" }} />
                  <step.icon className="h-9 w-9 text-gold relative z-10 transition-transform duration-500 group-hover:scale-110" />
                </div>
              </div>

              {/* Text */}
              <h3 className="text-xl font-bold text-white mb-3 group-hover:text-gold transition-colors duration-300">
                {step.title}
              </h3>
              <p className="text-slate-400 max-w-[220px] leading-relaxed text-[15px]">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}