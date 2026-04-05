"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type React from "react";
import { Star, ShieldCheck, BadgeCheck, MessageSquare, PenLine, Pencil, Trash2, Clock, ArrowUp, ArrowDown } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { ReviewModal } from "./review-modal";

function DeleteConfirmModal({ onConfirm, onCancel, loading }: { onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(7,17,30,0.7)", backdropFilter: "blur(8px)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[360px] rounded-[24px] overflow-hidden"
        style={{ background: "#fff", boxShadow: "0 32px 80px rgba(7,17,30,.5)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="px-8 pt-8 pb-5 flex flex-col items-center text-center">
          <div
            className="h-16 w-16 rounded-2xl flex items-center justify-center mb-5"
            style={{ background: "#fef2f2", border: "1.5px solid #fecaca" }}
          >
            <Trash2 className="h-7 w-7" style={{ color: "#e53e3e" }} />
          </div>
          <h3 className="text-lg font-extrabold text-navy mb-1.5">Delete Review?</h3>
          <p className="text-sm text-slate leading-relaxed max-w-[240px]">
            This will permanently remove your review. This action cannot be undone.
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 h-11 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40"
            style={{ border: "1.5px solid #e8e3da", color: "#6b7a96", background: "#fafaf9" }}
          >
            Keep it
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 h-11 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff", boxShadow: "0 4px 14px rgba(239,68,68,.4)" }}
          >
            {loading
              ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent" />
              : <><Trash2 size={14} /> Delete</>
            }
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: { fullName: string };
  isOwn?: boolean;
  isVerifiedPatient?: boolean;
}

interface Props {
  hospitalId: string;
  initialAverage: number;
  initialCount: number;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30)  return `${days} days ago`;
  if (days < 365) {
    const m = Math.floor(days / 30);
    return `${m} month${m > 1 ? "s" : ""} ago`;
  }
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0,2).toUpperCase();
}

function ratingColor(rating: number): string {
  if (rating <= 1) return "#ef4444";
  if (rating <= 2) return "#f97316";
  if (rating <= 3) return "#f59e0b";
  if (rating <= 4) return "#84cc16";
  return "#22c55e";
}

function StarDisplay({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map((s) => (
        <Star key={s} style={{
          width: size, height: size, flexShrink: 0,
          fill:  s <= value ? "#c8a96e" : "transparent",
          color: s <= value ? "#c8a96e" : "#ddd8d0",
          strokeWidth: 1.5,
        }} />
      ))}
    </div>
  );
}

type SortKey = "recent" | "highest" | "lowest";
const PAGE_SIZE = 5;

const SORT_OPTIONS: { key: SortKey; label: string; Icon: React.ElementType }[] = [
  { key: "recent",  label: "Most Recent", Icon: Clock },
  { key: "highest", label: "Highest",     Icon: ArrowUp },
  { key: "lowest",  label: "Lowest",      Icon: ArrowDown },
];

