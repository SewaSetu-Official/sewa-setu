import Link from "next/link";
import Image from "next/image";
import { Facebook, Twitter, Instagram, Linkedin, Mail, Phone, MapPin } from "lucide-react";
import { a } from "framer-motion/client";

export function Footer() {
  return (
    <footer id="contact" className="bg-[#07111e] text-slate-400 relative overflow-hidden">

      {/* ── Ambient top glow ── */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[1px] opacity-60"
        style={{ background: "linear-gradient(90deg, transparent, #c8a96e, transparent)" }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[80px] opacity-[0.06] blur-3xl rounded-full"
        style={{ background: "#c8a96e" }} />

      {/* ── Dot grid texture ── */}
      <div className="absolute inset-0 opacity-[0.025]" style={{
        backgroundImage: "radial-gradient(circle, rgba(200,169,110,0.8) 1px, transparent 1px)",
        backgroundSize: "36px 36px",
      }} />

      {/* ── MAIN BODY ── */}
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
        <div className="flex flex-col lg:flex-row gap-12">

          {/* ── LEFT: Logo + description (same width as original) ── */}
          <div className="flex flex-row items-start gap-6 lg:w-[42%] shrink-0">

            {/* Logo */}
            <div className="shrink-0 transition-all duration-300 hover:scale-105 hover:drop-shadow-[0_0_20px_rgba(200,169,110,0.45)]">
              <Image
                src="/SewaSetu-Logo.png"
                alt="Sewa-Setu"
                width={500}
                height={350}
                className="w-[260px] h-auto object-contain"
              />
            </div>

            {/* Brand info */}
            <div className="pt-1">
              <div className="text-2xl font-bold text-white mb-1">
                Sewa<span className="text-[#c8a96e]">-Setu</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed mb-5">
                Bridging the distance between you and your family&apos;s health.
                Book prepaid health checkups for your loved ones in Nepal — from anywhere in the world.
              </p>

              {/* Social icons */}
              <div className="flex gap-2 mb-5">
                {[
                  { icon: Facebook,  label: "Facebook"  },
                  { icon: Twitter,   label: "Twitter"   },
                  { icon: Instagram, label: "Instagram" },
                  { icon: Linkedin,  label: "LinkedIn"  },
                ].map(({ icon: Icon, label }) => (
                  <a
                    key={label}
                    href="#"
                    aria-label={label}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[#c8a96e] hover:-translate-y-0.5 transition-all duration-300"
                    style={{ background: "rgba(200,169,110,0.08)", border: "1px solid rgba(200,169,110,0.15)" }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* ── Divider ── */}
          <div
            className="hidden lg:block w-px self-stretch"
            style={{ background: "linear-gradient(to bottom, transparent, rgba(200,169,110,0.2), transparent)" }}
          />

          {/* ── RIGHT: 3 columns ── */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-10">

            {/* Quick Links */}
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c8a96e] mb-5">Quick Links</h3>
              <ul className="space-y-3 text-sm">
                {[
                  { label: "Find a Hospital", href: "/search" },
                  { label: "How it Works",    href: "/#how-it-works" },
                  { label: "Sign In",         href: "/sign-in" },
                  { label: "Create Account",  href: "/sign-up" },
                ].map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href} className="group flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors duration-200">
                      <span className="w-0 group-hover:w-3 h-px bg-[#c8a96e] transition-all duration-300 overflow-hidden" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c8a96e] mb-5">Company</h3>
              <ul className="space-y-3 text-sm">
                {[
                  { label: "About Us",         href: "#" },
                  { label: "Contact Support",  href: "#" },
                  { label: "Privacy Policy",   href: "#" },
                  { label: "Terms of Service", href: "#" },
                ].map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href} className="group flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors duration-200">
                      <span className="w-0 group-hover:w-3 h-px bg-[#c8a96e] transition-all duration-300 overflow-hidden" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c8a96e] mb-5">Contact</h3>
              <ul className="space-y-4 text-sm text-slate-400">
                {[
                  { icon: MapPin, text: "Kathmandu, Nepal",       href: null },
                  { icon: Mail,   text: "support@sewa-setu.com",  href: "mailto:support@sewa-setu.com" },
                  { icon: Phone,  text: "+977 9800000000",        href: "tel:+9779800000000" },
                ].map(({ icon: Icon, text, href }) => (
                  <li key={text}>
                    {href ? (
                      <a href={href} className="group flex items-center gap-2.5 hover:text-white transition-colors duration-200">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 group-hover:bg-[rgba(200,169,110,0.2)]"
                          style={{ background: "rgba(200,169,110,0.08)", border: "1px solid rgba(200,169,110,0.15)" }}
                        >
                          <Icon className="h-3.5 w-3.5 text-[#c8a96e]" />
                        </div>
                        {text}
                      </a>
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: "rgba(200,169,110,0.08)", border: "1px solid rgba(200,169,110,0.15)" }}
                        >
                          <Icon className="h-3.5 w-3.5 text-[#c8a96e]" />
                        </div>
                        {text}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>
      </div>

      {/* ── BOTTOM BAR ── */}
      <div className="relative border-t" style={{ borderColor: "rgba(200,169,110,0.1)", background: "rgba(0,0,0,0.3)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-xs text-slate-500">
            © {new Date().getFullYear()} Sewa-Setu Health Pvt Ltd. All rights reserved.
          </span>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <Link href="#" className="hover:text-slate-300 transition-colors">Privacy</Link>
            <span className="text-slate-700">·</span>
            <Link href="#" className="hover:text-slate-300 transition-colors">Terms</Link>
            <span className="text-slate-700">·</span>
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[#c8a96e]"
              style={{ background: "rgba(200,169,110,0.08)", border: "1px solid rgba(200,169,110,0.15)" }}
            >
              Made with ❤️ for Nepal
            </span>
          </div>
        </div>
      </div>

    </footer>
  );
}