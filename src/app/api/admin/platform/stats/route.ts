import { NextResponse } from "next/server";
import { requirePlatformStaff } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { apiError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

export async function GET() {
  let ctx;
  try { ctx = await requirePlatformStaff({ apiMode: true }); }
  catch (e: unknown) { return apiError(e); }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const hospitalScope = ctx.isAdmin ? undefined : { in: ctx.assignedHospitalIds };
  const hospitalWhere = ctx.isAdmin ? {} : { id: hospitalScope };
  const bookingWhere = ctx.isAdmin ? {} : { hospitalId: hospitalScope };
  const activeHospitalWhere = ctx.isAdmin
    ? { isActive: true }
    : { id: hospitalScope, isActive: true };
  const pendingVerificationWhere = ctx.isAdmin
    ? { verified: false, isActive: true }
    : { id: hospitalScope, verified: false, isActive: true };

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
    db.hospital.count({ where: hospitalWhere }),
    db.hospital.count({ where: activeHospitalWhere }),
    db.hospital.count({ where: pendingVerificationWhere }),
    ctx.isAdmin ? db.user.count() : Promise.resolve(0),
    db.booking.count({ where: bookingWhere }),
    db.booking.count({ where: { ...bookingWhere, createdAt: { gte: monthStart } } }),
    db.hospitalMembership.count({ where: { ...bookingWhere, status: "PENDING" } }),
    db.booking.aggregate({ where: { ...bookingWhere, status: { in: ["CONFIRMED", "COMPLETED"] } }, _sum: { amountPaid: true } }),
    db.booking.aggregate({ where: { ...bookingWhere, status: { in: ["CONFIRMED", "COMPLETED"] }, createdAt: { gte: monthStart } }, _sum: { amountPaid: true } }),
    db.booking.findMany({
      where: bookingWhere,
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        hospital: { select: { name: true } },
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
      patient: null,
      amountPaid: ctx.isAdmin ? b.amountPaid ?? null : null,
    })),
    scope: ctx.isAdmin ? "platform" : "assigned",
  });
}
