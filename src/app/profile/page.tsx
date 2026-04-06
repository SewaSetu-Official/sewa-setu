import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  LogOut, Shield, Settings, CheckCircle2, CalendarDays,
  Phone, Search, ArrowRight, ArrowLeft, Clock, Star,
} from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";
import { ProfileAvatar } from "@/components/profile-avatar";
import { BookingList, type SerializedBooking } from "@/components/booking-detail-modal";
import { db } from "@/lib/db";

export const revalidate = 0;

function getAppointmentDateTime(scheduledAt: Date, slotTime: string | null): Date {
  if (!slotTime) return scheduledAt;
  const start = slotTime.split("-")[0].trim();
  const [h, m = 0] = start.split(":").map(Number);
  const dt = new Date(scheduledAt);
  dt.setHours(h, m, 0, 0);
  return dt;
}

export default async function ProfilePage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const dbUser = await db.user.findUnique({ where: { clerkId: user.id } });

  const [bookingCount, upcomingSource, reviewCount, rawBookings] = dbUser
    ? await Promise.all([
        db.booking.count({ where: { userId: dbUser.id } }),
        db.booking.findMany({
          where: { userId: dbUser.id },
          select: { scheduledAt: true, slotTime: true },
        }),
        db.review.count({ where: { userId: dbUser.id } }),
        db.booking.findMany({
          where: { userId: dbUser.id },
          include: {
            hospital: {
              select: {
                name: true, slug: true, phone: true, email: true,
                location: { select: { city: true, district: true, area: true, addressLine: true } },
              },
            },
            doctor: { select: { fullName: true } },
            package: { select: { title: true, price: true, currency: true } },
            patient: { select: { fullName: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
      ])
    : [0, [], 0, []];

  const upcomingCount = (upcomingSource as { scheduledAt: Date; slotTime: string | null }[]).filter(
    (b) => getAppointmentDateTime(b.scheduledAt, b.slotTime).getTime() >= Date.now()
  ).length;

  const serializedBookings: SerializedBooking[] = (rawBookings as any[]).map((b) => ({
    id: b.id,
    status: b.status,
    scheduledAt: b.scheduledAt.toISOString(),
    createdAt: b.createdAt.toISOString(),
    confirmedAt: b.confirmedAt?.toISOString() ?? null,
    rescheduleCount: b.rescheduleCount,
    slotTime: b.slotTime ?? null,
    amountPaid: b.amountPaid ?? null,
    currency: b.currency ?? null,
    mode: b.mode,
    hospitalId: b.hospitalId ?? null,
    doctorId: b.doctorId ?? null,
    hospital: b.hospital
      ? { name: b.hospital.name, slug: b.hospital.slug, phone: b.hospital.phone ?? null, email: b.hospital.email ?? null, location: b.hospital.location ?? null }
      : null,
    doctor: b.doctor ? { fullName: b.doctor.fullName } : null,
    package: b.package ? { title: b.package.title, price: b.package.price ?? null, currency: b.package.currency ?? null } : null,
    patient: b.patient ? { fullName: b.patient.fullName } : null,
  }));

  const userDataForClient = {
    id: user.id,
    fullName: user.fullName,
    imageUrl: user.imageUrl,
    primaryEmailAddress: user.primaryEmailAddress
      ? { emailAddress: user.primaryEmailAddress.emailAddress }
      : null,
    primaryEmailAddressVerificationStatus: user.primaryEmailAddress?.verification?.status,
    phoneNumbers: user.phoneNumbers?.map((p) => ({ phoneNumber: p.phoneNumber })) ?? [],
    createdAt: user.createdAt,
  };

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "—";

  return (
    <div className="min-h-screen" style={{ background: "#f0ece4" }}>

      {/* ── HERO ── */}
      <div style={{ background: "linear-gradient(160deg,#0a1628 0%,#0f1e38 55%,#1a2e50 100%)" }} className="pt-20 pb-24 relative">

        {/* Back button */}
        <Link
          href="/"
          className="absolute top-4 left-16 inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full transition-all group"
          style={{ color: "rgba(255,255,255,.5)", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}
          onMouseEnter={undefined}
        >
          <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="group-hover:text-white/80 transition-colors">Home</span>
        </Link>

        <div className="max-w-4xl mx-auto px-6">
          <ProfileAvatar user={userDataForClient} />
        </div>
      </div>

      {/* ── STATS ── */}
      <div className="max-w-4xl mx-auto px-6 -mt-14 relative z-10">
        <div className="grid grid-cols-3 gap-4">
          <Link href="/profile/bookings"
            className="bg-white rounded-2xl p-5 shadow-lg flex flex-col items-center gap-1 group transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
            style={{ border: "1px solid rgba(200,169,110,.15)" }}>
            <p className="text-3xl font-black transition-colors group-hover:text-[#c8a96e]" style={{ color: "#0f1e38" }}>{bookingCount}</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Bookings</p>
            <p className="text-[10px] font-semibold mt-0.5 flex items-center gap-1 transition-all group-hover:gap-2" style={{ color: "#c8a96e" }}>
              View all <ArrowRight size={9} />
            </p>
          </Link>
          <Link href="/profile/bookings?filter=upcoming"
            className="bg-white rounded-2xl p-5 shadow-lg flex flex-col items-center gap-1 group transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
            style={{ border: "1px solid rgba(200,169,110,.15)" }}>
            <p className="text-3xl font-black transition-colors group-hover:text-[#c8a96e]" style={{ color: "#0f1e38" }}>{upcomingCount}</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Upcoming</p>
            <p className="text-[10px] font-semibold mt-0.5 flex items-center gap-1 transition-all group-hover:gap-2" style={{ color: "#c8a96e" }}>
              See schedule <ArrowRight size={9} />
            </p>
          </Link>
          <div className="bg-white rounded-2xl p-5 shadow-lg flex flex-col items-center gap-1"
            style={{ border: "1px solid rgba(200,169,110,.15)" }}>
            <p className="text-3xl font-black" style={{ color: "#0f1e38" }}>{reviewCount}</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Reviews</p>
            <p className="text-[10px] font-semibold mt-0.5" style={{ color: "#c8a96e" }}>Since {memberSince.split(" ")[1]}</p>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-4xl mx-auto px-6 pt-6 pb-16 space-y-5">

        {/* ── QUICK ACTIONS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Primary dark card */}
          <Link href="/search" className="group flex items-center gap-3 px-5 py-4 rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl"
            style={{ background: "linear-gradient(135deg,#0f1e38,#1a3059)", boxShadow: "0 4px 20px rgba(15,30,56,.25)" }}>
            <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-[rgba(200,169,110,.25)]"
              style={{ background: "rgba(200,169,110,.15)" }}>
              <Search size={16} style={{ color: "#c8a96e" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">Book Appointment</p>
              <p className="text-white/40 text-[11px] group-hover:text-white/60 transition-colors">Find doctors & hospitals</p>
            </div>
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" style={{ color: "#c8a96e" }} />
          </Link>

          {/* Light cards */}
          <Link href="/profile/bookings" className="group flex items-center gap-3 px-5 py-4 rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-[rgba(200,169,110,.4)]"
            style={{ background: "#fff", border: "1.5px solid rgba(200,169,110,.2)", boxShadow: "0 2px 12px rgba(15,30,56,.07)" }}>
            <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-[rgba(200,169,110,.18)]"
              style={{ background: "rgba(200,169,110,.1)" }}>
              <CalendarDays size={16} style={{ color: "#c8a96e" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm group-hover:text-[#c8a96e] transition-colors" style={{ color: "#0f1e38" }}>My Bookings</p>
              <p className="text-[11px] text-gray-400">History & receipts</p>
            </div>
            <ArrowRight size={14} className="text-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-[#c8a96e]" />
          </Link>

          <Link href="/profile/manage" className="group flex items-center gap-3 px-5 py-4 rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-[rgba(200,169,110,.4)]"
            style={{ background: "#fff", border: "1.5px solid rgba(200,169,110,.2)", boxShadow: "0 2px 12px rgba(15,30,56,.07)" }}>
            <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-[rgba(200,169,110,.18)]"
              style={{ background: "rgba(200,169,110,.1)" }}>
              <Settings size={16} className="transition-transform group-hover:rotate-45" style={{ color: "#c8a96e" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm group-hover:text-[#c8a96e] transition-colors" style={{ color: "#0f1e38" }}>Account Settings</p>
              <p className="text-[11px] text-gray-400">Manage your profile</p>
            </div>
            <ArrowRight size={14} className="text-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-[#c8a96e]" />
          </Link>
        </div>

        {/* ── RECENT BOOKINGS ── */}
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden" style={{ border: "1px solid rgba(200,169,110,.12)" }}>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #f5f0e8" }}>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(200,169,110,.1)" }}>
                <Clock size={15} style={{ color: "#c8a96e" }} />
              </div>
              <h2 className="text-base font-bold" style={{ color: "#0f1e38" }}>Recent Bookings</h2>
            </div>
            <Link href="/profile/bookings"
              className="group text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:bg-[rgba(200,169,110,.15)] flex items-center gap-1"
              style={{ color: "#c8a96e", background: "rgba(200,169,110,.08)" }}>
              View all <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <BookingList bookings={serializedBookings} />
          {bookingCount === 0 && (
            <div className="py-12 flex flex-col items-center gap-3 text-center px-6">
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(200,169,110,.08)" }}>
                <CalendarDays size={22} style={{ color: "#c8a96e" }} />
              </div>
              <p className="font-bold" style={{ color: "#0f1e38" }}>No bookings yet</p>
              <p className="text-sm text-gray-400">Your appointment history will appear here.</p>
              <Link href="/search">
                <button className="mt-1 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 hover:-translate-y-0.5"
                  style={{ background: "#0f1e38", color: "#c8a96e" }}>
                  Find Hospitals
                </button>
              </Link>
            </div>
          )}
        </div>

        {/* ── ACCOUNT INFO ── */}
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden" style={{ border: "1px solid rgba(200,169,110,.12)" }}>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #f5f0e8" }}>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(200,169,110,.1)" }}>
                <Shield size={15} style={{ color: "#c8a96e" }} />
              </div>
              <h2 className="text-base font-bold" style={{ color: "#0f1e38" }}>Account Information</h2>
            </div>
            <Link href="/profile/manage"
              className="group text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:bg-[rgba(200,169,110,.15)] flex items-center gap-1"
              style={{ color: "#c8a96e", background: "rgba(200,169,110,.08)" }}>
              Manage <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="divide-y divide-[#f5f0e8]">
            <div className="px-6 py-4 flex items-center gap-4 transition-colors hover:bg-[#fdf9f5]">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(200,169,110,.08)", border: "1px solid rgba(200,169,110,.15)" }}>
                <CheckCircle2 size={16} style={{ color: "#c8a96e" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Email Address</p>
                <p className="text-sm font-semibold truncate" style={{ color: "#0f1e38" }}>
                  {userDataForClient.primaryEmailAddress?.emailAddress ?? "—"}
                </p>
              </div>
              {userDataForClient.primaryEmailAddressVerificationStatus === "verified" && (
                <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{ background: "rgba(34,197,94,.08)", color: "#16a34a", border: "1px solid rgba(34,197,94,.2)" }}>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Verified
                </span>
              )}
            </div>

            <div className="px-6 py-4 flex items-center gap-4 transition-colors hover:bg-[#fdf9f5]">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(200,169,110,.08)", border: "1px solid rgba(200,169,110,.15)" }}>
                <Phone size={16} style={{ color: "#c8a96e" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Phone Number</p>
                <p className="text-sm font-semibold" style={{ color: "#0f1e38" }}>
                  {userDataForClient.phoneNumbers[0]?.phoneNumber ?? "Not added"}
                </p>
              </div>
              {!userDataForClient.phoneNumbers[0] && (
                <Link href="/profile/manage"
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 transition-all hover:bg-[rgba(200,169,110,.2)]"
                  style={{ background: "rgba(200,169,110,.1)", color: "#a88b50" }}>
                  + Add
                </Link>
              )}
            </div>

            <div className="px-6 py-4 flex items-center gap-4 transition-colors hover:bg-[#fdf9f5]">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(200,169,110,.08)", border: "1px solid rgba(200,169,110,.15)" }}>
                <Star size={16} style={{ color: "#c8a96e" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Member Since</p>
                <p className="text-sm font-semibold" style={{ color: "#0f1e38" }}>{memberSince}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── SIGN OUT ── */}
        <div className="pt-2 flex justify-center">
          <SignOutButton redirectUrl="/">
            <button
              className="group flex items-center justify-center gap-2 px-10 py-3 rounded-2xl font-semibold text-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              style={{ background: "#fff", color: "#e53e3e", border: "1.5px solid rgba(229,62,62,.25)", boxShadow: "0 2px 10px rgba(229,62,62,.08)" }}>
              <LogOut size={15} className="transition-transform group-hover:-translate-x-0.5" />
              Sign Out
            </button>
          </SignOutButton>
        </div>

      </div>
    </div>
  );
}
