import { NextRequest, NextResponse } from "next/server";
import { requirePlatformStaff } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { BookingStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const BOOKING_STATUSES: BookingStatus[] = ["DRAFT", "REQUESTED", "CONFIRMED", "CANCELLED", "COMPLETED"];

// GET /api/admin/platform/bookings?page=&search=&status=&hospitalId=&from=&to=
export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requirePlatformStaff({ apiMode: true }); }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ error: msg }, { status: msg === "FORBIDDEN" ? 403 : 401 });
  }

  const { searchParams } = new URL(req.url);
  const page       = Math.max(1, Number(searchParams.get("page") ?? 1));
  const search     = searchParams.get("search")?.trim() ?? "";
  const status     = searchParams.get("status") ?? "all";
  const hospitalId = searchParams.get("hospitalId") ?? "";
  const from       = searchParams.get("from") ?? "";
  const to         = searchParams.get("to") ?? "";
  const PAGE_SIZE  = 20;

  const assignedHospitalIds = ctx.assignedHospitalIds;
  const supportHospitalFilter = hospitalId
    ? (assignedHospitalIds.includes(hospitalId) ? hospitalId : { in: [] as string[] })
    : { in: assignedHospitalIds };

  const where: Record<string, unknown> = {
    ...(ctx.isAdmin
      ? (hospitalId ? { hospitalId } : {})
      : { hospitalId: supportHospitalFilter }),
  };

  if (status !== "all") {
    const normalizedStatus = status.toUpperCase() as BookingStatus;
    if (!BOOKING_STATUSES.includes(normalizedStatus)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }
    where.status = normalizedStatus;
  }

  if (from || to) {
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to + "T23:59:59.999Z") : null;
    if ((fromDate && Number.isNaN(fromDate.getTime())) || (toDate && Number.isNaN(toDate.getTime()))) {
      return NextResponse.json({ error: "Invalid date filter" }, { status: 400 });
    }
    where.scheduledAt = {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate   ? { lte: toDate } : {}),
    };
  }

  if (search) {
    where.OR = [
      { id:       { contains: search, mode: "insensitive" } },
      { hospital: { name:     { contains: search, mode: "insensitive" } } },
      { doctor:   { fullName: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [total, bookings, hospitals] = await Promise.all([
    db.booking.count({ where }),
    db.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        status: true,
        mode: true,
        scheduledAt: true,
        slotTime: true,
        amountPaid: true,
        currency: true,
        createdAt: true,
        cancelledAt: true,
        cancellationReason: true,
        stripeRefundId: true,
        hospital: { select: { id: true, name: true, slug: true } },
        doctor:   { select: { fullName: true } },
        package:  { select: { title: true } },
      },
    }),
    // For the hospital filter dropdown
    db.hospital.findMany({
      where: {
        isActive: true,
        ...(ctx.isAdmin ? {} : { id: { in: assignedHospitalIds } }),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({
    bookings: bookings.map((b) => ({
      id: b.id,
      status: b.status,
      mode: b.mode,
      scheduledAt: b.scheduledAt.toISOString(),
      slotTime: b.slotTime ?? null,
      amountPaid: b.amountPaid ?? null,
      currency: b.currency ?? "eur",
      createdAt: b.createdAt.toISOString(),
      cancelledAt: b.cancelledAt?.toISOString() ?? null,
      cancellationReason: b.cancellationReason ?? null,
      refunded: !!b.stripeRefundId,
      hospital: b.hospital ? { id: b.hospital.id, name: b.hospital.name, slug: b.hospital.slug } : null,
      doctor: b.doctor?.fullName ?? null,
      package: b.package?.title ?? null,
    })),
    total,
    hasMore: page * PAGE_SIZE < total,
    hospitals,
    scope: ctx.isAdmin ? "platform" : "assigned",
  });
}
