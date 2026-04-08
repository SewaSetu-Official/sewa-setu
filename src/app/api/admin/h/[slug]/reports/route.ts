import { NextResponse } from "next/server";
import { requireHospitalAccess } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let ctx;
  try { ctx = await requireHospitalAccess(slug, "VIEW_REPORTS", { apiMode: true }); }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ error: msg }, { status: msg === "FORBIDDEN" ? 403 : 401 });
  }

  const hospitalId = ctx.membership.hospitalId;
  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") ?? "30"; // days
  const days = Math.min(365, Math.max(7, parseInt(range, 10)));

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const [
    statusBreakdown,
    revenueData,
    topDoctors,
    topPackages,
    totalRevenue,
    totalBookings,
  ] = await Promise.all([
    // Booking count by status in range
    db.booking.groupBy({
      by: ["status"],
      where: { hospitalId, createdAt: { gte: since } },
      _count: { id: true },
    }),

    // Daily booking + revenue for chart (last N days)
    db.booking.findMany({
      where: { hospitalId, createdAt: { gte: since }, status: { in: ["CONFIRMED", "COMPLETED", "CANCELLED", "REQUESTED"] } },
      select: { createdAt: true, status: true, amountPaid: true },
      orderBy: { createdAt: "asc" },
    }),

    // Top 5 doctors by completed bookings in range
    db.booking.groupBy({
      by: ["doctorId"],
      where: { hospitalId, createdAt: { gte: since }, status: "COMPLETED", doctorId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),

    // Top 5 packages in range
    db.booking.groupBy({
      by: ["packageId"],
      where: { hospitalId, createdAt: { gte: since }, packageId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),

    // All-time revenue
    db.booking.aggregate({
      where: { hospitalId, status: { in: ["CONFIRMED", "COMPLETED"] } },
      _sum: { amountPaid: true },
    }),

    // All-time bookings
    db.booking.count({ where: { hospitalId } }),
  ]);

  // Resolve doctor names
  const doctorIds = topDoctors.map((d) => d.doctorId).filter(Boolean) as string[];
  const packageIds = topPackages.map((p) => p.packageId).filter(Boolean) as string[];

  const [doctors, packages] = await Promise.all([
    doctorIds.length
      ? db.doctor.findMany({ where: { id: { in: doctorIds } }, select: { id: true, fullName: true } })
      : [],
    packageIds.length
      ? db.hospitalPackage.findMany({ where: { id: { in: packageIds } }, select: { id: true, title: true } })
      : [],
  ]);

  const doctorMap = Object.fromEntries(doctors.map((d) => [d.id, d.fullName]));
  const packageMap = Object.fromEntries(packages.map((p) => [p.id, p.title]));

  // Aggregate daily data
  const dailyMap: Record<string, { date: string; bookings: number; revenue: number }> = {};
  for (const b of revenueData) {
    const dateKey = b.createdAt.toISOString().slice(0, 10);
    if (!dailyMap[dateKey]) dailyMap[dateKey] = { date: dateKey, bookings: 0, revenue: 0 };
    dailyMap[dateKey].bookings++;
    if (b.status === "CONFIRMED" || b.status === "COMPLETED") {
      dailyMap[dateKey].revenue += b.amountPaid ?? 0;
    }
  }

  const rangeRevenue = revenueData
    .filter((b) => b.status === "CONFIRMED" || b.status === "COMPLETED")
    .reduce((sum, b) => sum + (b.amountPaid ?? 0), 0);

  return NextResponse.json({
    range: days,
    overview: {
      totalBookings,
      totalRevenue: totalRevenue._sum.amountPaid ?? 0,
      rangeBookings: revenueData.length,
      rangeRevenue,
    },
    statusBreakdown: statusBreakdown.map((s) => ({ status: s.status, count: s._count.id })),
    dailyChart: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)),
    topDoctors: topDoctors.map((d) => ({
      doctorId: d.doctorId,
      name: doctorMap[d.doctorId!] ?? "Unknown",
      completedBookings: d._count.id,
    })),
    topPackages: topPackages.map((p) => ({
      packageId: p.packageId,
      title: packageMap[p.packageId!] ?? "Unknown",
      bookings: p._count.id,
    })),
  });
}
