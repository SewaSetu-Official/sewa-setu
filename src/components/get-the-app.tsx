const WaveEyebrow = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-2.5 text-[12.5px] font-extrabold uppercase tracking-[0.12em] text-brand">
    <svg width="22" height="9" viewBox="0 0 22 9" fill="none" className="shrink-0" aria-hidden>
      <path d="M1 8C5 2 17 2 21 8" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
    {children}
  </span>
);

function StoreButton({ top, bottom, children }: { top: string; bottom: string; children: React.ReactNode }) {
  return (
    <a href="#" className="flex items-center gap-3 rounded-[14px] bg-brand-deep px-5 py-3 text-white transition-transform hover:-translate-y-0.5">
      {children}
      <span>
        <span className="block text-[10px] opacity-80">{top}</span>
        <span className="block text-[15px] font-bold">{bottom}</span>
      </span>
    </a>
  );
}

export function GetTheApp() {
  return (
    <section className="bg-page py-16 md:py-20">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-10">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_.8fr] lg:gap-[52px]">
          {/* Left — copy */}
          <div>
            <WaveEyebrow>Care in your pocket</WaveEyebrow>
            <h2 className="font-display mt-3 text-[clamp(2rem,4.4vw,2.75rem)] font-bold leading-[1.04] tracking-[-0.03em] text-ink">
              Your hospital, one tap away
            </h2>
            <p className="mt-4 max-w-[440px] text-[17px] leading-[1.55] text-ink-soft">
              Search, book, and track appointments on the go. Get reminders and live queue updates so you
              never wait — or miss your turn — again.
            </p>
            <div className="mt-7 flex flex-wrap gap-3.5">
              <StoreButton top="GET IT ON" bottom="Google Play">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden>
                  <path d="M3 3.5v17l9-8.5zM13.5 13l2.8 2.6L6.5 21zM13.5 11 6.5 3l9.8 5.4zM14.6 12l3.4-3.1 2.5 1.4q1.4 1.7 0 3.4l-2.5 1.4z" />
                </svg>
              </StoreButton>
              <StoreButton top="DOWNLOAD ON THE" bottom="App Store">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden>
                  <path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.8-3-.8c-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .7 1.1 1.6 2.3 2.7 2.2 1.1 0 1.5-.7 2.8-.7s1.6.7 2.8.7 1.9-1.1 2.6-2.1c.8-1.2 1.2-2.4 1.2-2.4s-2.3-.9-2.3-3.5zM14.2 5.3c.6-.8 1-1.8.9-2.9-.9 0-2 .6-2.6 1.3-.6.7-1.1 1.7-.9 2.7 1 .1 2-.5 2.6-1.1z" />
                </svg>
              </StoreButton>
            </div>
          </div>

          {/* Right — phone mock */}
          <div className="flex justify-center">
            <div className="w-[280px] rounded-[38px] bg-brand-deep p-[11px] shadow-[0_40px_80px_-30px_rgba(20,33,29,0.55)]">
              <div className="overflow-hidden rounded-[29px] bg-page">
                <div className="bg-brand px-5 pb-7 pt-6 text-white">
                  <div className="flex items-center justify-between text-[12px] opacity-85">
                    <span>9:41</span>
                    <span>नमस्ते 👋</span>
                  </div>
                  <div className="font-display mt-4 text-[22px] font-bold tracking-[-0.01em]">Hi, Sushma</div>
                  <div className="text-[13px] text-[#CFE0D8]">How are you feeling today?</div>
                  <div className="mt-3.5 rounded-[12px] bg-white/[0.16] px-3.5 py-2.5 text-[13px] text-[#E6F0EC]">
                    🔍 Search doctors, hospitals…
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-3 rounded-[14px] bg-white p-3.5">
                    <span className="flex h-[42px] w-[42px] items-center justify-center rounded-[11px] bg-brand-soft text-lg">📅</span>
                    <div className="flex-1">
                      <div className="text-[13px] font-bold text-ink">Next: Dr. Anita Sharma</div>
                      <div className="text-[11.5px] text-ink-muted">Tomorrow · 11:30 AM · A-042</div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    <div className="rounded-[12px] bg-white p-3.5">
                      <div className="text-lg">🩺</div>
                      <div className="mt-1.5 text-[12.5px] font-bold text-ink">Find a doctor</div>
                    </div>
                    <div className="rounded-[12px] bg-white p-3.5">
                      <div className="text-lg">🏥</div>
                      <div className="mt-1.5 text-[12.5px] font-bold text-ink">Hospitals</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
