import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try { await requirePlatformAdmin({ apiMode: true }); }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalHospitals,
    activeHospitals,
    pendingVerification,
    totalUsers,
    totalBookings,
    monthBookings,
    pendingMemberships,
    revenueAll,
    revenueMonth,
    recentBookings,
  ] = await Promise.all([
    db.hospital.count(),
    db.hospital.count({ where: { isActive: true } }),
    db.hospital.count({ where: { verified: false, isActive: true } }),
    db.user.count(),
    db.booking.count(),
    db.booking.count({ where: { createdAt: { gte: monthStart } } }),
    db.hospitalMembership.count({ where: { status: "PENDING" } }),
    db.booking.aggregate({ where: { status: { in: ["CONFIRMED", "COMPLETED"] } }, _sum: { amountPaid: true } }),
    db.booking.aggregate({ where: { status: { in: ["CONFIRMED", "COMPLETED"] }, createdAt: { gte: monthStart } }, _sum: { amountPaid: true } }),
    db.booking.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        hospital: { select: { name: true } },
        patient:  { select: { fullName: true } },
      },
    }),
  ]);

  return NextResponse.json({
    hospitals: { total: totalHospitals, active: activeHospitals, pendingVerification },
    users: { total: totalUsers },
    bookings: { total: totalBookings, thisMonth: monthBookings },
    memberships: { pending: pendingMemberships },
    revenue: {
      total: revenueAll._sum.amountPaid ?? 0,
      thisMonth: revenueMonth._sum.amountPaid ?? 0,
    },
    recentBookings: recentBookings.map((b) => ({
      id: b.id,
      status: b.status,
      scheduledAt: b.scheduledAt.toISOString(),
      createdAt: b.createdAt.toISOString(),
      hospital: b.hospital?.name ?? null,
      patient: b.patient?.fullName ?? null,
      amountPaid: b.amountPaid ?? null,
    })),
  });
}
