import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/reviews?hospitalId=X
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const hospitalId = searchParams.get("hospitalId");
  if (!hospitalId) return NextResponse.json({ error: "hospitalId is required" }, { status: 400 });

  const { userId: clerkId } = await auth();
  let dbUserId: string | null = null;
  if (clerkId) {
    const u = await db.user.findUnique({ where: { clerkId }, select: { id: true } });
    dbUserId = u?.id ?? null;
  }

  const raw = await db.review.findMany({
    where: { hospitalId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, rating: true, comment: true, createdAt: true,
      userId: true,
      user: { select: { fullName: true } },
    },
  });

  // Determine which reviewers have a confirmed/completed booking at this hospital
  const reviewerIds = [...new Set(raw.map((r) => r.userId))];
  const bookedRows = reviewerIds.length > 0
    ? await db.booking.findMany({
        where: { hospitalId, userId: { in: reviewerIds }, status: { in: ["CONFIRMED", "COMPLETED"] } },
        select: { userId: true },
        distinct: ["userId"],
      })
    : [];
  const bookedSet = new Set(bookedRows.map((b) => b.userId));

  const avg = raw.length > 0
    ? Math.round((raw.reduce((s, r) => s + r.rating, 0) / raw.length) * 10) / 10
    : null;

  const reviews = raw.map(({ userId, ...r }) => ({
    ...r,
    isOwn: dbUserId ? userId === dbUserId : false,
    isVerifiedPatient: bookedSet.has(userId),
  }));

  return NextResponse.json({ reviews, average: avg, count: reviews.length });
}

// POST /api/reviews — any signed-in user, once per hospital
export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Sign in to leave a review" }, { status: 401 });

  let body: { hospitalId?: string; rating?: number; comment?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { hospitalId, rating, comment } = body;

  if (!hospitalId || typeof rating !== "number" || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "hospitalId and rating (1–5) are required" }, { status: 400 });
  }

  const dbUser = await db.user.findUnique({ where: { clerkId }, select: { id: true } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const hospital = await db.hospital.findUnique({ where: { id: hospitalId }, select: { id: true } });
  if (!hospital) return NextResponse.json({ error: "Hospital not found" }, { status: 404 });

  // Max 3 reviews per user per hospital
  const reviewCount = await db.review.count({ where: { userId: dbUser.id, hospitalId } });
  if (reviewCount >= 3) return NextResponse.json({ error: "You can leave up to 3 reviews per hospital" }, { status: 409 });

  const review = await db.review.create({
    data: { userId: dbUser.id, hospitalId, rating, comment: comment?.trim() || null },
    select: {
      id: true, rating: true, comment: true, createdAt: true,
      user: { select: { fullName: true } },
    },
  });

  const hasBooking = await db.booking.count({
    where: { userId: dbUser.id, hospitalId, status: { in: ["CONFIRMED", "COMPLETED"] } },
  }) > 0;

  return NextResponse.json({ ...review, isOwn: true, isVerifiedPatient: hasBooking }, { status: 201 });
}
