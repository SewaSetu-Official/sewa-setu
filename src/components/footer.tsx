import Link from "next/link";
import Image from "next/image";
import { Facebook, Twitter, Instagram, Linkedin, Mail, Phone, MapPin } from "lucide-react";

export function Footer() {
  return (
    <footer id="contact" className="bg-[#0a1628] text-slate-300 border-t border-[rgba(200,169,110,0.15)]">

      {/* Main footer body */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
        <div className="flex flex-col lg:flex-row gap-12">

          {/* ── LEFT: Logo + description ── */}
          <div className="flex flex-row items-start gap-6 lg:w-[42%] shrink-0">
            <div className="shrink-0 transition-transform duration-300 hover:scale-110 hover:drop-shadow-[0_0_16px_rgba(200,169,110,0.5)]">
              <Image
                src="/SewaSetu-Logo.png"
                alt="Sewa-Setu"
                width={500}
                height={350}
                className="w-[260px] h-auto object-contain"
              />
            </div>
            <div className="pt-1">
              <div className="text-2xl font-bold text-white mb-1">
                Sewa<span className="text-[#c8a96e]">-Setu</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed mb-5">
                Bridging the distance between you and your family&apos;s health.
                Book prepaid health checkups for your loved ones in Nepal — from anywhere in the world.
              </p>
              <div className="flex gap-4">
                <a href="#" className="text-slate-500 hover:text-[#c8a96e] transition-colors"><Facebook className="h-5 w-5" /></a>
                <a href="#" className="text-slate-500 hover:text-[#c8a96e] transition-colors"><Twitter className="h-5 w-5" /></a>
                <a href="#" className="text-slate-500 hover:text-[#c8a96e] transition-colors"><Instagram className="h-5 w-5" /></a>
                <a href="#" className="text-slate-500 hover:text-[#c8a96e] transition-colors"><Linkedin className="h-5 w-5" /></a>
              </div>
            </div>
          </div>

          {/* ── Divider ── */}
          <div className="hidden lg:block w-px bg-[rgba(200,169,110,0.12)] self-stretch" />

          {/* ── RIGHT: 3 columns ── */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-10">

            {/* Quick Links */}
            <div>
              <h3 className="text-[#c8a96e] text-xs font-semibold uppercase tracking-widest mb-5">Quick Links</h3>
              <ul className="space-y-3 text-sm">
                <li><Link href="/search" className="hover:text-white transition-colors">Find a Hospital</Link></li>
                <li><Link href="/#how-it-works" className="hover:text-white transition-colors">How it Works</Link></li>
                <li><Link href="/sign-in" className="hover:text-white transition-colors">Sign In</Link></li>
                <li><Link href="/sign-up" className="hover:text-white transition-colors">Create Account</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="text-[#c8a96e] text-xs font-semibold uppercase tracking-widest mb-5">Company</h3>
              <ul className="space-y-3 text-sm">
                <li><Link href="#" className="hover:text-white transition-colors">About Us</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Contact Support</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Terms of Service</Link></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="text-[#c8a96e] text-xs font-semibold uppercase tracking-widest mb-5">Contact</h3>
              <ul className="space-y-4 text-sm text-slate-400">
                <li className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 text-[#c8a96e] mt-0.5 shrink-0" />
                  Kathmandu, Nepal
                </li>
                <li className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 text-[#c8a96e] shrink-0" />
                  support@sewa-setu.com
                </li>
                <li className="flex items-center gap-2.5">
                  <Phone className="h-4 w-4 text-[#c8a96e] shrink-0" />
                  +977 9800000000
                </li>
              </ul>
            </div>

          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-[rgba(200,169,110,0.1)] bg-[#07111e]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} Sewa-Setu Health Pvt Ltd. All rights reserved.</span>
          <span className="text-[#c8a96e]/50">Made with ❤️ for Nepal</span>
        </div>
      </div>

    </footer>
  );
}