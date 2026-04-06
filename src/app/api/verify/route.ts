import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { provisionBooking } from "@/lib/booking";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // ── 1. VALIDATE SESSION ID ────────────────────────────────────────
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

    // ── 2. PROVISION BOOKING (idempotent — webhook may have already created it) ──
    const booking = await provisionBooking(session);

    return NextResponse.json({
      success: true,
      booking: formatBookingResponse(booking, session),
    });

  } catch (error) {
    console.error("❌ Verify error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

function formatBookingResponse(booking: any, session: any) {
  const meta = session?.metadata ?? {};
  const doctorConsultationTitle = booking.doctor?.fullName
    ? `Consultation — ${booking.doctor.fullName}`
    : undefined;

  return {
    fullId: booking.id,
    id: booking.id.slice(-10).toUpperCase(),
    patientName: booking.patient?.fullName ?? meta.patientName ?? "",
    patientAge: meta.patientAge ?? "",
    patientGender: meta.patientGender ?? "",
    patientDisability: meta.patientDisability ?? "",
    patientPhone: booking.patient?.phone ?? meta.patientPhone ?? "",
    packageName:
      booking.package?.title ?? doctorConsultationTitle ?? meta.packageName ?? "",
    hospitalName: booking.hospital?.name ?? "",
    bookingDate: booking.scheduledAt?.toISOString() ?? meta.bookingDate ?? "",
    slotTime: booking.slotTime ?? meta.slotTime ?? "",
    consultationMode: booking.mode ?? "",
    amountPaid: session?.amount_total ? `€${(session.amount_total / 100).toFixed(2)}` : "",
    type: meta.type ?? "package",
  };
}
