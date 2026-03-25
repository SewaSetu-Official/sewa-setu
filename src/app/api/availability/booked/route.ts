import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/availability/booked?doctorId=xxx
// Returns all confirmed booked (slotId, date) pairs for a doctor,
// plus isYours flag for the currently signed-in user.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const doctorId = searchParams.get("doctorId");

    if (!doctorId) {
      return NextResponse.json({ error: "doctorId required" }, { status: 400 });
    }

    // Optional auth — get current user's DB id if signed in
    const { userId: clerkUserId } = await auth();
    let currentDbUserId: string | null = null;

    if (clerkUserId) {
      const dbUser = await db.user.findUnique({
        where: { clerkId: clerkUserId },
        select: { id: true },
      });
      currentDbUserId = dbUser?.id ?? null;
    }

    // Fetch all confirmed bookings for this doctor that have a slot link
    const bookings = await db.booking.findMany({
      where: {
        doctorId,
        status: "CONFIRMED",
        availabilitySlotId: { not: null },
        scheduledAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // only upcoming + recent
      },
      select: {
        availabilitySlotId: true,
        scheduledAt: true,
        userId: true,
      },
    });

    const booked = bookings.map((b) => ({
      slotId: b.availabilitySlotId!,
      date: b.scheduledAt.toISOString().slice(0, 10), // YYYY-MM-DD
      isYours: currentDbUserId !== null && b.userId === currentDbUserId,
    }));

    return NextResponse.json({ booked });
  } catch (error) {
    console.error("Booked slots error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
