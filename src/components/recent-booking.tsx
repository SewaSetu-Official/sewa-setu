"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Ticket, CheckCircle } from "lucide-react";
import type { SerializedBooking } from "@/components/booking-detail-modal";

export function RecentBooking() {
  const { isSignedIn } = useUser();
  const [booking, setBooking] = useState<SerializedBooking | null>(null);

  useEffect(() => {
    if (!isSignedIn) { setBooking(null); return; }

    fetch("/api/bookings?filter=upcoming&page=1&pageSize=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setBooking(data.bookings?.[0] ?? null))
      .catch(() => setBooking(null));
  }, [isSignedIn]);

  if (!booking) return null;

  const subtitle = booking.package?.title ?? booking.doctor?.fullName ?? "Appointment";

  return (
    <div className="w-full bg-gold/10 border-b border-gold/20 py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border border-gold/25 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full">
            <div className="h-10 w-10 rounded-full bg-gold/15 flex items-center justify-center shrink-0">
              <Ticket className="h-5 w-5 text-gold-dim" />
            </div>
            <div>
              <p className="text-xs font-bold text-gold-dim uppercase tracking-wide">Upcoming Appointment</p>
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                <h3 className="font-semibold text-navy">{booking.hospital?.name ?? "Hospital"}</h3>
                <span className="hidden sm:block text-gray-300">|</span>
                <span className="text-sm text-slate">{subtitle}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full whitespace-nowrap">
            <CheckCircle className="h-3 w-3" /> Confirmed
          </div>
        </div>
      </div>
    </div>
  );
}
