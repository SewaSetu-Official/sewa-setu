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
      style={{ background: "rgba(20,33,29,0.5)", backdropFilter: "blur(6px)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[360px] rounded-[24px] overflow-hidden"
        style={{ background: "#fff", boxShadow: "0 40px 90px -30px rgba(0,0,0,.55)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="px-8 pt-8 pb-5 flex flex-col items-center text-center">
          <div
            className="h-16 w-16 rounded-2xl flex items-center justify-center mb-5"
            style={{ background: "#FBEAEE", border: "1.5px solid rgba(192,85,107,.3)" }}
          >
            <Trash2 className="h-7 w-7" style={{ color: "#C0556B" }} />
          </div>
          <h3 className="font-display text-lg font-bold text-ink mb-1.5">Delete review?</h3>
          <p className="text-sm text-ink-soft leading-relaxed max-w-[240px]">
            This will permanently remove your review. This action cannot be undone.
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 h-11 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40"
            style={{ border: "1.5px solid rgba(20,33,29,.14)", color: "#46524D", background: "#fff" }}
          >
            Keep it
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 h-11 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: "#C0556B", color: "#fff", boxShadow: "0 4px 14px rgba(192,85,107,.4)" }}
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

function StarDisplay({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map((s) => (
        <Star key={s} style={{
          width: size, height: size, flexShrink: 0,
          fill:  s <= value ? "#E0913A" : "#DAD4C8",
          color: s <= value ? "#E0913A" : "#DAD4C8",
          strokeWidth: 0,
        }} />
      ))}
    </div>
  );
}

// Avatar gradients matching the rest of the hospital page.
const AVATAR_GRAD = [
  "linear-gradient(140deg,#1C7A64,#0C6B57)",
  "linear-gradient(140deg,#CF6E83,#C0556B)",
  "linear-gradient(140deg,#9356A6,#7A3E8E)",
  "linear-gradient(140deg,#566B7A,#3C4742)",
  "linear-gradient(140deg,#E89B47,#cf7f29)",
];

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

  const sorted = sortReviews(reviews, sort);
  const remaining = sorted.length - visibleCount;

  return (
    <div className="rounded-[22px] border border-[rgba(20,33,29,0.07)] bg-white p-6 sm:p-7">
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand border-r-transparent" />
        </div>

      ) : count === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div>
            <p className="font-display text-[16px] font-bold text-ink">No reviews yet</p>
            <p className="mt-0.5 text-sm text-ink-muted">Reviews from verified patients appear here after their visit.</p>
          </div>
          {isSignedIn && (
            <button
              onClick={openWrite}
              className="mt-1 flex items-center gap-1.5 rounded-[10px] bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark"
            >
              <PenLine size={13} /> Be the first to review
            </button>
          )}
        </div>

      ) : (
        <div className="grid gap-8 lg:grid-cols-[260px_1fr] lg:items-start">

          {/* ── Score panel ── */}
          <div className="text-center lg:border-r lg:border-[rgba(20,33,29,0.07)] lg:pr-8">
            <div className="font-display text-[56px] font-bold leading-none tracking-[-0.03em] text-ink tabular-nums">
              {average > 0 ? average.toFixed(1) : "—"}
            </div>
            <div className="mt-2 flex justify-center">
              <StarDisplay value={Math.round(average)} size={18} />
            </div>
            <p className="mt-2 text-[13px] text-ink-muted">
              Based on {count.toLocaleString()} review{count !== 1 ? "s" : ""}
            </p>

            {/* Bars */}
            <div className="mt-[18px] space-y-[7px]">
              {breakdown.map(({ star, n }) => (
                <div key={star} className="flex items-center gap-[9px]">
                  <span className="w-2.5 text-[12px] text-ink-muted">{star}</span>
                  <span className="h-[7px] flex-1 overflow-hidden rounded-full" style={{ background: "#EFEAE0" }}>
                    <span
                      className="block h-full rounded-full"
                      style={{ width: count > 0 ? `${(n / count) * 100}%` : "0%", background: "#E0913A", transition: "width .6s ease" }}
                    />
                  </span>
                  <span className="w-[30px] text-right text-[11.5px] text-[#9AA39E] tabular-nums">
                    {count > 0 ? `${Math.round((n / count) * 100)}%` : "0%"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Review list ── */}
          <div className="min-w-0">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-display text-[20px] font-bold tracking-[-0.02em] text-ink">
                Patient reviews <span className="text-[14px] font-semibold text-[#9AA39E]">({count})</span>
              </h2>
              {isSignedIn && (
                <button
                  onClick={openWrite}
                  className="flex shrink-0 items-center gap-1.5 rounded-[10px] bg-brand px-4 py-2 text-[13px] font-semibold text-white shadow-[0_10px_22px_-12px_rgba(12,107,87,0.8)] transition-colors hover:bg-brand-dark"
                >
                  <PenLine size={14} /> Write a review
                </button>
              )}
            </div>

            {/* Sort segmented control */}
            <div className="mb-5 inline-flex items-center rounded-[10px] p-1" style={{ background: "#EFEAE0" }}>
              {SORT_OPTIONS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => { setSort(key); setVisibleCount(PAGE_SIZE); }}
                  className="flex items-center gap-1.5 rounded-[8px] px-3.5 py-1.5 text-[11.5px] font-semibold transition-all"
                  style={sort === key
                    ? { background: "#fff", color: "#0C6B57", boxShadow: "0 1px 6px rgba(20,33,29,.12)" }
                    : { background: "transparent", color: "#7B857F" }
                  }
                >
                  <Icon size={11} />
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-4">
              {sorted.slice(0, visibleCount).map((r, i) => (
                <div key={r.id} className="border-b border-[rgba(20,33,29,0.06)] pb-4 last:border-b-0 last:pb-0">
                  <div className="flex items-start gap-[11px]">
                    {/* Avatar */}
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-bold text-white"
                      style={{ background: AVATAR_GRAD[i % AVATAR_GRAD.length], fontFamily: "var(--font-bricolage), sans-serif" }}
                    >
                      {initials(r.user.fullName)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-bold text-ink">{r.user.fullName}</span>
                        <span className="flex items-center gap-1 rounded-full bg-brand-soft px-[7px] py-0.5 text-[10.5px] font-bold text-brand">
                          {r.isVerifiedPatient ? <ShieldCheck className="h-3 w-3" /> : <BadgeCheck className="h-3 w-3" />}
                          {r.isVerifiedPatient ? "Verified patient" : "Verified user"}
                        </span>
                      </div>
                      <div className="mt-[3px] flex items-center gap-2">
                        <StarDisplay value={r.rating} size={12} />
                        <span className="text-[11.5px] text-[#9AA39E]">{timeAgo(r.createdAt)}</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    {r.isOwn && (
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          onClick={() => openEdit(r)}
                          title="Edit"
                          className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-[rgba(20,33,29,0.12)] bg-white text-ink-soft transition-colors hover:bg-page"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeletingId(r.id)}
                          title="Delete"
                          className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-[rgba(192,85,107,0.25)] transition-colors"
                          style={{ background: "#FBEAEE", color: "#C0556B" }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {r.comment && (
                    <p className="mt-[11px] text-[13.5px] leading-[1.6] text-ink-soft">{r.comment}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Load more */}
            {remaining > 0 && (
              <button
                onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                className="mt-[18px] rounded-[11px] border border-[rgba(20,33,29,0.12)] bg-white px-5 py-2.5 text-[13.5px] font-bold text-ink transition-colors hover:bg-page"
              >
                Show more reviews
              </button>
            )}
          </div>

        </div>
      )}

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
