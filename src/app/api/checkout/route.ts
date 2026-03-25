import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // ── AUTH CHECK ───────────────────────────────────────────────────
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "You must be signed in to book" }, { status: 401 });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const StripeModule = await import("stripe");
    const Stripe = StripeModule.default;

    const body = await req.json();
    const {
      packageId,
      doctorId,
      buyerEmail,
      patientName,
      patientAge,
      patientPhone,
      bookingDate,
      consultationMode,
      slotId,
      slotTime,
      hospitalId,
    } = body;

    if (!packageId && !doctorId) {
      return NextResponse.json({ error: "packageId or doctorId is required" }, { status: 400 });
    }

    // ── INPUT VALIDATION ────────────────────────────────────────────
    if (!buyerEmail || typeof buyerEmail !== "string" || !buyerEmail.includes("@") || buyerEmail.length > 254) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }
    if (!patientName || typeof patientName !== "string") {
      return NextResponse.json({ error: "Patient name is required" }, { status: 400 });
    }
    const trimmedName = patientName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return NextResponse.json({ error: "Name must be between 2-100 characters" }, { status: 400 });
    }
    if (!/^[a-zA-Z\s\-'.]+$/.test(trimmedName)) {
      return NextResponse.json({ error: "Name contains invalid characters" }, { status: 400 });
    }
    if (!patientPhone || typeof patientPhone !== "string") {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }
    const cleanPhone = patientPhone.replace(/[\s\-().+]/g, "");
    if (!/^\d{7,15}$/.test(cleanPhone)) {
      return NextResponse.json({ error: "Phone number must be between 7 and 15 digits" }, { status: 400 });
    }
    const normalizedPhone = cleanPhone;
    if (patientAge === undefined || patientAge === null) {
      return NextResponse.json({ error: "Patient age is required" }, { status: 400 });
    }
    const age = Number(patientAge);
    if (isNaN(age) || age < 0 || age > 150 || !Number.isInteger(age)) {
      return NextResponse.json({ error: "Age must be a valid integer between 0-150" }, { status: 400 });
    }
    if (bookingDate) {
      const date = new Date(bookingDate);
      if (isNaN(date.getTime())) {
        return NextResponse.json({ error: "Invalid booking date" }, { status: 400 });
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) {
        return NextResponse.json({ error: "Booking date cannot be in the past" }, { status: 400 });
      }
    }

    // ── SANITIZE ─────────────────────────────────────────────────────
    const sanitizedName = trimmedName.replace(/<[^>]*>/g, "").trim();
    const sanitizedEmail = buyerEmail.toLowerCase().trim();
    const sanitizedPhone = normalizedPhone;

    // ── SERVER-SIDE PRICE LOOKUP ──────────────────────────────────────
    let itemName: string;
    let priceCents: number;
    let itemHospitalId: string;

    const metadata: Record<string, string> = {
      clerkUserId,                                          // ← key addition
      patientName: sanitizedName,
      patientAge: String(age),
      patientPhone: sanitizedPhone,
      buyerEmail: sanitizedEmail,
      bookingDate: String(bookingDate || new Date().toISOString()),
    };

    if (packageId) {
      const pkg = await db.hospitalPackage.findUnique({ where: { id: packageId } });
      if (!pkg) return NextResponse.json({ error: "Package not found" }, { status: 404 });
      if (!pkg.price || pkg.price <= 0) return NextResponse.json({ error: "Package has no valid price" }, { status: 400 });
      itemName = pkg.title;
      priceCents = pkg.price;
      itemHospitalId = pkg.hospitalId;
      metadata.type = "package";
      metadata.packageId = pkg.id;
      metadata.packageName = pkg.title;
      metadata.hospitalId = pkg.hospitalId;
      if (slotId) metadata.slotId = String(slotId);
      if (slotTime) metadata.slotTime = String(slotTime);
    } else {
      const doctor = await db.doctor.findUnique({ where: { id: doctorId } });
      if (!doctor) return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
      if (!doctor.feeMin || doctor.feeMin <= 0) return NextResponse.json({ error: "Doctor has no valid consultation fee" }, { status: 400 });
      itemName = `Consultation — ${doctor.fullName}`;
      priceCents = doctor.feeMin;
      itemHospitalId = hospitalId ?? "";
      metadata.type = "doctor";
      metadata.doctorId = doctor.id;
      metadata.doctorName = doctor.fullName;
      if (consultationMode) metadata.consultationMode = String(consultationMode);
      if (slotId) metadata.slotId = String(slotId);
      if (slotTime) metadata.slotTime = String(slotTime);
      if (hospitalId) metadata.hospitalId = String(hospitalId);
    }

    // ── CREATE STRIPE SESSION ────────────────────────────────────────
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${process.env.VERCEL_URL}`;

    const session = await stripe.checkout.sessions.create({
      customer_email: sanitizedEmail,
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: { name: itemName },
          unit_amount: priceCents,
        },
        quantity: 1,
      }],
      mode: "payment",
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      success_url: `${baseUrl}/book/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/search`,
      metadata,
    });

    console.log(`✅ Checkout: ${session.id} | ${clerkUserId} | ${itemName} | €${(priceCents / 100).toFixed(2)}`);
    return NextResponse.json({ url: session.url });

  } catch (error) {
    const isStripeError = typeof error === "object" && error !== null && "type" in error;
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Checkout error:", message);
    const clientMessage = isStripeError && (error as { type: string }).type === "StripeInvalidRequestError"
      ? "Invalid payment request"
      : "Payment processing error. Please try again.";
    return NextResponse.json({ error: clientMessage }, { status: 500 });
  }
}
