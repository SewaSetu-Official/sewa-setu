"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState, useEffect } from "react";
import { SignedIn, SignedOut, useUser } from "@clerk/nextjs";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "Find Hospitals", href: "/search" },
  { label: "How It Works",   href: "/#how-it-works" },
  { label: "Contact",        href: "/#contact" },
];

function NavAvatar() {
  const { user } = useUser();
  const initials = user?.fullName?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "U";
  return (
    <Link href="/profile">
      <div className="h-8 w-8 rounded-full overflow-hidden flex items-center justify-center cursor-pointer ring-2 ring-[#c8a96e]/40 hover:ring-[#c8a96e] transition-all"
        style={{ background: "rgba(200,169,110,.15)" }}>
        {user?.imageUrl ? (
          <img src={user.imageUrl} alt={user.fullName ?? ""} className="h-full w-full object-cover" />
        ) : (
          <span className="text-[11px] font-black text-[#c8a96e]">{initials}</span>
        )}
      </div>
    </Link>
  );
}

export function Navbar() {
  const [scrolled, setScrolled]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
        style={{
          background: "#0a1228",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: scrolled
            ? "1px solid rgba(200,169,110,0.2)"
            : "1px solid rgba(200,169,110,0.08)",
          boxShadow: scrolled
            ? "0 8px 32px rgba(0,0,0,0.35)"
            : "none",
        }}
      >
        {/* Ambient top line */}
        <div
          className="absolute top-0 left-0 right-0 h-[1px]"
          style={{ background: "linear-gradient(90deg, transparent, rgba(200,169,110,0.5), transparent)" }}
        />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between">

          {/* ── Logo ── */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="transition-all duration-300 group-hover:drop-shadow-[0_0_12px_rgba(200,169,110,0.5)]">
              <Image
                src="/SewaSetu-Logo.png"
                alt="Sewa-Setu"
                width={150}
                height={105}
                className="h-[52px] w-auto object-contain transition-transform duration-300 group-hover:scale-105"
                priority
              />
            </div>
            <div>
              <span className="text-lg font-bold text-white leading-none">
                Sewa<span className="text-gold">-Setu</span>
              </span>
              <div className="text-[9px] text-slate-500 tracking-[0.15em] uppercase leading-none mt-0.5">
                For the people
              </div>
            </div>
          </Link>

          {/* ── Desktop Nav ── */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className="relative px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors duration-200 group"
              >
                {label}
                {/* Underline on hover */}
                <span
                  className="absolute bottom-0 left-4 right-4 h-px opacity-0 group-hover:opacity-100 transition-all duration-300"
                  style={{ background: "linear-gradient(90deg, transparent, #c8a96e, transparent)" }}
                />
              </Link>
            ))}
          </nav>

          {/* ── Right side ── */}
          <div className="flex items-center gap-2">

            {/* Globe */}
            <span
              className="hidden sm:block text-base grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-300 cursor-help mr-1"
              title="Serving Global Nepalese"
            >
              🌍
            </span>

            {/* Divider */}
            <div className="hidden sm:block h-5 w-px mx-1" style={{ background: "rgba(255,255,255,.1)" }} />

            {/* Sign In */}
            <SignedOut>
              <Link href="/sign-in" className="hidden md:block">
                <button className="text-sm font-medium text-slate-300 hover:text-gold transition-colors duration-200 px-3 py-1.5">
                  Sign In
                </button>
              </Link>
            </SignedOut>

            {/* Profile avatar */}
            <SignedIn>
              <NavAvatar />
            </SignedIn>

            {/* CTA button */}
            <SignedOut>
              <Link href="/sign-up">
                <button
                  className="relative text-sm font-bold text-navy px-5 py-2.5 rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-[rgba(200,169,110,0.35)] hover:-translate-y-0.5 hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg, #e8d5b0, #c8a96e, #a88b50)" }}
                >
                  Get Started
                </button>
              </Link>
            </SignedOut>

            <SignedIn>
              <Link href="/search" className="hidden md:block ml-1">
                <button
                  className="relative text-sm font-bold text-navy px-5 py-2.5 rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-[rgba(200,169,110,0.35)] hover:-translate-y-0.5 hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg, #e8d5b0, #c8a96e, #a88b50)" }}
                >
                  Book Now
                </button>
              </Link>
            </SignedIn>

            {/* Mobile menu toggle */}
            <button
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200"
              style={{ background: "rgba(200,169,110,0.08)", border: "1px solid rgba(200,169,110,0.15)" }}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen
                ? <X className="w-4 h-4 text-gold" />
                : <Menu className="w-4 h-4 text-gold" />
              }
            </button>
          </div>
        </div>

        {/* ── Mobile Menu ── */}
        <div
          className="md:hidden overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            maxHeight: mobileOpen ? "320px" : "0px",
            borderTop: mobileOpen ? "1px solid rgba(200,169,110,0.12)" : "none",
          }}
        >
          <div className="px-4 py-4 flex flex-col gap-1" style={{ background: "rgba(7,17,30,0.98)" }}>
            {navLinks.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="px-4 py-3 text-sm font-medium text-slate-300 hover:text-white hover:bg-gold/7 rounded-lg transition-all duration-200"
              >
                {label}
              </Link>
            ))}

            <div className="h-px my-2" style={{ background: "rgba(200,169,110,0.1)" }} />

            <SignedOut>
              <Link href="/sign-in" onClick={() => setMobileOpen(false)}>
                <button className="w-full text-left px-4 py-3 text-sm font-medium text-slate-300 hover:text-white hover:bg-gold/7 rounded-lg transition-all duration-200">
                  Sign In
                </button>
              </Link>
              <Link href="/sign-up" onClick={() => setMobileOpen(false)}>
                <button
                  className="w-full mt-1 py-3 rounded-xl text-sm font-bold text-navy transition-all duration-200"
                  style={{ background: "linear-gradient(135deg, #e8d5b0, #c8a96e, #a88b50)" }}
                >
                  Get Started
                </button>
              </Link>
            </SignedOut>

            <SignedIn>
              <Link href="/profile" onClick={() => setMobileOpen(false)}>
                <button className="w-full text-left px-4 py-3 text-sm font-medium text-slate-300 hover:text-white hover:bg-gold/7 rounded-lg transition-all duration-200">
                  Profile
                </button>
              </Link>
              <Link href="/search" onClick={() => setMobileOpen(false)}>
                <button
                  className="w-full mt-1 py-3 rounded-xl text-sm font-bold text-navy transition-all duration-200"
                  style={{ background: "linear-gradient(135deg, #e8d5b0, #c8a96e, #a88b50)" }}
                >
                  Book Now
                </button>
              </Link>
            </SignedIn>
          </div>
        </div>

      </motion.header>
    </>
  );
}