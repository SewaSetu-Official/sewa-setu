import { NextResponse } from "next/server";
import { BookingStatus, Prisma } from "@prisma/client";
import { requirePlatformStaff } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const BOOKING_STATUSES: BookingStatus[] = ["DRAFT", "REQUESTED", "CONFIRMED", "CANCELLED", "COMPLETED"];
const REVENUE_STATUSES: BookingStatus[] = ["CONFIRMED", "COMPLETED"];

function parseCreatedAtRange(from: string, to: string): Prisma.DateTimeFilter | null {
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to + "T23:59:59.999Z") : null;

  if ((fromDate && Number.isNaN(fromDate.getTime())) || (toDate && Number.isNaN(toDate.getTime()))) {
    return null;
  }

  return {
    ...(fromDate ? { gte: fromDate } : {}),
    ...(toDate ? { lte: toDate } : {}),
  };
}

function isDatabaseUnavailable(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P1001"
  );
}

function emptyRevenuePayload(scope: "platform" | "assigned") {
  const now = new Date();
  const monthly: { label: string; revenue: number; bookings: number }[] = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthly.push({
      label: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
      revenue: 0,
      bookings: 0,
    });
  }

  return {
    warning: "database_unavailable",
    kpis: {
      allTimeRevenue: 0,
      thisMonthRevenue: 0,
      totalRefunds: 0,
      refundedCount: 0,
      totalBookings: 0,
      cancelledBookings: 0,
      cancellationRate: 0,
    },
    monthly,
    hospitals: [],
    filterHospitals: [],
    scope,
  };
}

export async function GET(req: Request) {
  let ctx;
  try { ctx = await requirePlatformStaff({ apiMode: true }); }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ error: msg }, { status: msg === "FORBIDDEN" ? 403 : 401 });
  }

  const { searchParams } = new URL(req.url);
  const hospitalId = searchParams.get("hospitalId") ?? "";
  const status = searchParams.get("status") ?? "all";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const createdAtRange = parseCreatedAtRange(from, to);

  if (createdAtRange === null) {
    return NextResponse.json({ error: "Invalid date filter" }, { status: 400 });
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const assignedHospitalIds = ctx.assignedHospitalIds;
  const supportHospitalFilter = hospitalId
    ? (assignedHospitalIds.includes(hospitalId) ? hospitalId : { in: [] as string[] })
    : { in: assignedHospitalIds };

  const bookingScope: Prisma.BookingWhereInput = ctx.isAdmin
    ? (hospitalId ? { hospitalId } : {})
    : { hospitalId: supportHospitalFilter };

  const revenueWhere: Prisma.BookingWhereInput = {
    ...bookingScope,
    amountPaid: { not: null },
    ...(Object.keys(createdAtRange).length ? { createdAt: createdAtRange } : {}),
  };

  if (status === "all") {
    revenueWhere.status = { in: REVENUE_STATUSES };
  } else if (status === "refunded") {
    revenueWhere.status = { in: REVENUE_STATUSES };
    revenueWhere.stripeRefundId = { not: null };
  } else {
    const normalizedStatus = status.toUpperCase() as BookingStatus;
    if (!BOOKING_STATUSES.includes(normalizedStatus)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }
    revenueWhere.status = normalizedStatus;
  }

  try {
  const [allTimeRevenue, thisMonthRevenue, allTimeRefunds, totalBookings, cancelledBookings, filterHospitals] =
    await Promise.all([
      db.booking.aggregate({
        where: revenueWhere,
        _sum: { amountPaid: true },
        _count: true,
      }),
      db.booking.aggregate({
        where: {
          ...revenueWhere,
          createdAt: {
            ...createdAtRange,
            gte: monthStart,
          },
        },
        _sum: { amountPaid: true },
        _count: true,
      }),
      db.booking.aggregate({
        where: { ...revenueWhere, stripeRefundId: { not: null } },
        _sum: { amountPaid: true },
        _count: true,
      }),
      db.booking.count({ where: revenueWhere }),
      db.booking.count({ where: { ...bookingScope, status: "CANCELLED" } }),
      db.hospital.findMany({
        where: {
          isActive: true,
          ...(ctx.isAdmin ? {} : { id: { in: assignedHospitalIds } }),
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

  const months: { label: string; revenue: number; bookings: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);

    const agg = await db.booking.aggregate({
      where: {
        ...revenueWhere,
        createdAt: { gte: start, lt: end },
      },
      _sum: { amountPaid: true },
      _count: true,
    });

    months.push({
      label: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
      revenue: agg._sum.amountPaid ?? 0,
      bookings: agg._count,
    });
  }

  const hospitalGroups = await db.booking.groupBy({
    by: ["hospitalId"],
    where: revenueWhere,
    _sum: { amountPaid: true },
    _count: { id: true },
    orderBy: { _sum: { amountPaid: "desc" } },
    take: 20,
  });

  const hospitalIds = hospitalGroups.map((g) => g.hospitalId);

  const [hospitalNames, hospitalRefunds, hospitalCancellations] = await Promise.all([
    db.hospital.findMany({
      where: { id: { in: hospitalIds } },
      select: { id: true, name: true, slug: true },
    }),
    db.booking.groupBy({
      by: ["hospitalId"],
      where: { ...bookingScope, hospitalId: { in: hospitalIds }, stripeRefundId: { not: null } },
      _sum: { amountPaid: true },
      _count: { id: true },
    }),
    db.booking.groupBy({
      by: ["hospitalId"],
      where: { ...bookingScope, hospitalId: { in: hospitalIds }, status: "CANCELLED" },
      _count: { id: true },
    }),
  ]);

  const nameMap = Object.fromEntries(hospitalNames.map((h) => [h.id, { name: h.name, slug: h.slug }]));
  const refundMap = Object.fromEntries(hospitalRefunds.map((r) => [r.hospitalId, { amount: r._sum.amountPaid ?? 0, count: r._count.id }]));
  const cancelMap = Object.fromEntries(hospitalCancellations.map((c) => [c.hospitalId, c._count.id]));

  const hospitals = hospitalGroups.map((g) => ({
    id: g.hospitalId,
    name: nameMap[g.hospitalId]?.name ?? "Unknown",
    slug: nameMap[g.hospitalId]?.slug ?? "",
    revenue: g._sum.amountPaid ?? 0,
    bookings: g._count.id,
    refundedAmount: refundMap[g.hospitalId]?.amount ?? 0,
    refundedCount: refundMap[g.hospitalId]?.count ?? 0,
    cancelledCount: cancelMap[g.hospitalId] ?? 0,
  }));

  return NextResponse.json({
    kpis: {
      allTimeRevenue: allTimeRevenue._sum.amountPaid ?? 0,
      thisMonthRevenue: thisMonthRevenue._sum.amountPaid ?? 0,
      totalRefunds: allTimeRefunds._sum.amountPaid ?? 0,
      refundedCount: allTimeRefunds._count,
      totalBookings,
      cancelledBookings,
      cancellationRate: totalBookings > 0 ? Math.round((cancelledBookings / totalBookings) * 100) : 0,
    },
    monthly: months,
    hospitals,
    filterHospitals,
    scope: ctx.isAdmin ? "platform" : "assigned",
  });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      console.warn("Platform revenue unavailable: database connection failed", error);
      return NextResponse.json(emptyRevenuePayload(ctx.isAdmin ? "platform" : "assigned"));
    }
    throw error;
  }
}
