import { NextResponse } from "next/server";
import { requireHospitalAccess } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const RANGE_OPTIONS: Record<string, { days: number; label: string }> = {
  today: { days: 1, label: "Today" },
  week: { days: 7, label: "7 days" },
  "15d": { days: 15, label: "15 days" },
  month: { days: 30, label: "30 days" },
  "3m": { days: 90, label: "3 months" },
  year: { days: 365, label: "1 year" },
};

function resolveRange(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("range") ?? "month";
  const option = RANGE_OPTIONS[key] ?? RANGE_OPTIONS.month;
  const start = new Date();
  start.setDate(start.getDate() - (option.days - 1));
  start.setHours(0, 0, 0, 0);

  return { key: RANGE_OPTIONS[key] ? key : "month", ...option, start, end: new Date() };
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let ctx;
  try { ctx = await requireHospitalAccess(slug, "VIEW_OWNER_BUSINESS", { apiMode: true }); }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ error: msg }, { status: msg === "FORBIDDEN" ? 403 : 401 });
  }

  const hospitalId = ctx.membership.hospitalId;
  const selectedRange = resolveRange(req);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    hospital,
    grossRevenue,
    refundedRevenue,
    paidBookings,
    monthRevenue,
    monthBookings,
    refundedBookings,
    pendingRequests,
    unconfirmedBookings,
    activeDoctors,
    activePackages,
    activeWindows,
    rangeBookings,
    recentAudit,
  ] = await Promise.all([
    db.hospital.findUnique({
      where: { id: hospitalId },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        verified: true,
        isActive: true,
        suspendedAt: true,
        suspensionReason: true,
        phone: true,
        email: true,
        website: true,
        emergencyAvailable: true,
        location: {
          select: {
            country: true,
            province: true,
            district: true,
            city: true,
            area: true,
            addressLine: true,
          },
        },
      },
    }),
    db.booking.aggregate({
      where: { hospitalId, status: { in: ["CONFIRMED", "COMPLETED"] } },
      _sum: { amountPaid: true },
    }),
    db.booking.aggregate({
      where: { hospitalId, stripeRefundId: { not: null } },
      _sum: { amountPaid: true },
    }),
    db.booking.count({ where: { hospitalId, status: { in: ["CONFIRMED", "COMPLETED"] } } }),
    db.booking.aggregate({
      where: { hospitalId, createdAt: { gte: monthStart }, status: { in: ["CONFIRMED", "COMPLETED"] } },
      _sum: { amountPaid: true },
    }),
    db.booking.count({ where: { hospitalId, createdAt: { gte: monthStart } } }),
    db.booking.count({ where: { hospitalId, stripeRefundId: { not: null } } }),
    db.hospitalMembership.count({ where: { hospitalId, status: "PENDING" } }),
    db.booking.count({ where: { hospitalId, status: "REQUESTED" } }),
    db.doctorHospital.count({ where: { hospitalId } }),
    db.hospitalPackage.count({ where: { hospitalId, isActive: true } }),
    db.availabilitySlot.count({ where: { hospitalId, isActive: true } }),
    db.booking.findMany({
      where: { hospitalId, createdAt: { gte: selectedRange.start } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        status: true,
        amountPaid: true,
        stripeRefundId: true,
        createdAt: true,
      },
    }),
    db.auditLog.findMany({
      where: { hospitalId },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  if (!hospital) {
    return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
  }

  const totalRevenue = grossRevenue._sum.amountPaid ?? 0;
  const totalRefunds = refundedRevenue._sum.amountPaid ?? 0;
  const netRevenue = Math.max(0, totalRevenue - totalRefunds);
  const reportRevenue = rangeBookings
    .filter((booking) => ["CONFIRMED", "COMPLETED"].includes(booking.status))
    .reduce((sum, booking) => sum + (booking.amountPaid ?? 0), 0);
  const reportRefunds = rangeBookings
    .filter((booking) => booking.stripeRefundId)
    .reduce((sum, booking) => sum + (booking.amountPaid ?? 0), 0);
  const statusCounts = rangeBookings.reduce<Record<string, number>>((acc, booking) => {
    acc[booking.status] = (acc[booking.status] ?? 0) + 1;
    return acc;
  }, {});
  const dailyMap = new Map<string, { date: string; bookings: number; revenue: number; refunds: number }>();

  for (let cursor = new Date(selectedRange.start); cursor <= selectedRange.end; cursor.setDate(cursor.getDate() + 1)) {
    const key = dateKey(cursor);
    dailyMap.set(key, { date: key, bookings: 0, revenue: 0, refunds: 0 });
  }

  for (const booking of rangeBookings) {
    const day = dailyMap.get(dateKey(booking.createdAt));
    if (!day) continue;
    day.bookings += 1;
    if (["CONFIRMED", "COMPLETED"].includes(booking.status)) {
      day.revenue += booking.amountPaid ?? 0;
    }
    if (booking.stripeRefundId) {
      day.refunds += booking.amountPaid ?? 0;
    }
  }

  const riskSignals = [
    !hospital.verified ? "Hospital verification is still pending." : null,
    !hospital.isActive ? "Hospital profile is inactive." : null,
    pendingRequests > 0 ? `${pendingRequests} team access request${pendingRequests === 1 ? "" : "s"} pending.` : null,
    unconfirmedBookings > 0 ? `${unconfirmedBookings} booking request${unconfirmedBookings === 1 ? "" : "s"} need confirmation.` : null,
    activeWindows === 0 ? "No active doctor availability windows are configured." : null,
  ].filter(Boolean) as string[];

  return NextResponse.json({
    hospital,
    billing: {
      provider: "Stripe",
      status: process.env.STRIPE_SECRET_KEY ? "connected" : "not_configured",
      totalRevenue,
      totalRefunds,
      netRevenue,
      paidBookings,
      monthRevenue: monthRevenue._sum.amountPaid ?? 0,
      monthBookings,
      refundedBookings,
    },
    range: {
      key: selectedRange.key,
      label: selectedRange.label,
      days: selectedRange.days,
      start: selectedRange.start.toISOString(),
      end: selectedRange.end.toISOString(),
    },
    report: {
      bookings: rangeBookings.length,
      paidBookings: rangeBookings.filter((booking) => ["CONFIRMED", "COMPLETED"].includes(booking.status)).length,
      cancelledBookings: rangeBookings.filter((booking) => booking.status === "CANCELLED").length,
      refundedBookings: rangeBookings.filter((booking) => booking.stripeRefundId).length,
      revenue: reportRevenue,
      refunds: reportRefunds,
      netRevenue: Math.max(0, reportRevenue - reportRefunds),
      cancellationRate: rangeBookings.length
        ? Math.round((rangeBookings.filter((booking) => booking.status === "CANCELLED").length / rangeBookings.length) * 100)
        : 0,
      refundRate: rangeBookings.length
        ? Math.round((rangeBookings.filter((booking) => booking.stripeRefundId).length / rangeBookings.length) * 100)
        : 0,
      statusBreakdown: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
      daily: Array.from(dailyMap.values()).slice(-15),
    },
    operations: {
      pendingRequests,
      unconfirmedBookings,
      activeDoctors,
      activePackages,
      activeWindows,
    },
    riskSignals,
    recentAudit: recentAudit.map((log) => ({
      id: log.id,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      createdAt: log.createdAt.toISOString(),
    })),
  });
}
