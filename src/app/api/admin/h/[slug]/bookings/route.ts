import { NextResponse } from "next/server";
import { requireHospitalAccess, writeAuditLog } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/admin/h/[slug]/bookings — paginated booking list with filters
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let ctx;
  try { ctx = await requireHospitalAccess(slug, "VIEW_BOOKINGS", { apiMode: true }); }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ error: msg }, { status: msg === "FORBIDDEN" ? 403 : 401 });
  }

  const { searchParams } = new URL(req.url);
  const status   = searchParams.get("status") ?? "all";
  const date     = searchParams.get("date")   ?? "";
  const search   = searchParams.get("search") ?? "";
  const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = 20;

  const hospitalId = ctx.membership.hospitalId;

  const where: Record<string, unknown> = { hospitalId };

  if (status !== "all") where.status = status.toUpperCase();

  if (date) {
    const d = new Date(date);
    const start = new Date(d); start.setHours(0, 0, 0, 0);
    const end   = new Date(d); end.setHours(23, 59, 59, 999);
    where.scheduledAt = { gte: start, lte: end };
  }

  // Search by patient name or booking ID
  if (search) {
    where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { patient: { fullName: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [total, bookings] = await Promise.all([
    db.booking.count({ where: where as never }),
    db.booking.findMany({
      where: where as never,
      include: {
        patient: { select: { fullName: true, phone: true, gender: true, disability: true } },
        doctor:  { select: { fullName: true } },
        package: { select: { title: true } },
      },
      orderBy: [{ status: "asc" }, { scheduledAt: "asc" }, { slotTime: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    bookings: bookings.map((b) => ({
      id: b.id,
      status: b.status,
      scheduledAt: b.scheduledAt.toISOString(),
      slotTime: b.slotTime ?? null,
      mode: b.mode,
      amountPaid: b.amountPaid ?? null,
      currency: b.currency ?? "eur",
      notes: b.notes ?? null,
      cancellationReason: b.cancellationReason ?? null,
      confirmedAt: b.confirmedAt?.toISOString() ?? null,
      completedAt: b.completedAt?.toISOString() ?? null,
      checkedInAt: b.checkedInAt?.toISOString() ?? null,
      cancelledAt: b.cancelledAt?.toISOString() ?? null,
      refundedAt: b.refundedAt?.toISOString() ?? null,
      stripeRefundId: b.stripeRefundId ?? null,
      patient: b.patient ? {
        fullName: b.patient.fullName,
        phone: b.patient.phone ?? null,
        gender: b.patient.gender ?? null,
        disability: b.patient.disability ?? null,
      } : null,
      doctor:  b.doctor  ? { fullName: b.doctor.fullName }  : null,
      package: b.package ? { title: b.package.title }       : null,
    })),
    total,
    page,
    hasMore: page * pageSize < total,
  });
}

// PATCH /api/admin/h/[slug]/bookings — status transition
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let ctx;
  try { ctx = await requireHospitalAccess(slug, "CONFIRM_BOOKING", { apiMode: true }); }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ error: msg }, { status: msg === "FORBIDDEN" ? 403 : 401 });
  }

  let body: { bookingId?: string; action?: string; reason?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { bookingId, action, reason } = body;

  if (!bookingId || !action) {
    return NextResponse.json({ error: "bookingId and action are required" }, { status: 400 });
  }

  const VALID_ACTIONS = ["CONFIRM", "COMPLETE", "CANCEL", "CHECKIN"];
  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  if (action === "CANCEL" && !reason?.trim()) {
    return NextResponse.json({ error: "Cancellation reason is required" }, { status: 400 });
  }

  const booking = await db.booking.findFirst({
    where: { id: bookingId, hospitalId: ctx.membership.hospitalId },
  });

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // Validate transition
  const VALID_TRANSITIONS: Record<string, string[]> = {
    CONFIRM:  ["REQUESTED"],
    COMPLETE: ["CONFIRMED"],
    CANCEL:   ["REQUESTED", "CONFIRMED"],
    CHECKIN:  ["CONFIRMED"],
  };

  if (!VALID_TRANSITIONS[action].includes(booking.status)) {
    return NextResponse.json({
      error: `Cannot ${action.toLowerCase()} a booking with status ${booking.status}`,
    }, { status: 400 });
  }

  const now = new Date();
  const updateData: Record<string, unknown> = {};

  switch (action) {
    case "CONFIRM":
      updateData.status = "CONFIRMED";
      updateData.confirmedAt = now;
      break;
    case "COMPLETE":
      updateData.status = "COMPLETED";
      updateData.completedAt = now;
      break;
    case "CANCEL":
      updateData.status = "CANCELLED";
      updateData.cancelledAt = now;
      updateData.cancelledById = ctx.user.id;
      updateData.cancellationReason = reason!.trim();
      break;
    case "CHECKIN":
      updateData.checkedInAt = now;
      break;
  }

  const updated = await db.booking.update({
    where: { id: bookingId },
    data: updateData as never,
  });

  // Stripe refund — only on CANCEL for Stripe-paid bookings
  let refundId: string | null = null;
  let refundError: string | null = null;

  if (action === "CANCEL" && booking.stripeSessionId && process.env.STRIPE_SECRET_KEY) {
    try {
      const StripeModule = await import("stripe");
      const Stripe = StripeModule.default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

      // Retrieve session to get payment_intent
      const session = await stripe.checkout.sessions.retrieve(booking.stripeSessionId);
      const paymentIntentId = typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

      if (paymentIntentId) {
        const refund = await stripe.refunds.create({
          payment_intent: paymentIntentId,
          reason: "requested_by_customer",
        });
        refundId = refund.id;
        // Store on booking
        await db.booking.update({
          where: { id: bookingId },
          data: { stripeRefundId: refund.id, refundedAt: new Date() },
        });
      }
    } catch (e) {
      // Don't fail the cancellation if refund fails — log it
      refundError = e instanceof Error ? e.message : "Refund failed";
      console.error("[CANCEL] Stripe refund failed:", refundError);
    }
  }

  // Write audit log
  await writeAuditLog({
    actorUserId: ctx.user.id,
    hospitalId: ctx.membership.hospitalId,
    action: `BOOKING_${action}`,
    entity: "Booking",
    entityId: bookingId,
    before: { status: booking.status },
    after: {
      status: updated.status,
      ...(reason ? { reason } : {}),
      ...(refundId ? { stripeRefundId: refundId } : {}),
      ...(refundError ? { refundError } : {}),
    },
  });

  return NextResponse.json({
    success: true,
    status: updated.status,
    refunded: !!refundId,
    refundError: refundError ?? undefined,
  });
}
