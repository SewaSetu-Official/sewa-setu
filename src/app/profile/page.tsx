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
      <ProfileClient user={profileUser} bookings={serializedBookings} />
    </main>
  );
}
