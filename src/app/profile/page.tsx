import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LogOut, ArrowLeft, Shield, Settings, CheckCircle2, CalendarDays, Phone } from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";
import { ProfileAvatar } from "@/components/profile-avatar";
import { BookingList, type SerializedBooking } from "@/components/booking-detail-modal";
import { db } from "@/lib/db";

export const revalidate = 0;

export default async function ProfilePage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Fetch real DB data
  const dbUser = await db.user.findUnique({ where: { clerkId: user.id } });

  const [bookingCount, rawBookings] = dbUser
    ? await Promise.all([
        db.booking.count({ where: { userId: dbUser.id } }),
        db.booking.findMany({
          where: { userId: dbUser.id },
          include: {
            hospital: {
              select: {
                name: true, slug: true, phone: true,
                location: { select: { city: true, district: true, area: true, addressLine: true } },
              },
            },
            doctor: { select: { fullName: true } },
            package: { select: { title: true, price: true, currency: true } },
            patient: { select: { fullName: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
      ])
    : [0, []];

  // Serialize for client component (Dates → strings)
  const serializedBookings: SerializedBooking[] = rawBookings.map((b) => ({
    id: b.id,
    status: b.status,
    scheduledAt: b.scheduledAt.toISOString(),
    slotTime: b.slotTime ?? null,
    amountPaid: b.amountPaid ?? null,
    currency: b.currency ?? null,
    mode: b.mode,
    hospital: b.hospital
      ? { name: b.hospital.name, slug: b.hospital.slug, phone: b.hospital.phone ?? null, location: b.hospital.location ?? null }
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
    <div className="min-h-screen bg-cream-warm">

      {/* ── HERO BANNER ── */}
      <div style={{ background: "linear-gradient(135deg,#0f1e38 0%,#1a3059 60%,#0f1e38 100%)" }} className="pt-20 pb-0">
        <div className="max-w-5xl mx-auto px-4 pt-2 pb-0">

          {/* Back link */}
          <Link href="/" className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-sm font-medium transition-colors mb-8 bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-full border border-white/15">
            <ArrowLeft size={14} />
            Back to home
          </Link>

          {/* Avatar + name + meta */}
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 pb-8">
            <ProfileAvatar user={userDataForClient} />
          </div>
        </div>

        {/* Stats strip — sits on the banner bottom edge */}
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 translate-y-6">
            <div className="bg-white rounded-2xl p-5 shadow-lg border border-gold/15 text-center">
              <p className="text-3xl font-extrabold text-navy">{bookingCount}</p>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-1">Total Bookings</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-lg border border-gold/15 text-center">
              <p className="text-3xl font-extrabold text-navy">
                {serializedBookings.filter(b => b.status === "CONFIRMED" || b.status === "REQUESTED").length}
              </p>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-1">Upcoming</p>
            </div>
            <div className="hidden sm:block bg-white rounded-2xl p-5 shadow-lg border border-gold/15 text-center">
              <p className="text-lg font-extrabold text-navy leading-tight">{memberSince}</p>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-1">Member Since</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-5xl mx-auto px-6 pt-14 pb-16 space-y-8">

        {/* ── RECENT BOOKINGS ── */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-navy flex items-center gap-2">
              <CalendarDays size={20} className="text-gold" />
              Recent Bookings
            </h2>
            <Link href="/search" className="text-xs font-semibold text-gold-dim hover:text-navy transition-colors">
              Book again →
            </Link>
          </div>

          <BookingList bookings={serializedBookings} />
        </div>

        {/* ── ACCOUNT INFO ── */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-navy flex items-center gap-2">
              <Shield size={20} className="text-gold" />
              Account Information
            </h2>
            <Link href="/profile/manage">
              <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-dim hover:text-navy transition-colors">
                <Settings size={14} /> Manage
              </button>
            </Link>
          </div>
          <div className="px-6 py-5 grid sm:grid-cols-2 gap-5">
            {/* Email */}
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-gold/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle2 size={16} className="text-gold" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-0.5">Email</p>
                <p className="text-sm font-semibold text-navy break-all">
                  {userDataForClient.primaryEmailAddress?.emailAddress ?? "—"}
                </p>
                {userDataForClient.primaryEmailAddressVerificationStatus === "verified" && (
                  <span className="text-xs text-emerald-600 font-medium">✓ Verified</span>
                )}
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-gold/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Phone size={16} className="text-gold" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-0.5">Phone</p>
                <p className="text-sm font-semibold text-navy">
                  {userDataForClient.phoneNumbers[0]?.phoneNumber ?? "Not added"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── SIGN OUT ── */}
        <div className="border-t pt-8 flex justify-center">
          <SignOutButton redirectUrl="/">
            <button className="flex items-center justify-center gap-2 bg-red-600 text-white font-medium py-3 px-10 rounded-lg hover:bg-red-700 transition">
              <LogOut size={18} />
              Sign Out
            </button>
          </SignOutButton>
        </div>

      </div>
    </div>
  );
}
