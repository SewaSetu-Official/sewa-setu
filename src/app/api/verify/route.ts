import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// Force Vercel to skip static analysis
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // ── 1. VERIFY STRIPE PAYMENT ─────────────────────────────────────
    const StripeModule = await import("stripe");
    const Stripe = StripeModule.default;

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json({ error: "Config error" }, { status: 500 });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-12-15.clover" as any });

    const { sessionId } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ error: "No session ID" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
    }

    const meta = session.metadata ?? {};
    const clerkUserId = meta.clerkUserId;

    if (!clerkUserId) {
      return NextResponse.json({ error: "Missing user identity in session" }, { status: 400 });
    }

    // ── 2. IDEMPOTENCY: check if booking already exists ───────────────
    const existingBooking = await db.booking.findUnique({
      where: { stripeSessionId: sessionId },
      include: {
        hospital: { select: { name: true } },
        package: { select: { title: true } },
        doctor: { select: { fullName: true } },
        patient: true,
      },
    });

    if (existingBooking) {
      return NextResponse.json({
        success: true,
        booking: formatBookingResponse(existingBooking, session),
      });
    }

    // ── 3. GET CLERK USER INFO ───────────────────────────────────────
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(clerkUserId);
    const userEmail = clerkUser.emailAddresses[0]?.emailAddress ?? meta.buyerEmail;
    const userFullName = clerkUser.fullName ?? meta.patientName ?? "Unknown";

    // ── 4. UPSERT USER IN DB ─────────────────────────────────────────
    const dbUser = await db.user.upsert({
      where: { clerkId: clerkUserId },
      update: { email: userEmail, fullName: userFullName },
      create: {
        clerkId: clerkUserId,
        email: userEmail,
        fullName: userFullName,
        country: "NP",
      },
    });

    // ── 5. FIND OR CREATE PATIENT RECORD ────────────────────────────
    const patientFullName = meta.patientName ?? userFullName;
    let patient = await db.patient.findFirst({
      where: {
        userId: dbUser.id,
        fullName: patientFullName,
      },
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

    // ── 6. RESOLVE HOSPITAL ──────────────────────────────────────────
    const hospitalId = meta.hospitalId;
    if (!hospitalId) {
      return NextResponse.json({ error: "Hospital not identified in booking" }, { status: 400 });
    }
    const hospital = await db.hospital.findUnique({ where: { id: hospitalId } });
    if (!hospital) {
      return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
    }

    // ── 7. CREATE BOOKING ────────────────────────────────────────────
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
        notes: meta.type === "package"
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

    return NextResponse.json({
      success: true,
      booking: formatBookingResponse(booking, session),
    });

  } catch (error: any) {
    console.error("❌ Verify error:", error.message);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

function formatBookingResponse(booking: any, session: any) {
  const meta = session?.metadata ?? {};
  const doctorConsultationTitle =
    booking.doctor?.fullName
      ? `Consultation 
      
      ${booking.doctor.fullName}`
      : undefined;
  return {
    id: booking.id.slice(-10).toUpperCase(),
    patientName: booking.patient?.fullName ?? meta.patientName ?? "",
    patientAge: meta.patientAge ?? "",
    patientPhone: booking.patient?.phone ?? meta.patientPhone ?? "",
    packageName:
      booking.package?.title ??
      doctorConsultationTitle ??
      meta.packageName ??
      "",
    hospitalName: booking.hospital?.name ?? "",
    bookingDate: booking.scheduledAt?.toISOString() ?? meta.bookingDate ?? "",
    slotTime: booking.slotTime ?? meta.slotTime ?? "",
    consultationMode: booking.mode ?? "",
    amountPaid: session?.amount_total
      ? `€${(session.amount_total / 100).toFixed(2)}`
      : "",
    type: meta.type ?? "package",
  };
}