"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

const faqs = [
  { question: "How does Sewa-Setu work?",         answer: "Simply search for hospitals, select a checkup package, complete the booking and secure payment online. Your family member visits the hospital, and you receive digital reports instantly." },
  { question: "Is it safe to pay online?",        answer: "Yes, we use Stripe, a trusted payment processor used by millions worldwide. Your payment information is encrypted and secure. We never store your card details." },
  { question: "Can I book for multiple members?", answer: "Yes! You can book multiple checkups for different family members. Simply create separate bookings for each person or contact our support team for bulk bookings." },
  { question: "What if I need to reschedule?",    answer: "You can reschedule appointments up to 48 hours before the scheduled date through your booking. For urgent changes, contact our support team immediately." },
  { question: "How do I get my test reports?",    answer: "Test reports are sent digitally to your registered email within 24–48 hours of the checkup. You can also access them through your account dashboard anytime." },
  { question: "Which hospitals are available?",   answer: "We're partnered with 50+ top-rated hospitals across Nepal including Kathmandu, Pokhara, and Lalitpur. Use the search to find hospitals in your preferred location." },
];

export function FAQSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="py-28 bg-white">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-gold-dim mb-4">FAQ</p>
          <h2 className="text-4xl md:text-5xl font-bold text-navy mb-4">Frequently asked</h2>
          <p className="text-slate">Find answers to common questions about Sewa-Setu</p>
        </div>

        {/* Accordion */}
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-xl overflow-hidden transition-all duration-300"
              style={{
                background: open === i ? "#0f1e38" : "#f7f4ef",
                border: `1px solid ${open === i ? "#0f1e38" : "rgba(15,30,56,0.10)"}`,
                boxShadow: open === i ? "0 8px 32px rgba(15,30,56,0.15)" : "none",
              }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full px-6 py-5 flex items-center justify-between text-left gap-4"
              >
                <span
                  className="font-semibold text-[15px] leading-snug transition-colors duration-300"
                  style={{ color: open === i ? "#ffffff" : "#0f1e38" }}
                >
                  {faq.question}
                </span>
                <span
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300"
                  style={{
                    background: open === i ? "rgba(200,169,110,0.2)" : "rgba(15,30,56,0.06)",
                    border: `1px solid ${open === i ? "#c8a96e" : "rgba(15,30,56,0.12)"}`,
                    transform: open === i ? "rotate(45deg)" : "rotate(0deg)",
                  }}
                >
                  <Plus className="w-3.5 h-3.5 transition-colors duration-300"
                    style={{ color: open === i ? "#c8a96e" : "#0f1e38" }} />
                </span>
              </button>

              <div
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{ maxHeight: open === i ? "200px" : "0px" }}
              >
                <p className="px-6 pb-5 text-[15px] leading-relaxed"
                  style={{ color: "rgba(255,255,255,0.7)" }}>
                  {faq.answer}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-14 text-center">
          <p className="text-slate mb-5 text-[15px]">Still have questions?</p>
          <a
            href="mailto:support@sewasetu.com"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-[15px] font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-[rgba(15,30,56,0.15)] hover:-translate-y-0.5"
            style={{ background: "#0f1e38", color: "#c8a96e" }}
          >
            Contact support →
          </a>
        </div>
      </div>
    </section>
  );
}