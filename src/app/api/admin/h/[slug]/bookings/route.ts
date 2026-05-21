import { NextResponse } from "next/server";
import { requireHospitalAccess, writeAuditLog } from "@/lib/admin-auth";
import { buildRollingOccurrences, formatDate } from "@/lib/availability";
import { hasPermission, type Permission } from "@/lib/admin-permissions";
import { db } from "@/lib/db";
import type { BookingStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const BOOKING_STATUSES: BookingStatus[] = ["DRAFT", "REQUESTED", "CONFIRMED", "CANCELLED", "COMPLETED"];
const VALID_ACTIONS = ["CONFIRM", "COMPLETE", "CANCEL", "CHECKIN", "RESCHEDULE"] as const;
type BookingAction = (typeof VALID_ACTIONS)[number];
const ACTION_PERMISSIONS = {
  CONFIRM: "CONFIRM_BOOKING",
  COMPLETE: "COMPLETE_BOOKING",
  CANCEL: "CANCEL_BOOKING",
  CHECKIN: "CHECKIN_BOOKING",
  RESCHEDULE: "RESCHEDULE_BOOKING",
} satisfies Record<BookingAction, Permission>;

function isBookingAction(action: string): action is BookingAction {
  return (VALID_ACTIONS as readonly string[]).includes(action);
}

function getAppointmentDateTime(scheduledAt: Date, slotTime: string | null) {
  if (!slotTime) return scheduledAt;
  const start = slotTime.split("-")[0]?.trim();
  const [hour, minute = 0] = start.split(":").map(Number);
  const at = new Date(scheduledAt);
  if (Number.isInteger(hour) && Number.isInteger(minute)) {
    at.setHours(hour, minute, 0, 0);
  }
  return at;
}

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
  const isDoctorRole = ctx.membership.role === "DOCTOR";
  const doctorProfile = isDoctorRole
    ? await db.doctor.findFirst({
        where: {
          userId: ctx.user.id,
          hospitals: { some: { hospitalId } },
        },
        select: { id: true, fullName: true },
      })
    : null;

  const where: Record<string, unknown> = {
    hospitalId,
    ...(isDoctorRole ? { doctorId: doctorProfile?.id ?? "__NO_DOCTOR_PROFILE__" } : {}),
  };

  if (status !== "all") {
    const normalizedStatus = status.toUpperCase() as BookingStatus;
    if (!BOOKING_STATUSES.includes(normalizedStatus)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }
    where.status = normalizedStatus;
  }

  if (date) {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid date filter" }, { status: 400 });
    }
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

  const orderBy = date
    ? [{ scheduledAt: "asc" as const }, { slotTime: "asc" as const }, { createdAt: "desc" as const }]
    : [{ createdAt: "desc" as const }];

  const [total, bookings] = await Promise.all([
    db.booking.count({ where: where as never }),
    db.booking.findMany({
      where: where as never,
      include: {
        patient: { select: { fullName: true, phone: true, gender: true, disability: true } },
        doctor:  { select: { fullName: true } },
        package: { select: { title: true } },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    role: ctx.membership.role,
    doctorName: doctorProfile?.fullName ?? null,
    permissions: {
      canConfirm: hasPermission(ctx.membership.role, "CONFIRM_BOOKING"),
      canCancel: hasPermission(ctx.membership.role, "CANCEL_BOOKING"),
      canComplete: hasPermission(ctx.membership.role, "COMPLETE_BOOKING"),
      canCheckIn: hasPermission(ctx.membership.role, "CHECKIN_BOOKING"),
      canReschedule: hasPermission(ctx.membership.role, "RESCHEDULE_BOOKING"),
    },
    bookings: bookings.map((b) => ({
      id: b.id,
      doctorId: b.doctorId ?? null,
      availabilitySlotId: b.availabilitySlotId ?? null,
      status: b.status,
      scheduledAt: b.scheduledAt.toISOString(),
      createdAt: b.createdAt.toISOString(),
      slotTime: b.slotTime ?? null,
      mode: b.mode,
      amountPaid: b.amountPaid ?? null,
      currency: b.currency ?? "eur",
      notes: b.notes ?? null,
      cancellationReason: b.cancellationReason ?? null,
      confirmedAt: b.confirmedAt?.toISOString() ?? null,
      completedAt: b.completedAt?.toISOString() ?? null,
      checkedInAt: b.checkedInAt?.toISOString() ?? null,
      clinicalNotes: (b as { clinicalNotes?: string | null }).clinicalNotes ?? null,
      clinicalOutcome: (b as { clinicalOutcome?: string | null }).clinicalOutcome ?? null,
      followUpInstructions: (b as { followUpInstructions?: string | null }).followUpInstructions ?? null,
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
  try { ctx = await requireHospitalAccess(slug, undefined, { apiMode: true }); }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ error: msg }, { status: msg === "FORBIDDEN" ? 403 : 401 });
  }

  let body: {
    bookingId?: string;
    action?: string;
    reason?: string;
    scheduledAt?: string;
    slotTime?: string;
    availabilitySlotId?: string | null;
    clinicalNotes?: string;
    clinicalOutcome?: string;
    followUpInstructions?: string;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { bookingId, action, reason } = body;

  if (!bookingId || !action) {
    return NextResponse.json({ error: "bookingId and action are required" }, { status: 400 });
  }

  if (!isBookingAction(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const requiredPermission = ACTION_PERMISSIONS[action];
  if (!hasPermission(ctx.membership.role, requiredPermission)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  if (action === "CANCEL" && !reason?.trim()) {
    return NextResponse.json({ error: "Cancellation reason is required" }, { status: 400 });
  }
  if (action === "RESCHEDULE" && (!body.scheduledAt || !body.slotTime || !body.availabilitySlotId)) {
    return NextResponse.json({ error: "scheduledAt, slotTime and availabilitySlotId are required" }, { status: 400 });
  }

  const booking = await db.booking.findFirst({
    where: { id: bookingId, hospitalId: ctx.membership.hospitalId },
  });

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  if (ctx.membership.role === "DOCTOR") {
    if (action !== "COMPLETE") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const doctorProfile = await db.doctor.findFirst({
      where: {
        userId: ctx.user.id,
        hospitals: { some: { hospitalId: ctx.membership.hospitalId } },
      },
      select: { id: true },
    });

    if (!doctorProfile || booking.doctorId !== doctorProfile.id) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
  }

  // Validate transition
  const VALID_TRANSITIONS: Record<string, string[]> = {
    CONFIRM:  ["REQUESTED"],
    COMPLETE: ["CONFIRMED"],
    CANCEL:   ["REQUESTED", "CONFIRMED"],
    CHECKIN:  ["CONFIRMED"],
    RESCHEDULE: ["REQUESTED", "CONFIRMED"],
  };

  if (!VALID_TRANSITIONS[action].includes(booking.status)) {
    return NextResponse.json({
      error: `Cannot ${action.toLowerCase()} a booking with status ${booking.status}`,
    }, { status: 400 });
  }
  if (action === "CHECKIN" && booking.checkedInAt) {
    return NextResponse.json({ error: "Booking is already checked in" }, { status: 400 });
  }
  if (action === "COMPLETE" && !booking.checkedInAt) {
    return NextResponse.json({ error: "Check in the patient before completing this booking" }, { status: 400 });
  }
  if (action === "RESCHEDULE" && booking.checkedInAt) {
    return NextResponse.json({ error: "Checked-in bookings cannot be rescheduled" }, { status: 400 });
  }

  const now = new Date();
  const updateData: Record<string, unknown> = {};

  if (action === "RESCHEDULE") {
    if (!booking.doctorId) {
      return NextResponse.json({ error: "Only doctor bookings can be rescheduled here" }, { status: 400 });
    }
    const newAvailabilitySlotId = body.availabilitySlotId;
    if (!newAvailabilitySlotId) {
      return NextResponse.json({ error: "availabilitySlotId is required" }, { status: 400 });
    }
    const newSlotTime = body.slotTime;
    if (!newSlotTime) {
      return NextResponse.json({ error: "slotTime is required" }, { status: 400 });
    }

    const newDate = new Date(`${body.scheduledAt}T00:00:00`);
    if (Number.isNaN(newDate.getTime())) {
      return NextResponse.json({ error: "Invalid reschedule date" }, { status: 400 });
    }
    newDate.setHours(0, 0, 0, 0);

    const slot = await db.availabilitySlot.findFirst({
      where: {
        id: newAvailabilitySlotId,
        doctorId: booking.doctorId,
        hospitalId: ctx.membership.hospitalId,
        isActive: true,
      },
      select: {
        id: true,
        doctorId: true,
        hospitalId: true,
        mode: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        slotDurationMinutes: true,
        isActive: true,
      },
    });

    if (!slot) {
      return NextResponse.json({ error: "Selected slot is not active for this doctor" }, { status: 400 });
    }

    const occurrences = buildRollingOccurrences([slot], newDate, 1).occurrencesByDate[formatDate(newDate)] ?? [];
    const selectedOccurrence = occurrences.find((occurrence) =>
      occurrence.windowId === newAvailabilitySlotId &&
      `${occurrence.startTime} - ${occurrence.endTime}` === newSlotTime,
    );

    if (!selectedOccurrence) {
      return NextResponse.json({ error: "Selected time is not part of this availability window" }, { status: 400 });
    }
    if (getAppointmentDateTime(newDate, newSlotTime).getTime() <= Date.now()) {
      return NextResponse.json({ error: "Cannot reschedule to a past or expired time slot" }, { status: 400 });
    }

    updateData.scheduledAt = newDate;
    updateData.slotTime = newSlotTime;
    updateData.availabilitySlotId = newAvailabilitySlotId;
    updateData.mode = slot.mode;
    updateData.rescheduleCount = { increment: 1 };
  }

  switch (action) {
    case "CONFIRM":
      updateData.status = "CONFIRMED";
      updateData.confirmedAt = now;
      break;
    case "COMPLETE":
      updateData.status = "COMPLETED";
      updateData.completedAt = now;
      updateData.clinicalNotes = body.clinicalNotes?.trim() || null;
      updateData.clinicalOutcome = body.clinicalOutcome?.trim() || null;
      updateData.followUpInstructions = body.followUpInstructions?.trim() || null;
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
    case "RESCHEDULE":
      break;
  }

  let updated;
  try {
    updated = await db.booking.update({
      where: { id: bookingId },
      data: updateData as never,
    });
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "That time slot is already booked. Please choose another." }, { status: 409 });
    }
    throw err;
  }

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
    before: {
      status: booking.status,
      scheduledAt: booking.scheduledAt.toISOString(),
      slotTime: booking.slotTime,
      availabilitySlotId: booking.availabilitySlotId,
    },
    after: {
      status: updated.status,
      scheduledAt: updated.scheduledAt.toISOString(),
      slotTime: updated.slotTime,
      availabilitySlotId: updated.availabilitySlotId,
      ...(reason ? { reason } : {}),
      ...(refundId ? { stripeRefundId: refundId } : {}),
      ...(refundError ? { refundError } : {}),
    },
  });

  return NextResponse.json({
    success: true,
    status: updated.status,
    scheduledAt: updated.scheduledAt.toISOString(),
    slotTime: updated.slotTime,
    refunded: !!refundId,
    refundError: refundError ?? undefined,
  });
}
