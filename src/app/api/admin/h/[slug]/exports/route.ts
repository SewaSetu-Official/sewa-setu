import { NextResponse } from "next/server";
import { requireHospitalAccess, writeAuditLog } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const RANGE_OPTIONS: Record<string, { days: number; label: string }> = {
  today: { days: 1, label: "today" },
  week: { days: 7, label: "7-days" },
  "15d": { days: 15, label: "15-days" },
  month: { days: 30, label: "30-days" },
  "3m": { days: 90, label: "3-months" },
  year: { days: 365, label: "1-year" },
};

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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let ctx;
  try { ctx = await requireHospitalAccess(slug, "EXPORT_HOSPITAL_DATA", { apiMode: true }); }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ error: msg }, { status: msg === "FORBIDDEN" ? 403 : 401 });
  }

  const hospitalId = ctx.membership.hospitalId;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "bookings";
  const rangeKey = searchParams.get("range") ?? "month";
  const range = RANGE_OPTIONS[rangeKey] ?? RANGE_OPTIONS.month;
  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - (range.days - 1));
  rangeStart.setHours(0, 0, 0, 0);
  const createdAtFilter = { gte: rangeStart };

  let filename = `${slug}-${type}.csv`;
  let content = "";

  if (type === "bookings") {
    const bookings = await db.booking.findMany({
      where: { hospitalId, createdAt: createdAtFilter },
      orderBy: { createdAt: "desc" },
      take: 1000,
      include: {
        patient: { select: { fullName: true, phone: true } },
        doctor: { select: { fullName: true } },
        package: { select: { title: true } },
      },
    });
    content = csv(
      ["id", "status", "patient", "phone", "doctor", "package", "scheduledAt", "slotTime", "mode", "amountPaid", "currency", "createdAt"],
      bookings.map((booking) => [
        booking.id,
        booking.status,
        booking.patient.fullName,
        booking.patient.phone,
        booking.doctor?.fullName,
        booking.package?.title,
        booking.scheduledAt.toISOString(),
        booking.slotTime,
        booking.mode,
        booking.amountPaid,
        booking.currency,
        booking.createdAt.toISOString(),
      ]),
    );
  } else if (type === "revenue") {
    const bookings = await db.booking.findMany({
      where: { hospitalId, amountPaid: { not: null }, createdAt: createdAtFilter },
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: {
        id: true,
        status: true,
        amountPaid: true,
        currency: true,
        stripeSessionId: true,
        stripeRefundId: true,
        refundedAt: true,
        createdAt: true,
      },
    });
    content = csv(
      ["id", "status", "amountPaid", "currency", "stripeSessionId", "stripeRefundId", "refundedAt", "createdAt"],
      bookings.map((booking) => [
        booking.id,
        booking.status,
        booking.amountPaid,
        booking.currency,
        booking.stripeSessionId,
        booking.stripeRefundId,
        booking.refundedAt?.toISOString(),
        booking.createdAt.toISOString(),
      ]),
    );
  } else if (type === "audit") {
    const logs = await db.auditLog.findMany({
      where: { hospitalId, createdAt: createdAtFilter },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    content = csv(
      ["id", "action", "entity", "entityId", "actorUserId", "createdAt"],
      logs.map((log) => [
        log.id,
        log.action,
        log.entity,
        log.entityId,
        log.actorUserId,
        log.createdAt.toISOString(),
      ]),
    );
  } else {
    return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
  }

  filename = `${slug}-${type}-${range.label}-${new Date().toISOString().slice(0, 10)}.csv`;

  await writeAuditLog({
    actorUserId: ctx.user.id,
    hospitalId,
    action: "HOSPITAL_DATA_EXPORTED",
    entity: "Hospital",
    entityId: hospitalId,
    after: { type, range: range.label, filename },
  });

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
