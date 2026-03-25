import { NextResponse } from "next/server";
import Stripe from "stripe";
import { headers } from "next/headers";
import { provisionBooking } from "@/lib/booking";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = (await headers()).get("Stripe-Signature") as string;

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-12-15.clover" as any,
    });

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`Webhook Signature Verification Failed: ${message}`);
      return NextResponse.json({ error: "Invalid Signature" }, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log(`✅ Payment received via Webhook: ${session.id} | €${((session.amount_total ?? 0) / 100).toFixed(2)} | ${session.customer_email}`);

      try {
        await provisionBooking(session);
      } catch (err) {
        // Log but don't throw — /api/verify is the fallback if the user reaches the success page.
        // Non-transient errors (e.g. bad metadata) shouldn't cause Stripe to retry endlessly.
        console.error("❌ Webhook booking provision failed:", err instanceof Error ? err.message : err);
      }
    }

    // Always acknowledge receipt so Stripe doesn't retry unnecessarily.
    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error) {
    console.error("Webhook Error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
