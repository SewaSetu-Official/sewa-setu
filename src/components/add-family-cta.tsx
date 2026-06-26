"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { createPortal } from "react-dom";
import { Plus, X, Users } from "lucide-react";

const TARGET = "/profile?tab=family";

export function AddFamilyCta() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [showSignIn, setShowSignIn] = useState(false);

  const handleClick = () => {
    if (!isLoaded) return;
    if (isSignedIn) router.push(TARGET);
    else setShowSignIn(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="flex w-full items-center justify-center gap-1.5 rounded-[13px] border-[1.5px] border-dashed border-[rgba(20,33,29,0.18)] py-2.5 text-[14px] font-semibold text-ink-soft transition-colors hover:border-brand/50 hover:text-brand"
      >
        <Plus className="h-4 w-4" />
        Add family member
      </button>

      {showSignIn && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:p-4"
          style={{ background: "rgba(20,33,29,0.5)", backdropFilter: "blur(6px)" }}
          onClick={() => setShowSignIn(false)}
        >
          <div
            className="relative w-full overflow-hidden rounded-t-[28px] sm:max-w-[380px] sm:rounded-[28px]"
            style={{ background: "#fff", boxShadow: "0 40px 90px -30px rgba(0,0,0,.55)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center px-8 pb-5 pt-8 text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                <Users className="h-7 w-7" />
              </div>
              <h3 className="font-display mb-1.5 text-lg font-bold text-ink">Please sign in</h3>
              <p className="max-w-[260px] text-sm leading-relaxed text-ink-soft">
                Sign in to save family members and book appointments on their behalf.
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setShowSignIn(false)}
                className="h-11 flex-1 rounded-xl text-sm font-semibold text-ink-soft transition-colors hover:bg-page"
                style={{ border: "1.5px solid rgba(20,33,29,.14)" }}
              >
                Not now
              </button>
              <button
                onClick={() => { window.location.href = `/sign-in?redirect_url=${encodeURIComponent(TARGET)}`; }}
                className="h-11 flex-1 rounded-xl text-sm font-bold text-white transition-all"
                style={{ background: "#0C6B57", boxShadow: "0 4px 18px rgba(12,107,87,.35)" }}
              >
                Sign in
              </button>
            </div>
            <button
              onClick={() => setShowSignIn(false)}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-page transition-colors hover:bg-[rgba(20,33,29,0.08)]"
            >
              <X size={14} className="text-ink-soft" />
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
