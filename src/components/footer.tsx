import Link from "next/link";
import { Facebook, Instagram, Twitter, Youtube, ArrowRight } from "lucide-react";

const FOOTER_COLS = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Find doctors", href: "/#doctors" },
      { label: "Specialties", href: "/#specialties" },
      { label: "Queue tracking", href: "/#queue" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "For hospitals", href: "/partner" },
      { label: "Careers", href: "#" },
      { label: "Contact", href: "#contact" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help center", href: "#" },
      { label: "Privacy policy", href: "#" },
      { label: "Terms of service", href: "#" },
    ],
  },
];

const SOCIALS = [
  { label: "Facebook", Icon: Facebook },
  { label: "Instagram", Icon: Instagram },
  { label: "X", Icon: Twitter },
  { label: "YouTube", Icon: Youtube },
];

export function Footer() {
  return (
    <footer id="contact" className="relative overflow-hidden bg-brand-deep text-[#C7D2CD]">
      {/* ambient glows */}
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-36 h-[460px] w-[460px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(12,107,87,.5), transparent 68%)" }} />
      <div aria-hidden className="pointer-events-none absolute -left-32 top-10 h-[340px] w-[340px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(224,145,58,.16), transparent 70%)" }} />

      <div className="relative mx-auto max-w-[1200px] px-5 pt-[74px] sm:px-8 lg:px-10">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          {/* brand + newsletter + social */}
          <div className="max-w-[330px]">
            <div className="flex items-center gap-3">
              <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-brand shadow-[0_8px_20px_-8px_rgba(12,107,87,0.8)]">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M3 16c3-6 6-9 9-9s6 3 9 9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
                  <path d="M12 7v9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
                  <circle cx="12" cy="18.5" r="1.7" fill="#fff" />
                </svg>
              </span>
              <span className="font-display text-[21px] font-bold text-white">SewaSetu</span>
            </div>
            <p className="mt-5 text-[14.5px] leading-[1.6] text-[#9FB0AA]">
              The bridge between patients and hospitals across Nepal — find care, book appointments, and skip the queue.
            </p>

            <div className="mb-3 mt-6 text-[12px] font-bold uppercase tracking-[0.1em] text-[#7E908A]">
              Get care tips &amp; updates
            </div>
            <form className="flex max-w-[320px] items-center gap-2 rounded-[13px] border border-white/[0.12] bg-white/[0.06] py-[5px] pl-[15px] pr-[5px]">
              <input
                placeholder="Your email address"
                aria-label="Email address"
                className="min-w-0 flex-1 border-0 bg-transparent text-[14px] text-white outline-none placeholder:text-[#7E908A]"
              />
              <button
                type="button"
                className="flex shrink-0 items-center gap-1.5 rounded-[9px] bg-brand px-4 py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-brand-dark"
              >
                Join
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </form>

            <div className="mt-6 flex gap-2.5">
              {SOCIALS.map(({ label, Icon }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-white/10 bg-white/[0.06] text-[#9FB0AA] transition-all hover:-translate-y-0.5 hover:border-brand hover:bg-brand hover:text-white"
                >
                  <Icon className="h-[17px] w-[17px]" />
                </a>
              ))}
            </div>
          </div>

          {/* link columns */}
          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <div className="mb-[17px] text-[12.5px] font-bold uppercase tracking-[0.05em] text-white">{col.title}</div>
              <div className="flex flex-col gap-3.5 text-[14.5px]">
                {col.links.map((l) => (
                  <Link
                    key={l.label}
                    href={l.href}
                    className="w-fit text-[#9FB0AA] transition-all hover:pl-[5px] hover:text-white"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* giant wordmark watermark */}
        <div aria-hidden className="mt-14 -mb-4 select-none">
          <svg viewBox="0 16 1000 158" width="100%" className="block overflow-visible">
            <defs>
              <linearGradient id="ssWordmark" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#9FC6B8" stopOpacity=".30" />
                <stop offset="1" stopColor="#10221E" stopOpacity="0" />
              </linearGradient>
            </defs>
            <text
              x="0"
              y="172"
              textLength="1000"
              lengthAdjust="spacingAndGlyphs"
              fontFamily="var(--font-bricolage), sans-serif"
              fontWeight="700"
              fontSize="200"
              fill="url(#ssWordmark)"
            >
              SewaSetu
            </text>
          </svg>
        </div>
      </div>

      {/* bottom bar */}
      <div className="relative z-[2] border-t border-white/[0.08] bg-brand-deep">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-5 pb-10 pt-5 sm:px-8 lg:px-10">
          <span className="text-[13.5px] text-[#7E908A]">© {new Date().getFullYear()} SewaSetu · Made in Nepal 🇳🇵</span>
          <div className="flex flex-wrap items-center gap-5">
            <span className="flex items-center gap-2 text-[13px] font-semibold text-[#9FB0AA]">
              <span className="relative h-2 w-2">
                <span className="ss-pulse absolute inset-0 rounded-full bg-[#3FD08C]" />
                <span className="absolute inset-0 rounded-full bg-[#3FD08C]" />
              </span>
              All systems operational
            </span>
            <span className="rounded-full border border-white/[0.12] px-3 py-1.5 text-[13px] font-semibold text-[#9FB0AA]">
              English
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
