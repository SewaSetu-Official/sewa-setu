import { NextResponse } from "next/server";
import { requirePlatformStaff } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  let ctx;
  try { ctx = await requirePlatformStaff({ apiMode: true }); }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ error: msg }, { status: msg === "FORBIDDEN" ? 403 : 401 });
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const assignedHospitalIds = ctx.assignedHospitalIds;
  const bookingScope = ctx.isAdmin ? {} : { hospitalId: { in: assignedHospitalIds } };

  // ── KPI aggregates ──────────────────────────────────────────────────────────
  const [allTimeRevenue, thisMonthRevenue, allTimeRefunds, totalBookings, cancelledBookings] =
    await Promise.all([
      db.booking.aggregate({
        where: { ...bookingScope, status: { in: ["CONFIRMED", "COMPLETED"] } },
        _sum: { amountPaid: true },
        _count: true,
      }),
      db.booking.aggregate({
        where: { ...bookingScope, status: { in: ["CONFIRMED", "COMPLETED"] }, createdAt: { gte: monthStart } },
        _sum: { amountPaid: true },
        _count: true,
      }),
      db.booking.aggregate({
        where: { ...bookingScope, stripeRefundId: { not: null } },
        _sum: { amountPaid: true },
        _count: true,
      }),
      db.booking.count({ where: { ...bookingScope, status: { not: "DRAFT" } } }),
      db.booking.count({ where: { ...bookingScope, status: "CANCELLED" } }),
    ]);

  // ── Monthly chart — last 12 months ─────────────────────────────────────────
  const months: { label: string; revenue: number; bookings: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 1);

    const agg = await db.booking.aggregate({
      where: {
        ...bookingScope,
        status: { in: ["CONFIRMED", "COMPLETED"] },
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

  // ── Per-hospital breakdown ──────────────────────────────────────────────────
  const hospitalGroups = await db.booking.groupBy({
    by: ["hospitalId"],
    where: { ...bookingScope, status: { in: ["CONFIRMED", "COMPLETED"] } },
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
      where: { hospitalId: { in: hospitalIds }, stripeRefundId: { not: null } },
      _sum: { amountPaid: true },
      _count: { id: true },
    }),
    db.booking.groupBy({
      by: ["hospitalId"],
      where: { hospitalId: { in: hospitalIds }, status: "CANCELLED" },
      _count: { id: true },
    }),
  ]);

  const nameMap    = Object.fromEntries(hospitalNames.map((h) => [h.id, { name: h.name, slug: h.slug }]));
  const refundMap  = Object.fromEntries(hospitalRefunds.map((r) => [r.hospitalId, { amount: r._sum.amountPaid ?? 0, count: r._count.id }]));
  const cancelMap  = Object.fromEntries(hospitalCancellations.map((c) => [c.hospitalId, c._count.id]));

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
    scope: ctx.isAdmin ? "platform" : "assigned",
  });
}
