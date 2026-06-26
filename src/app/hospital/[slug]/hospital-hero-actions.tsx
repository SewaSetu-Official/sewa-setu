"use client";

import { useEffect, useState } from "react";
import { Heart, Share2 } from "lucide-react";

export function HospitalHeroActions({ hospitalId }: { hospitalId: string }) {
  const [saved, setSaved] = useState(false);
  const [savePending, setSavePending] = useState(false);

  // Hydrate the saved/favorite state for the signed-in user (false for anon).
  useEffect(() => {
    if (!hospitalId) return;
    fetch(`/api/favorites?hospitalId=${hospitalId}`)
      .then((r) => r.json())
      .then((d: { saved?: boolean }) => setSaved(Boolean(d.saved)))
      .catch(() => {});
  }, [hospitalId]);

  const toggleSave = async () => {
    if (savePending) return;
    setSavePending(true);
    const prev = saved;
    setSaved(!prev); // optimistic
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hospitalId }),
      });
      if (!res.ok) { setSaved(prev); return; } // e.g. 401 not signed in → revert
      const d = await res.json();
      setSaved(Boolean(d.saved));
    } catch {
      setSaved(prev);
    } finally {
      setSavePending(false);
    }
  };

  return (
    <div className="flex shrink-0 gap-2.5">
      <button
        type="button"
        aria-label={saved ? "Remove from saved" : "Save hospital"}
        aria-pressed={saved}
        onClick={toggleSave}
        disabled={savePending}
        className="flex h-[46px] w-[46px] items-center justify-center rounded-[13px] bg-white/[0.16] backdrop-blur-sm transition-colors hover:bg-white/25 disabled:opacity-60"
      >
        <Heart className={`h-5 w-5 text-white ${saved ? "fill-white" : ""}`} />
      </button>
      <button
        type="button"
        aria-label="Share hospital"
        className="flex h-[46px] w-[46px] items-center justify-center rounded-[13px] bg-white/[0.16] backdrop-blur-sm transition-colors hover:bg-white/25"
      >
        <Share2 className="h-5 w-5 text-white" />
      </button>
    </div>
  );
}
