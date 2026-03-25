"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Search } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { BookingList, type SerializedBooking } from "@/components/booking-detail-modal";

type Filter = "all" | "upcoming" | "past";

const TABS: { label: string; value: Filter }[] = [
  { label: "All",      value: "all" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Past",     value: "past" },
];

export default function AllBookingsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage]     = useState(1);
  const [bookings, setBookings] = useState<SerializedBooking[]>([]);
  const [total, setTotal]   = useState(0);
  const [totalAll, setTotalAll] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Reset page and clear list when filter changes
  useEffect(() => { setPage(1); setBookings([]); }, [filter]);

  useEffect(() => {
    const load = async () => {
      if (page === 1) setLoading(true);
      else setLoadingMore(true);

      try {
        const res = await fetch(`/api/bookings?filter=${filter}&page=${page}&pageSize=10`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setTotal(data.total ?? 0);
        setTotalAll(data.totalAll ?? 0);
        setHasMore(data.hasMore ?? false);
        setBookings((prev) => page === 1 ? data.bookings : [...prev, ...data.bookings]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, page]);

  return (
    <div className="min-h-screen bg-cream-warm">
      <Navbar />

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#0f1e38 0%,#1a3059 100%)" }} className="pt-24 pb-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <Link
            href="/profile"
            className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-sm font-medium transition-colors mb-6 bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-full border border-white/15"
          >
            <ArrowLeft size={14} /> Back to profile
          </Link>

          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-gold/20 flex items-center justify-center">
              <CalendarDays size={20} className="text-gold" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">Booking History</h1>
              <p className="text-white/50 text-sm">{totalAll} total booking{totalAll !== 1 ? "s" : ""}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                  filter === tab.value
                    ? "bg-gold text-navy"
                    : "bg-white/10 text-white/70 hover:bg-white/15 border border-white/15"
                }`}
              >
                {tab.label}
                {filter === tab.value && total > 0 && (
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${filter === tab.value ? "bg-navy/20 text-navy" : "bg-white/20"}`}>
                    {total}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-gold border-r-transparent" />
                <p className="mt-4 text-slate font-medium">Loading bookings...</p>
              </div>
            </div>
          ) : bookings.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-center px-6">
              <div className="h-16 w-16 rounded-full bg-gold/8 flex items-center justify-center">
                <Search size={24} className="text-gold-dim" />
              </div>
              <p className="font-semibold text-navy">No {filter !== "all" ? filter : ""} bookings found</p>
              <p className="text-sm text-slate">
                {filter === "upcoming"
                  ? "You have no upcoming appointments."
                  : filter === "past"
                  ? "No past bookings yet."
                  : "Your booking history will appear here."}
              </p>
              <Link href="/search">
                <button className="mt-2 px-5 py-2.5 rounded-xl bg-navy text-gold text-sm font-bold hover:bg-navy-mid transition-colors">
                  Find Hospitals
                </button>
              </Link>
            </div>
          ) : (
            <>
              <BookingList bookings={bookings} />

              {hasMore && (
                <div className="flex justify-center py-6 border-t border-gray-50">
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={loadingMore}
                    className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-navy text-gold font-semibold text-sm hover:bg-navy-mid transition-all disabled:opacity-60"
                  >
                    {loadingMore ? (
                      <>
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-gold border-r-transparent" />
                        Loading...
                      </>
                    ) : (
                      `Load More (${total - bookings.length} remaining)`
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
