import Stripe from "stripe";
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
  const dbUser = await db.user.upsert({
    where: { clerkId: clerkUserId },
    update: { email: userEmail, fullName: userFullName },
    create: { clerkId: clerkUserId, email: userEmail, fullName: userFullName, country: "NP" },
  });

  // ── 4. FIND OR CREATE PATIENT ────────────────────────────────────
  const patientFullName = meta.patientName ?? userFullName;
  let patient = await db.patient.findFirst({
    where: { userId: dbUser.id, fullName: patientFullName },
  });
  if (!patient) {
    patient = await db.patient.create({
      data: {
        userId: dbUser.id,
        fullName: patientFullName,
        phone: meta.patientPhone ?? null,
        dateOfBirth: meta.patientAge
          ? new Date(new Date().getFullYear() - parseInt(meta.patientAge), 0, 1)
          : null,
      },
    });
  }

  // ── 5. RESOLVE HOSPITAL ──────────────────────────────────────────
  const hospitalId = meta.hospitalId;
  if (!hospitalId) throw new Error("Missing hospitalId in Stripe session metadata");

  const hospital = await db.hospital.findUnique({ where: { id: hospitalId } });
  if (!hospital) throw new Error(`Hospital ${hospitalId} not found`);

  // ── 6. CREATE BOOKING ────────────────────────────────────────────
  const booking = await db.booking.create({
    data: {
      stripeSessionId: sessionId,
      userId: dbUser.id,
      patientId: patient.id,
      hospitalId: hospital.id,
      doctorId: meta.doctorId ?? null,
      packageId: meta.packageId ?? null,
      availabilitySlotId: meta.slotId ?? null,
      mode: (meta.consultationMode === "ONLINE" ? "ONLINE" : "PHYSICAL") as any,
      scheduledAt: meta.bookingDate ? new Date(meta.bookingDate) : new Date(),
      slotTime: meta.slotTime ?? null,
      amountPaid: session.amount_total,
      currency: session.currency ?? "eur",
      status: "CONFIRMED" as any,
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

  console.log(`✅ Booking created: ${booking.id} | ${userEmail} | ${hospital.name}`);
  return booking;
}
