"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Star, CheckCircle2 } from "lucide-react";

interface ReviewResult {
  id: string; rating: number; comment: string | null; createdAt: string;
  user: { fullName: string }; isOwn?: boolean;
}

interface Props {
  hospitalId: string;
  hospitalName: string;
  reviewId?: string;       // set → edit mode
  initialRating?: number;
  initialComment?: string;
  onClose: () => void;
  onSuccess: (review: ReviewResult) => void;
}

const LABELS: Record<number, { text: string; color: string }> = {
  1: { text: "Poor",      color: "#C0556B" },
  2: { text: "Fair",      color: "#C0763A" },
  3: { text: "Good",      color: "#7B857F" },
  4: { text: "Very good", color: "#E0913A" },
  5: { text: "Excellent", color: "#0C6B57" },
};

export function ReviewModal({
  hospitalId, hospitalName,
  reviewId, initialRating = 0, initialComment = "",
  onClose, onSuccess,
}: Props) {
  const isEdit = Boolean(reviewId);

  const [rating, setRating]   = useState(initialRating);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState(initialComment);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [done, setDone]       = useState(false);

  const active = hovered || rating;

  const handleSubmit = async () => {
    if (!rating) { setError("Please select a rating before submitting."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = isEdit
        ? await fetch(`/api/reviews/${reviewId}`, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ rating, comment }),
          })
        : await fetch("/api/reviews", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ hospitalId, rating, comment }),
          });

      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); setSaving(false); return; }
      setDone(true);
      setTimeout(() => onSuccess(data), 1500);
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  };

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: "rgba(20,33,29,0.5)", backdropFilter: "blur(6px)" }}
      onClick={!done ? onClose : undefined}
    >
      <div
        className="w-full sm:max-w-[400px] rounded-t-[28px] sm:rounded-[28px] overflow-hidden"
        style={{ background: "#fff", boxShadow: "0 40px 90px -30px rgba(0,0,0,.55)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          /* ── Success ── */
          <div className="px-8 py-14 flex flex-col items-center text-center">
            <div
              className="h-20 w-20 rounded-full flex items-center justify-center mb-6"
              style={{ background: "linear-gradient(135deg,#E6F0EC,#cfe6dd)", border: "2px solid rgba(12,107,87,.35)" }}
            >
              <CheckCircle2 className="h-9 w-9" style={{ color: "#0C6B57" }} />
            </div>
            <h3 className="font-display text-2xl font-bold text-ink mb-2">
              {isEdit ? "Updated!" : "Thank you!"}
            </h3>
            <p className="text-sm text-ink-soft leading-relaxed max-w-[260px]">
              {isEdit
                ? "Your review has been updated."
                : <>Your review for <span className="font-semibold text-ink">{hospitalName}</span> helps families make better decisions.</>
              }
            </p>
            <div className="flex gap-1 mt-5">
              {[1,2,3,4,5].map((s) => (
                <Star key={s} className="w-5 h-5" style={{
                  fill:  s <= rating ? "#E0913A" : "transparent",
                  color: s <= rating ? "#E0913A" : "#DAD4C8",
                }} />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* ── Top bar ── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(20,33,29,0.08)]">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C0763A]">
                  {isEdit ? "Edit review" : "Leave a review"}
                </p>
                <p className="text-sm font-bold text-ink mt-0.5 leading-tight line-clamp-1">{hospitalName}</p>
              </div>
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-full flex items-center justify-center bg-page transition-colors hover:bg-[rgba(20,33,29,0.08)]"
              >
                <X size={14} className="text-ink-soft" />
              </button>
            </div>

            {/* ── Stars hero ── */}
            <div className="px-6 pt-8 pb-6 text-center" style={{ background: "#F8FBF7" }}>
              <p className="text-xs text-ink-muted mb-5 font-medium">How was your overall experience?</p>

              <div className="flex items-center justify-center gap-2 mb-3">
                {[1,2,3,4,5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setRating(s); setError(null); }}
                    onMouseEnter={() => setHovered(s)}
                    onMouseLeave={() => setHovered(0)}
                    className="transition-all duration-150"
                    style={{ transform: s <= active ? "scale(1.15)" : "scale(1)" }}
                  >
                    <Star
                      className="w-11 h-11 transition-all duration-150"
                      style={{
                        fill:   s <= active ? "#E0913A" : "transparent",
                        color:  s <= active ? "#E0913A" : "#DAD4C8",
                        filter: s <= active ? "drop-shadow(0 3px 6px rgba(224,145,58,.45))" : "none",
                        strokeWidth: 1.5,
                      }}
                    />
                  </button>
                ))}
              </div>

              <div className="h-5 flex items-center justify-center">
                {active > 0
                  ? <span className="text-sm font-bold" style={{ color: LABELS[active].color }}>{LABELS[active].text}</span>
                  : <span className="text-xs text-ink-muted">Tap to rate</span>
                }
              </div>
            </div>

            {/* ── Comment ── */}
            <div className="px-6 pb-2 pt-4">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-2">
                Your comment <span className="font-normal normal-case">(optional)</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Staff, facilities, wait time, cleanliness..."
                className="w-full rounded-xl px-4 py-3 text-sm text-ink placeholder:text-ink-muted resize-none outline-none transition-all"
                style={{ background: "#F6F4EE", border: "1.5px solid rgba(20,33,29,0.12)" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#0C6B57")}
                onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(20,33,29,0.12)")}
              />
              <div className="flex items-center justify-between mt-1.5 mb-2">
                {error
                  ? <p className="text-xs font-semibold" style={{ color: "#C0556B" }}>{error}</p>
                  : <span />
                }
                <p className="text-[10px] text-ink-muted ml-auto">{comment.length}/500</p>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="px-6 pb-6 pt-2 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="h-11 px-6 rounded-xl text-sm font-semibold text-ink-soft transition-all hover:bg-page disabled:opacity-40"
                style={{ border: "1.5px solid rgba(20,33,29,0.14)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || !rating}
                className="flex-1 h-11 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                style={{
                  background: rating && !saving ? "#0C6B57" : "#e8e4de",
                  color:      rating && !saving ? "#fff" : "#a0a8b4",
                  boxShadow:  rating && !saving ? "0 4px 18px rgba(12,107,87,.35)" : "none",
                }}
              >
                {saving ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent" />
                ) : isEdit ? "Save changes" : "Submit review"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