function sortReviews(list: Review[], sort: SortKey): Review[] {
  return [...list].sort((a, b) => {
    if (sort === "highest") return b.rating - a.rating || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sort === "lowest")  return a.rating - b.rating || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function ReviewsSection({ hospitalId, initialAverage, initialCount }: Props) {
  const { isSignedIn } = useAuth();
  const [reviews, setReviews]             = useState<Review[]>([]);
  const [average, setAverage]             = useState(initialAverage);
  const [count,   setCount]               = useState(initialCount);
  const [loading, setLoading]             = useState(true);
  const [showModal, setShowModal]         = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [deletingId, setDeletingId]       = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [sort, setSort]                   = useState<SortKey>("recent");
  const [visibleCount, setVisibleCount]   = useState(PAGE_SIZE);

  useEffect(() => {
    fetch(`/api/reviews?hospitalId=${hospitalId}`)
      .then((r) => r.json())
      .then((data: { reviews: Review[]; average: number | null; count: number }) => {
        setReviews(data.reviews ?? []);
        setAverage(data.average ?? 0);
        setCount(data.count ?? 0);
      })
      .finally(() => setLoading(false));
  }, [hospitalId]);

  const recalcAverage = (list: Review[]) =>
    list.length > 0
      ? Math.round((list.reduce((s, r) => s + r.rating, 0) / list.length) * 10) / 10
      : 0;

  const handleReviewSuccess = (updated: Review) => {
    if (editingReview) {
      const next = reviews.map((r) => r.id === updated.id ? { ...updated, isOwn: true } : r);
      setReviews(next);
      setAverage(recalcAverage(next));
    } else {
      const next = [{ ...updated, isOwn: true }, ...reviews];
      setReviews(next);
      setCount(count + 1);
      setAverage(recalcAverage(next));
    }
    setEditingReview(null);
    setShowModal(false);
  };

  const openEdit = (r: Review) => {
    setEditingReview(r);
    setShowModal(true);
  };

  const openWrite = () => {
    setEditingReview(null);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    setDeleteLoading(true);
    try {
      await fetch(`/api/reviews/${id}`, { method: "DELETE" });
      const next = reviews.filter((r) => r.id !== id);
      setReviews(next);
      setCount(next.length);
      setAverage(recalcAverage(next));
    } finally {
      setDeletingId(null);
      setDeleteLoading(false);
    }
  };

  const breakdown = [5,4,3,2,1].map((s) => ({
    star: s,
    n: reviews.filter((r) => r.rating === s).length,
  }));

  return (
    <div style={{ borderTop: "1px solid rgba(15,30,56,.08)", paddingTop: "1.5rem", marginTop: "1.5rem" }}>
      <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#9aa3b0] mb-4">Patient Reviews</p>

      <div>
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 rounded-full border-[3px] border-[#c8a96e] border-r-transparent animate-spin" />
          </div>

        ) : count === 0 ? (
          <div className="flex flex-col items-center py-16 text-center gap-3">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
              style={{ background: "#f7f4ef", border: "1.5px dashed #c8a96e66" }}>
              <MessageSquare className="h-6 w-6 text-gold-dim opacity-50" />
            </div>
            <div>
              <p className="font-bold text-navy text-sm">No reviews yet</p>
              <p className="text-xs text-slate mt-0.5">Reviews from verified patients appear here after their visit.</p>
            </div>
            {isSignedIn && (
              <button
                onClick={openWrite}
                className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold transition-colors"
                style={{ border: "1.5px solid rgba(200,169,110,.35)", color: "#a88b50", background: "transparent" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(200,169,110,.06)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <PenLine size={11} /> Be the first to review
              </button>
            )}
          </div>

        ) : (
          <div className="flex flex-col lg:flex-row gap-8">

            {/* ── Score panel ── */}
            <div className="flex-shrink-0 lg:w-48">
              {/* Big number */}
              <div className="rounded-2xl p-6 text-center mb-4"
                style={{ background: "#0f1e38" }}>
                <p className="text-5xl font-black text-white leading-none tabular-nums">
                  {average > 0 ? average.toFixed(1) : "—"}
                </p>
                <div className="flex justify-center mt-2.5 mb-2">
                  <StarDisplay value={Math.round(average)} size={15} />
                </div>
                <p className="text-[11px] text-white/40 font-medium">
                  {count} review{count !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Write a review */}
              {isSignedIn && !loading && (
                <button
                  onClick={openWrite}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-semibold transition-colors mb-4"
                  style={{ border: "1.5px solid rgba(200,169,110,.35)", color: "#a88b50", background: "transparent" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(200,169,110,.06)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <PenLine size={11} /> Write a review
                </button>
              )}

              {/* Bars */}
              <div className="space-y-2">
                {breakdown.map(({ star, n }) => (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate w-2.5">{star}</span>
                    <Star className="w-3.5 h-3.5 flex-shrink-0" style={{ fill: "#c8a96e", color: "#c8a96e" }} />
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#f0ece4" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: count > 0 ? `${(n / count) * 100}%` : "0%",
                          background: ratingColor(star),
                          transition: "width .6s ease",
                        }}
                      />
                    </div>
                    <span className="text-[11px] text-slate/50 w-3 text-right tabular-nums">{n}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Review list ── */}
            <div className="flex-1 min-w-0">
              {/* Sort segmented control */}
              <div
                className="inline-flex items-center p-1 rounded-xl mb-4"
                style={{ background: "#f0ece4" }}
              >
                {SORT_OPTIONS.map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    onClick={() => { setSort(key); setVisibleCount(PAGE_SIZE); }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[10px] text-[11px] font-semibold transition-all duration-200"
                    style={sort === key
                      ? { background: "#fff", color: "#0f1e38", boxShadow: "0 1px 6px rgba(15,30,56,.12)" }
                      : { background: "transparent", color: "#9aa3b0" }
                    }
                  >
                    <Icon size={11} />
                    {label}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
              {sortReviews(reviews, sort).slice(0, visibleCount).map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl p-5"
                  style={{ background: "#fdf9f5", border: "1px solid #f0ece4" }}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center text-xs font-extrabold flex-shrink-0"
                      style={{
                        background: "rgba(200,169,110,0.12)",
                        color: "#a88b50",
                        border: "1px solid rgba(200,169,110,0.25)",
                        fontFamily: "var(--font-plus-jakarta), sans-serif",
                      }}
                    >
                      {initials(r.user.fullName)}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Name row: name | stars | action buttons */}
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-bold text-navy leading-tight flex-1 min-w-0 truncate">{r.user.fullName}</p>

                        <StarDisplay value={r.rating} size={14} />

                        {/* Action buttons */}
                        {r.isOwn && (
                          <div
                            className="flex items-center flex-shrink-0 overflow-hidden"
                            style={{ border: "1px solid #e8e3da", borderRadius: 8, background: "#fff" }}
                          >
                            <button
                              onClick={() => openEdit(r)}
                              className="flex items-center justify-center w-7 h-7 transition-colors"
                              style={{ color: "#a88b50" }}
                              onMouseEnter={e => (e.currentTarget.style.background = "rgba(200,169,110,.1)")}
                              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                              title="Edit"
                            >
                              <Pencil size={12} />
                            </button>
                            <div style={{ width: 1, height: 14, background: "#e8e3da" }} />
                            <button
                              onClick={() => setDeletingId(r.id)}
                              className="flex items-center justify-center w-7 h-7 transition-colors"
                              style={{ color: "#e53e3e" }}
                              onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,.07)")}
                              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                              title="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Badge + time */}
                      <div className="flex items-center gap-1.5 mt-1">
                        {r.isVerifiedPatient ? (
                          <>
                            <ShieldCheck className="w-3 h-3 text-emerald-500" />
                            <span className="text-[10px] font-semibold text-emerald-600">Verified Patient</span>
                          </>
                        ) : (
                          <>
                            <BadgeCheck className="w-3 h-3 text-blue-400" />
                            <span className="text-[10px] font-semibold text-blue-500">Verified User</span>
                          </>
                        )}
                        <span className="text-[10px] text-slate/30">·</span>
                        <span className="text-[10px] text-slate/50">{timeAgo(r.createdAt)}</span>
                      </div>

                      {r.comment && (
                        <p className="text-sm text-slate leading-relaxed mt-2.5">{r.comment}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              </div>

              {/* Load more */}
              {(() => {
                const sorted = sortReviews(reviews, sort);
                const remaining = sorted.length - visibleCount;
                if (remaining <= 0) return null;
                return (
                  <div className="flex items-center justify-between mt-5 pt-4" style={{ borderTop: "1px solid #f0ece4" }}>
                    <p className="text-[11px] text-slate/50">
                      Showing <span className="font-semibold text-slate">{Math.min(visibleCount, sorted.length)}</span> of <span className="font-semibold text-slate">{sorted.length}</span> reviews
                    </p>
                    <button
                      onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all"
                      style={{ background: "#f0ece4", color: "#0f1e38", border: "1px solid #e8e3da" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#e8e3da")}
                      onMouseLeave={e => (e.currentTarget.style.background = "#f0ece4")}
                    >
                      Show {Math.min(remaining, PAGE_SIZE)} more
                    </button>
                  </div>
                );
              })()}
            </div>

          </div>
        )}
      </div>

      {showModal && (
        <ReviewModal
          hospitalId={hospitalId}
          hospitalName=""
          reviewId={editingReview?.id}
          initialRating={editingReview?.rating ?? 0}
          initialComment={editingReview?.comment ?? ""}
          onClose={() => { setShowModal(false); setEditingReview(null); }}
          onSuccess={handleReviewSuccess}
        />
      )}

      {deletingId && (
        <DeleteConfirmModal
          loading={deleteLoading}
          onConfirm={() => handleDelete(deletingId)}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  );
}
