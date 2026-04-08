import { NextResponse } from "next/server";
import { requireHospitalAccess } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let ctx;
  try { ctx = await requireHospitalAccess(slug, undefined, { apiMode: true }); }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ error: msg }, { status: msg === "FORBIDDEN" ? 403 : 401 });
  }

  const hospitalId = ctx.membership.hospitalId;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    todayTotal,
    todayPending,
    todayCompleted,
    todayCancelled,
    todayRevenue,
    monthRevenue,
    totalBookings,
    pendingConfirmations,
    todayAppointments,
  ] = await Promise.all([
    // Today's totals
    db.booking.count({ where: { hospitalId, scheduledAt: { gte: todayStart, lte: todayEnd } } }),
    db.booking.count({ where: { hospitalId, scheduledAt: { gte: todayStart, lte: todayEnd }, status: "REQUESTED" } }),
    db.booking.count({ where: { hospitalId, scheduledAt: { gte: todayStart, lte: todayEnd }, status: "COMPLETED" } }),
    db.booking.count({ where: { hospitalId, scheduledAt: { gte: todayStart, lte: todayEnd }, status: "CANCELLED" } }),

    // Today's revenue (confirmed + completed)
    db.booking.aggregate({
      where: { hospitalId, scheduledAt: { gte: todayStart, lte: todayEnd }, status: { in: ["CONFIRMED", "COMPLETED"] } },
      _sum: { amountPaid: true },
    }),

    // This month's revenue
    db.booking.aggregate({
      where: { hospitalId, createdAt: { gte: monthStart }, status: { in: ["CONFIRMED", "COMPLETED"] } },
      _sum: { amountPaid: true },
    }),

    // All-time booking count
    db.booking.count({ where: { hospitalId } }),

    // Global pending confirmations
    db.booking.count({ where: { hospitalId, status: "REQUESTED" } }),

    // Today's appointment queue — sorted by slot time
    db.booking.findMany({
      where: { hospitalId, scheduledAt: { gte: todayStart, lte: todayEnd } },
      include: {
        patient: { select: { fullName: true, phone: true, gender: true, disability: true } },
        doctor:  { select: { fullName: true } },
        package: { select: { title: true } },
      },
      orderBy: [{ slotTime: "asc" }, { scheduledAt: "asc" }],
      take: 50,
    }),
  ]);

  return NextResponse.json({
    today: {
      total: todayTotal,
      pending: todayPending,
      completed: todayCompleted,
      cancelled: todayCancelled,
      revenue: todayRevenue._sum.amountPaid ?? 0,
    },
    month: {
      revenue: monthRevenue._sum.amountPaid ?? 0,
    },
    totalBookings,
    pendingConfirmations,
    todayAppointments: todayAppointments.map((b) => ({
      id: b.id,
      status: b.status,
      scheduledAt: b.scheduledAt.toISOString(),
      slotTime: b.slotTime ?? null,
      mode: b.mode,
      amountPaid: b.amountPaid ?? null,
      currency: b.currency ?? "eur",
      notes: b.notes ?? null,
      cancellationReason: b.cancellationReason ?? null,
      patient: b.patient ? {
        fullName: b.patient.fullName,
        phone: b.patient.phone ?? null,
        gender: b.patient.gender ?? null,
        disability: b.patient.disability ?? null,
      } : null,
      doctor:  b.doctor  ? { fullName: b.doctor.fullName }  : null,
      package: b.package ? { title: b.package.title }       : null,
    })),
  });
}
