import Stripe from "stripe";
import { BookingStatus, ConsultationMode } from "@prisma/client";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export type ProvisionedBooking = {
  id: string;
  scheduledAt: Date;
  slotTime: string | null;
  mode: string;
  patient: { fullName: string; phone: string | null } | null;
  hospital: { name: string } | null;
  package: { title: string } | null;
  doctor: { fullName: string } | null;
};

function normalizeSlotTime(value: string | null | undefined) {
  return value?.replace(/\s*-\s*/g, " - ").trim() ?? null;
}

/**
 * Refund a payment whose slot was taken by someone else before the booking
 * could be created. Idempotent (skips if the payment intent already has a
 * refund) and best-effort — failures are logged, never thrown, so they can't
 * mask the original "slot taken" outcome.
 */
async function refundLostSlot(session: Stripe.Checkout.Session) {
  try {
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;
    if (!paymentIntentId || !process.env.STRIPE_SECRET_KEY) return;

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-02-25.clover" });
    const existing = await stripe.refunds.list({ payment_intent: paymentIntentId, limit: 1 });
    if (existing.data.length > 0) return; // already refunded — don't double-refund

    await stripe.refunds.create({ payment_intent: paymentIntentId });
    console.log(`↩️  Auto-refunded lost-slot payment: ${paymentIntentId}`);
  } catch (e) {
    console.error("Failed to auto-refund lost-slot payment:", e instanceof Error ? e.message : e);
  }
}

/**
 * Idempotently creates a Booking record from a completed Stripe session.
 * Safe to call from both the webhook and the verify endpoint.
 * Returns the booking (existing or newly created).
 * Throws on unrecoverable errors so the caller can decide how to respond.
 */
export async function provisionBooking(
  session: Stripe.Checkout.Session
): Promise<ProvisionedBooking> {
  const sessionId = session.id;
  const meta = session.metadata ?? {};

  // ── 1. IDEMPOTENCY ────────────────────────────────────────────────
  const existing = await db.booking.findUnique({
    where: { stripeSessionId: sessionId },
    include: {
      hospital: { select: { name: true } },
      package: { select: { title: true } },
      doctor: { select: { fullName: true } },
      patient: true,
    },
  });
  if (existing) return existing;

  // ── 2. RESOLVE CLERK USER ─────────────────────────────────────────
  const clerkUserId = meta.clerkUserId;
  if (!clerkUserId) throw new Error("Missing clerkUserId in Stripe session metadata");

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(clerkUserId);
  const userEmail = clerkUser.emailAddresses[0]?.emailAddress ?? meta.buyerEmail ?? "";
  const userFullName = clerkUser.fullName ?? meta.patientName ?? "Unknown";

  // ── 3. UPSERT DB USER ────────────────────────────────────────────
  const existingUser = await db.user.findFirst({
    where: { OR: [{ clerkId: clerkUserId }, { email: userEmail }] },
  });
  const dbUser = existingUser
    ? await db.user.update({
        where: { id: existingUser.id },
        data: { clerkId: clerkUserId, email: userEmail, fullName: userFullName },
      })
    : await db.user.create({
        data: { clerkId: clerkUserId, email: userEmail, fullName: userFullName, country: "NP" },
      });

  // ── 5. RESOLVE HOSPITAL ──────────────────────────────────────────
  const hospitalId = meta.hospitalId;
  if (!hospitalId) throw new Error("Missing hospitalId in Stripe session metadata");

  const hospital = await db.hospital.findUnique({ where: { id: hospitalId } });
  if (!hospital) throw new Error(`Hospital ${hospitalId} not found`);

  // ── 4+6. PATIENT FIND-OR-CREATE + BOOKING IN ONE TRANSACTION ────
  // Running these atomically prevents orphaned patient records if booking
  // creation fails, and handles the duplicate-session race condition cleanly.
  const patientFullName = meta.patientName ?? userFullName;

  // DOB: store Jan 1 of the birth year — we know the age but not the exact birthday.
  const dateOfBirth = meta.patientAge
    ? new Date(new Date().getFullYear() - parseInt(meta.patientAge, 10), 0, 1)
    : null;

  let booking: ProvisionedBooking;
  try {
    booking = await db.$transaction(async (tx) => {
      // Look up by name + phone to avoid collapsing different family members with the same name.
      let patient = await tx.patient.findFirst({
        where: {
          userId: dbUser.id,
          fullName: patientFullName,
          OR: [{ phone: null }, { phone: meta.patientPhone ?? null }],
        },
      });

      if (!patient) {
        patient = await tx.patient.create({
          data: {
            userId: dbUser.id,
            fullName: patientFullName,
            phone: meta.patientPhone ?? null,
            gender: meta.patientGender ?? null,
            disability: meta.patientDisability ?? null,
            dateOfBirth,
          },
        });
      } else if (meta.patientGender || meta.patientDisability || patient.archivedAt) {
        patient = await tx.patient.update({
          where: { id: patient.id },
          data: {
            ...(meta.patientGender    && !patient.gender     && { gender:     meta.patientGender }),
            ...(meta.patientDisability && !patient.disability && { disability: meta.patientDisability }),
            ...(patient.archivedAt && { archivedAt: null }), // booking for them again revives the profile
          },
        });
      }

      return tx.booking.create({
        data: {
          stripeSessionId: sessionId,
          userId: dbUser.id,
          patientId: patient.id,
          hospitalId: hospital.id,
          doctorId: meta.doctorId ?? null,
          packageId: meta.packageId ?? null,
          availabilitySlotId: meta.slotId ?? null,
          mode:
            meta.consultationMode === "ONLINE"
              ? ConsultationMode.ONLINE
              : ConsultationMode.PHYSICAL,
          scheduledAt: meta.bookingDate ? new Date(meta.bookingDate) : new Date(),
          slotTime: normalizeSlotTime(meta.slotTime),
          amountPaid: session.amount_total,
          currency: session.currency ?? "eur",
          status: BookingStatus.CONFIRMED,
          confirmedAt: new Date(),
          notes:
            meta.type === "package"
              ? `Package: ${meta.packageName}`
              : `Doctor: ${meta.doctorName} | Mode: ${meta.consultationMode}`,
        },
        include: {
          hospital: { select: { name: true } },
          package: { select: { title: true } },
          doctor: { select: { fullName: true } },
          patient: true,
        },
      });
    });
  } catch (err: unknown) {
    // Unique constraint: two payments completed simultaneously for the same slot+date.
    // Return the booking that won the race — both users effectively have the same session.
    if (
      typeof err === "object" && err !== null && "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      // Same Stripe session retried (webhook + verify, or a Stripe retry) — the
      // booking already exists for this session, so return it.
      const conflicting = await db.booking.findUnique({
        where: { stripeSessionId: sessionId },
        include: {
          hospital: { select: { name: true } },
          package: { select: { title: true } },
          doctor: { select: { fullName: true } },
          patient: true,
        },
      });
      if (conflicting) return conflicting;

      // Otherwise the violation is the slot+date+time unique constraint: a
      // DIFFERENT payment took this slot first. This buyer can't get the slot,
      // so refund them rather than leave them charged with no booking.
      await refundLostSlot(session);
      throw new Error("That time slot was just booked by someone else. Your payment has been refunded.");
    }
    throw err;
  }

  console.log(`✅ Booking created: ${booking.id} | ${userEmail} | ${hospital.name}`);
  return booking;
}
