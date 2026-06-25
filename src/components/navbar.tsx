"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState, useEffect } from "react";
import { SignedIn, SignedOut, useUser } from "@clerk/nextjs";
import { Menu, X, LayoutDashboard, ArrowRight, Globe } from "lucide-react";

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useAdminHref() {
  const { isSignedIn } = useUser();
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/admin/check")
      .then((r) => r.json())
      .then((d) => setHref(d.href ?? null))
      .catch(() => null);
  }, [isSignedIn]);

  return isSignedIn ? href : null;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BrandMark() {
  return (
    <Link href="/" className="group flex shrink-0 items-center gap-2.5">
      <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-brand shadow-[0_8px_18px_-8px_rgba(12,107,87,0.6)] transition-transform duration-300 group-hover:scale-105">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M3 16c3-6 6-9 9-9s6 3 9 9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M12 7v9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="12" cy="18.5" r="1.7" fill="#fff" />
        </svg>
      </span>
      <span className="font-display text-[21px] font-bold tracking-[-0.02em] text-ink">SewaSetu</span>
    </Link>
  );
}

function NavAvatar() {
  const { user } = useUser();
  const fullName = user?.fullName ?? "";
  const firstName = fullName.trim().split(" ")[0] || "Account";
  const initials = fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "U";
  return (
    <Link href="/profile" className="flex items-center gap-2 rounded-full border border-[rgba(20,33,29,0.1)] bg-white/70 py-1 pl-1 pr-3.5 transition-colors hover:border-brand/40">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-[12px] font-bold text-white">
        {user?.imageUrl
          ? <Image loader={({ src }) => src} unoptimized src={user.imageUrl} alt={fullName} width={32} height={32} className="h-full w-full object-cover" />
          : initials
        }
      </span>
      <span className="hidden text-[14.5px] font-semibold text-ink sm:block">{firstName}</span>
    </Link>
  );
}

// Filled brand CTA pill
function BrandButton({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-brand px-5 py-2.5 text-[15px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(12,107,87,0.6)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-dark hover:shadow-[0_14px_26px_-10px_rgba(12,107,87,0.7)]">
      {children}
      <ArrowRight className="h-[15px] w-[15px]" />
    </span>
  );
}

// ── Nav links ─────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Know when to go", href: "/#queue" },
  { label: "Find Hospitals", href: "/search" },
];

// ── Navbar ────────────────────────────────────────────────────────────────────

export function Navbar() {
  const [scrolled, setScrolled]     = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const adminHref                   = useAdminHref();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMobile = () => setMobileOpen(false);

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="fixed left-0 right-0 top-0 z-50 transition-all duration-300"
      style={{
        background: "rgba(246,244,238,0.82)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: scrolled ? "1px solid rgba(20,33,29,0.10)" : "1px solid rgba(20,33,29,0.07)",
        boxShadow: scrolled ? "0 8px 28px rgba(20,33,29,0.08)" : "none",
      }}
    >
      <div className="mx-auto grid h-[68px] max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6 lg:px-8">

        <div className="justify-self-start">
          <BrandMark />
        </div>

        {/* Desktop pill nav — centered */}
        <nav className="hidden items-center gap-0.5 justify-self-center rounded-full border border-[rgba(20,33,29,0.07)] bg-white/55 p-1 shadow-[0_4px_14px_-10px_rgba(20,33,29,0.3)] md:flex">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className="whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold text-ink-soft transition-all duration-200 hover:bg-white hover:text-ink hover:shadow-[0_3px_10px_-4px_rgba(20,33,29,0.25)]"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center justify-self-end gap-2.5">
          <button
            className="hidden items-center gap-1.5 rounded-full border border-[rgba(20,33,29,0.12)] px-3 py-2 text-[13px] font-bold text-ink-soft transition-colors hover:border-brand/50 hover:text-brand sm:flex"
            title="Language"
            type="button"
          >
            <Globe className="h-[15px] w-[15px]" />
            EN
          </button>

          {/* Signed out */}
          <SignedOut>
            <Link href="/sign-in" className="hidden whitespace-nowrap px-2 text-[15px] font-semibold text-ink transition-colors hover:text-brand md:block">
              Log in
            </Link>
            <Link href="/search" className="hidden md:block">
              <BrandButton>Book appointment</BrandButton>
            </Link>
          </SignedOut>

          {/* Signed in */}
          <SignedIn>
            {adminHref && (
              <Link href={adminHref} className="hidden items-center gap-1.5 px-2 text-[15px] font-semibold text-ink-soft transition-colors hover:text-brand md:flex">
                <LayoutDashboard className="h-4 w-4" />
                Admin
              </Link>
            )}
            <NavAvatar />
            <Link href="/search" className="hidden md:block">
              <BrandButton>Book appointment</BrandButton>
            </Link>
          </SignedIn>

          {/* Mobile toggle */}
          <button
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[rgba(20,33,29,0.12)] bg-white/70 transition-all md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-4 w-4 text-ink" /> : <Menu className="h-4 w-4 text-ink" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out md:hidden"
        style={{
          maxHeight: mobileOpen ? "380px" : "0px",
          borderTop: mobileOpen ? "1px solid rgba(20,33,29,0.08)" : "none",
        }}
      >
        <div className="flex flex-col gap-1 bg-page/98 px-4 py-4">
          {NAV_LINKS.map(({ label, href }) => (
            <Link key={label} href={href} onClick={closeMobile}
              className="rounded-lg px-4 py-3 text-sm font-semibold text-ink-soft transition-all hover:bg-brand-soft hover:text-ink">
              {label}
            </Link>
          ))}

          <div className="my-2 h-px bg-[rgba(20,33,29,0.08)]" />

          <SignedOut>
            <Link href="/partner" onClick={closeMobile}>
              <button className="w-full rounded-lg px-4 py-3 text-left text-sm font-semibold text-brand transition-all hover:bg-brand-soft">
                For Hospitals
              </button>
            </Link>
            <Link href="/sign-in" onClick={closeMobile}>
              <button className="w-full rounded-lg px-4 py-3 text-left text-sm font-semibold text-ink-soft transition-all hover:bg-brand-soft hover:text-ink">
                Log in
              </button>
            </Link>
            <Link href="/sign-up" onClick={closeMobile}>
              <button className="mt-1 w-full rounded-xl bg-brand py-3 text-sm font-bold text-white transition-all hover:bg-brand-dark">
                Sign Up
              </button>
            </Link>
          </SignedOut>

          <SignedIn>
            <Link href="/profile" onClick={closeMobile}>
              <button className="w-full rounded-lg px-4 py-3 text-left text-sm font-semibold text-ink-soft transition-all hover:bg-brand-soft hover:text-ink">
                Profile
              </button>
            </Link>
            {adminHref && (
              <Link href={adminHref} onClick={closeMobile}>
                <button className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-left text-sm font-semibold text-brand transition-all hover:bg-brand-soft">
                  <LayoutDashboard className="h-4 w-4" />
                  Admin Panel
                </button>
              </Link>
            )}
            <Link href="/search" onClick={closeMobile}>
              <button className="mt-1 w-full rounded-xl bg-brand py-3 text-sm font-bold text-white transition-all hover:bg-brand-dark">
                Book appointment
              </button>
            </Link>
          </SignedIn>
        </div>
      </div>
    </motion.header>
  );
}
