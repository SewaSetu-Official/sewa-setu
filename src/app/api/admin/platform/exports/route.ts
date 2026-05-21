import { NextResponse } from "next/server";
import { BookingStatus, Prisma } from "@prisma/client";
import { requirePlatformStaff, writeAuditLog } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const BOOKING_STATUSES: BookingStatus[] = ["DRAFT", "REQUESTED", "CONFIRMED", "CANCELLED", "COMPLETED"];
const REVENUE_STATUSES: BookingStatus[] = ["CONFIRMED", "COMPLETED"];

function csvCell(value: unknown) {
  if (value == null) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csv(headers: string[], rows: unknown[][]) {
  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\n");
}

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

export async function GET(req: Request) {
  let ctx;
  try { ctx = await requirePlatformStaff({ apiMode: true }); }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ error: msg }, { status: msg === "FORBIDDEN" ? 403 : 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "revenue";
  const hospitalId = searchParams.get("hospitalId") ?? "";
  const status = searchParams.get("status") ?? "all";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const createdAtRange = parseCreatedAtRange(from, to);

  if (type !== "revenue") {
    return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
  }

  if (createdAtRange === null) {
    return NextResponse.json({ error: "Invalid date filter" }, { status: 400 });
  }

  const assignedHospitalIds = ctx.assignedHospitalIds;
  const supportHospitalFilter = hospitalId
    ? (assignedHospitalIds.includes(hospitalId) ? hospitalId : { in: [] as string[] })
    : { in: assignedHospitalIds };

  const where: Prisma.BookingWhereInput = {
    amountPaid: { not: null },
    ...(ctx.isAdmin
      ? (hospitalId ? { hospitalId } : {})
      : { hospitalId: supportHospitalFilter }),
    ...(Object.keys(createdAtRange).length ? { createdAt: createdAtRange } : {}),
  };

  if (status === "all") {
    where.status = { in: REVENUE_STATUSES };
  } else if (status === "refunded") {
    where.status = { in: REVENUE_STATUSES };
    where.stripeRefundId = { not: null };
  } else {
    const normalizedStatus = status.toUpperCase() as BookingStatus;
    if (!BOOKING_STATUSES.includes(normalizedStatus)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }
    where.status = normalizedStatus;
  }

  const bookings = await db.booking.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: {
      id: true,
      status: true,
      amountPaid: true,
      currency: true,
      stripeSessionId: true,
      stripeRefundId: true,
      refundedAt: true,
      createdAt: true,
      scheduledAt: true,
      hospital: { select: { id: true, name: true, slug: true } },
      doctor: { select: { fullName: true } },
      package: { select: { title: true } },
    },
  });

  const content = csv(
    [
      "bookingId",
      "hospitalId",
      "hospital",
      "hospitalSlug",
      "status",
      "doctor",
      "package",
      "amountPaid",
      "currency",
      "stripeSessionId",
      "stripeRefundId",
      "refundedAt",
      "scheduledAt",
      "createdAt",
    ],
    bookings.map((booking) => [
      booking.id,
      booking.hospital.id,
      booking.hospital.name,
      booking.hospital.slug,
      booking.status,
      booking.doctor?.fullName,
      booking.package?.title,
      booking.amountPaid,
      booking.currency,
      booking.stripeSessionId,
      booking.stripeRefundId,
      booking.refundedAt?.toISOString(),
      booking.scheduledAt.toISOString(),
      booking.createdAt.toISOString(),
    ]),
  );

  const exportedAt = new Date().toISOString().slice(0, 10);
  const filename = `platform-revenue-${from || "start"}-${to || exportedAt}.csv`;

  await writeAuditLog({
    actorUserId: ctx.user.id,
    action: "PLATFORM_REVENUE_EXPORTED",
    entity: "PlatformRevenue",
    entityId: "platform",
    after: {
      filename,
      rows: bookings.length,
      scope: ctx.isAdmin ? "platform" : "assigned",
      hospitalId: hospitalId || null,
      status,
      from: from || null,
      to: to || null,
    },
  });

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
