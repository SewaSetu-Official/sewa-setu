"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Rajesh Sharma",
    location: "United States",
    initials: "RS",
    text: "I was worried about my parents' health while working abroad. Sewa-Setu made it so easy to book their checkups. They got priority service and I received the report within hours!",
    rating: 5,
  },
  {
    name: "Priya Poudel",
    location: "United Kingdom",
    initials: "PP",
    text: "The entire process was so smooth. From searching hospitals to payment and receiving reports — everything was transparent and secure. Highly recommended!",
    rating: 5,
  },
  {
    name: "Amit Yadav",
    location: "Australia",
    initials: "AY",
    text: "Best service for healthcare needs back home. The hospital staff was professional and the digital reports were comprehensive. My family is very satisfied.",
    rating: 5,
  },
];

export function TestimonialsSection() {
  const [current, setCurrent] = useState(0);
  const t = testimonials[current];

  return (
    <section className="py-28 bg-cream-warm relative overflow-hidden">

      {/* Decorative top line */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(200,169,110,0.3), transparent)" }} />

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-gold-dim mb-4">Testimonials</p>
          <h2 className="text-4xl md:text-5xl font-bold text-navy mb-4">What families say</h2>
          <p className="text-slate text-lg">
            Real stories from people who trust Sewa-Setu for their family's{" "}
            <span className="text-gold font-medium">health</span>
          </p>
        </div>

        {/* Card */}
        <div
          className="relative rounded-2xl p-8 md:p-12 mb-8 overflow-hidden"
          style={{
            background: "#0f1e38",
            boxShadow: "0 24px 64px rgba(15,30,56,0.18)",
          }}
        >
          {/* Subtle grid */}
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
            backgroundSize: "32px 32px"
          }} />

          {/* Quote icon */}
          <div className="absolute top-8 right-8 opacity-10">
            <Quote className="w-16 h-16 text-gold" />
          </div>

          <div className="relative z-10">
            {/* Stars */}
            <div className="flex gap-1 mb-6">
              {[...Array(t.rating)].map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-gold text-gold" />
              ))}
            </div>

            {/* Quote */}
            <p className="text-lg md:text-xl text-white/90 mb-10 leading-relaxed">
              &ldquo;{t.text}&rdquo;
            </p>

            {/* Author */}
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: "rgba(200,169,110,0.15)", color: "#c8a96e", border: "1px solid rgba(200,169,110,0.3)" }}
              >
                {t.initials}
              </div>
              <div>
                <p className="font-semibold text-white">{t.name}</p>
                <p className="text-gold text-sm">{t.location}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-5">
          <button
            onClick={() => setCurrent((current - 1 + testimonials.length) % testimonials.length)}
            aria-label="Previous testimonial"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white border border-navy/20 text-navy hover:bg-navy hover:text-gold hover:border-navy transition-all duration-300"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="flex gap-2 items-center">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`Go to testimonial ${i + 1}`}
                aria-current={i === current ? "true" : undefined}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === current ? "28px" : "8px",
                  height: "8px",
                  background: i === current ? "#c8a96e" : "rgba(15,30,56,0.2)",
                }}
              />
            ))}
          </div>

          <button
            onClick={() => setCurrent((current + 1) % testimonials.length)}
            aria-label="Next testimonial"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white border border-navy/20 text-navy hover:bg-navy hover:text-gold hover:border-navy transition-all duration-300"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </section>
  );
}