"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export function Navbar() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed top-0 left-0 right-0 z-50 bg-[#0f1e38]/95 backdrop-blur-md border-b border-[rgba(200,169,110,0.2)]"
    >
      <div className="container max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <Image
            src="/SewaSetu-Logo.png"
            alt="Sewa-Setu icon"
            width={150}
            height={105}
            className="h-[72px] w-auto object-contain transition-transform group-hover:scale-105"
            priority
          />
          <span className="text-xl font-bold text-white">
            Sewa<span className="text-[#c8a96e]">-Setu</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <Link href="/search" className="text-sm font-medium text-slate-300 hover:text-[#c8a96e] transition-colors">
            Find Hospitals
          </Link>
          <Link href="/#how-it-works" className="text-sm font-medium text-slate-300 hover:text-[#c8a96e] transition-colors">
            How It Works
          </Link>
          <Link href="/#contact" className="text-sm font-medium text-slate-300 hover:text-[#c8a96e] transition-colors">
            Contact
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <span className="text-lg grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all cursor-help" title="Serving Global Nepalese">
            🌍
          </span>

          <SignedOut>
            <Link href="/sign-in" className="hidden md:block">
              <button className="text-sm font-medium text-slate-300 hover:text-[#c8a96e] transition-colors px-3 py-1.5">
                Sign In
              </button>
            </Link>
          </SignedOut>

          <SignedIn>
            <Link href="/profile" className="hidden md:block">
              <button className="text-sm font-medium text-slate-300 hover:text-[#c8a96e] transition-colors">
                Profile
              </button>
            </Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>

          {/* Get Started button */}
          <SignedOut>
            <Link href="/sign-up">
              <button className="bg-gradient-to-r from-[#c8a96e] to-[#a88b50] text-[#0f1e38] font-semibold px-5 py-2.5 rounded-full text-sm hover:shadow-lg hover:shadow-[rgba(200,169,110,0.4)] transition-all hover:-translate-y-0.5">
                Get Started
              </button>
            </Link>
          </SignedOut>
          
          <SignedIn>
            <Link href="/search">
              <button className="bg-gradient-to-r from-[#c8a96e] to-[#a88b50] text-[#0f1e38] font-semibold px-5 py-2.5 rounded-full text-sm hover:shadow-lg hover:shadow-[rgba(200,169,110,0.4)] transition-all hover:-translate-y-0.5 hidden md:block">
                Get Started
              </button>
            </Link>
          </SignedIn>
        </div>
      </div>
    </motion.header>
  );
}