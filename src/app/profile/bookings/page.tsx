"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarDays, Search, Loader2 } from "lucide-react";
import { BookingList, type SerializedBooking } from "@/components/booking-detail-modal";

type Filter = "all" | "upcoming" | "past";

const TABS: { label: string; value: Filter }[] = [
  { label: "All",      value: "all" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Past",     value: "past" },
];

function AllBookingsContent() {
  const searchParams = useSearchParams();
  const initialFilter = (searchParams.get("filter") as Filter) ?? "all";
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [page, setPage]     = useState(1);
  const [bookings, setBookings] = useState<SerializedBooking[]>([]);
  const [total, setTotal]   = useState(0);
  const [totalAll, setTotalAll] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true); // skeleton only on first ever load
  const [transitioning, setTransitioning] = useState(false); // fade on tab switch
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => { setPage(1); }, [filter]);

  useEffect(() => {
    const load = async () => {
      if (page === 1 && initialLoad) {
        // first paint — show skeleton
      } else if (page === 1) {
        // tab switch — just fade, keep old list
        setTransitioning(true);
      } else {
        setLoadingMore(true);
      }

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
        setInitialLoad(false);
        setTransitioning(false);
        setLoadingMore(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, page]);

  return (
    <div className="min-h-screen bg-cream-warm">

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#0f1e38 0%,#1a3059 100%)" }} className="pt-8 pb-8 relative">

        {/* Back button — same style as profile page */}
        <Link
          href="/profile"
          className="absolute top-4 left-16 inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full transition-all group"
          style={{ color: "rgba(255,255,255,.5)", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}
        >
          <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="group-hover:text-white/80 transition-colors">Profile</span>
        </Link>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10">
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
        <div
          className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
          style={{ transition: "opacity 0.18s ease", opacity: transitioning ? 0.45 : 1 }}
        >
          {initialLoad ? (
            <div className="animate-pulse divide-y divide-gray-50">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <div className="h-10 w-10 rounded-xl flex-shrink-0 bg-gray-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-40 rounded bg-gray-100" />
                    <div className="h-2.5 w-64 rounded bg-gray-100" />
                  </div>
                  <div className="h-6 w-20 rounded-full bg-gray-100 flex-shrink-0" />
                </div>
              ))}
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
                <div className="border-t border-gray-50">
                  {loadingMore ? (
                    <div className="animate-pulse divide-y divide-gray-50">
                      {[1, 2].map((i) => (
                        <div key={i} className="flex items-center gap-4 px-6 py-4">
                          <div className="h-10 w-10 rounded-xl flex-shrink-0 bg-gray-100" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3.5 w-40 rounded bg-gray-100" />
                            <div className="h-2.5 w-64 rounded bg-gray-100" />
                          </div>
                          <div className="h-6 w-20 rounded-full bg-gray-100 flex-shrink-0" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex justify-center py-6">
                      <button
                        onClick={() => setPage((p) => p + 1)}
                        className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-navy text-gold font-semibold text-sm hover:bg-navy-mid transition-all"
                      >
                        Load More ({total - bookings.length} remaining)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AllBookingsPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    }>
      <AllBookingsContent />
    </Suspense>
  );
}
