import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { ProfileClient } from "./ProfileClient";
import { type SerializedBooking } from "@/components/booking-detail-modal";
import { db } from "@/lib/db";
import { ensureClerkUserInDb } from "@/lib/clerk-user-sync";

export const revalidate = 0;

export default async function ProfilePage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  await ensureClerkUserInDb(user.id);

  const dbUser = await db.user.findUnique({ where: { clerkId: user.id } });

  const rawBookings = dbUser
    ? await db.booking.findMany({
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
        take: 30,
      })
    : [];

  const serializedBookings: SerializedBooking[] = rawBookings.map((b) => ({
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
    cancellationReason: b.cancellationReason ?? null,
    refundedAt: b.refundedAt?.toISOString() ?? null,
  }));

  const rawFavorites = dbUser
    ? await db.favorite.findMany({
        where: { userId: dbUser.id },
        orderBy: { createdAt: "desc" },
        include: {
          doctor: {
            include: {
              media: { orderBy: { isPrimary: "desc" }, take: 1 },
              specialties: { include: { specialty: { select: { name: true } } } },
              hospitals: {
                include: { hospital: { select: { slug: true, name: true, location: { select: { city: true } } } } },
              },
            },
          },
          hospital: {
            include: {
              media: { where: { isPrimary: true }, take: 1 },
              location: { select: { city: true, district: true } },
              packages: { where: { isActive: true }, orderBy: { price: "asc" }, take: 1 },
            },
          },
        },
      })
    : [];

  const savedDoctors = rawFavorites
    .filter((f) => f.doctor)
    .map((f) => {
      const d = f.doctor!;
      const primarySpec = d.specialties.find((s) => s.isPrimary) ?? d.specialties[0];
      const primaryHosp = d.hospitals.find((h) => h.isPrimary) ?? d.hospitals[0];
      return {
        id: d.id,
        fullName: d.fullName,
        image: d.media[0]?.url ?? null,
        specialty: primarySpec?.specialty.name ?? "Doctor",
        hospitalName: primaryHosp?.hospital.name ?? null,
        hospitalSlug: primaryHosp?.hospital.slug ?? null,
        city: primaryHosp?.hospital.location.city ?? null,
        feeMin: d.feeMin ?? null,
        currency: d.currency ?? null,
      };
    });

  const savedHospitals = rawFavorites
    .filter((f) => f.hospital)
    .map((f) => {
      const h = f.hospital!;
      return {
        id: h.id,
        slug: h.slug,
        name: h.name,
        type: h.type,
        image: h.media[0]?.url ?? null,
        city: h.location.city,
        district: h.location.district,
        fromPrice: h.packages[0]?.price ?? null,
        currency: h.packages[0]?.currency ?? "EUR",
      };
    });

  const rawPatients = dbUser
    ? await db.patient.findMany({
        where: { userId: dbUser.id, archivedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true, fullName: true, gender: true, dateOfBirth: true, phone: true, notes: true,
          _count: { select: { bookings: true } },
        },
      })
    : [];

  const patientIds = rawPatients.map((p) => p.id);
  const activeAgg = patientIds.length
    ? await db.booking.groupBy({
        by: ["patientId"],
        where: { patientId: { in: patientIds }, status: { in: ["REQUESTED", "CONFIRMED"] } },
        _count: { _all: true },
      })
    : [];
  const activeMap = Object.fromEntries(activeAgg.map((a) => [a.patientId, a._count._all]));

  const familyMembers = rawPatients.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    gender: p.gender,
    dateOfBirth: p.dateOfBirth ? p.dateOfBirth.toISOString() : null,
    phone: p.phone,
    notes: p.notes,
    bookingCount: p._count.bookings,
    activeBookingCount: activeMap[p.id] ?? 0,
  }));

  const profileUser = {
    fullName: user.fullName,
    imageUrl: user.imageUrl,
    email: user.primaryEmailAddress?.emailAddress ?? null,
    emailVerified: user.primaryEmailAddress?.verification?.status === "verified",
    phone: user.phoneNumbers?.[0]?.phoneNumber ?? null,
    memberSince: user.createdAt
      ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : "—",
  };

  return (
    <main className="min-h-screen bg-page">
      <Navbar />
      <ProfileClient user={profileUser} bookings={serializedBookings} savedDoctors={savedDoctors} savedHospitals={savedHospitals} familyMembers={familyMembers} />
    </main>
  );
}
