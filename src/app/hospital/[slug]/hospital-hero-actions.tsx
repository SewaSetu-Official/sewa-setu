"use client";

import { useState } from "react";
import { Heart, Share2 } from "lucide-react";

// NOTE: mocked for now — saving/sharing will be wired up in a later pass.
export function HospitalHeroActions() {
  const [saved, setSaved] = useState(false);

  return (
    <div className="flex shrink-0 gap-2.5">
      <button
        type="button"
        aria-label={saved ? "Remove from saved" : "Save hospital"}
        aria-pressed={saved}
        onClick={() => setSaved((s) => !s)}
        className="flex h-[46px] w-[46px] items-center justify-center rounded-[13px] bg-white/[0.16] backdrop-blur-sm transition-colors hover:bg-white/25"
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
