import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { ensureClerkUserInDb } from "@/lib/clerk-user-sync";

export const dynamic = "force-dynamic";

// GET /api/reviews?hospitalId=X  — or  ?doctorId=Y for doctor-level reviews
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const hospitalId = searchParams.get("hospitalId");
  const doctorId = searchParams.get("doctorId");
  if (!hospitalId && !doctorId) {
    return NextResponse.json({ error: "hospitalId or doctorId is required" }, { status: 400 });
  }

  // A review targets a doctor when doctorId is supplied, otherwise a hospital.
  const reviewWhere = doctorId ? { doctorId } : { hospitalId: hospitalId! };

  const { userId: clerkId } = await auth();
  let dbUserId: string | null = null;
  if (clerkId) {
    const u = await ensureClerkUserInDb(clerkId);
    dbUserId = u?.id ?? null;
  }

  const raw = await db.review.findMany({
    where: reviewWhere,
    orderBy: { createdAt: "desc" },
    select: {
      id: true, rating: true, comment: true, createdAt: true,
      userId: true,
      user: { select: { fullName: true } },
    },
  });

  // Determine which reviewers have a confirmed/completed booking with this target
  // (same hospital, or same doctor — whichever this review set is about).
  const reviewerIds = [...new Set(raw.map((r) => r.userId))];
  const bookedRows = reviewerIds.length > 0
    ? await db.booking.findMany({
        where: { ...reviewWhere, userId: { in: reviewerIds }, status: { in: ["CONFIRMED", "COMPLETED"] } },
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

  // Whether the current user is allowed to write a review for this target.
  // Doctors: must have a COMPLETED appointment. Hospitals: any signed-in user (unchanged).
  let canReview = false;
  if (dbUserId) {
    if (doctorId) {
      canReview = (await db.booking.count({
        where: { userId: dbUserId, doctorId, status: "COMPLETED" },
      })) > 0;
    } else {
      canReview = true;
    }
  }

  return NextResponse.json({ reviews, average: avg, count: reviews.length, canReview });
}

// POST /api/reviews — any signed-in user. Target a hospital (hospitalId) or a doctor (doctorId).
export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Sign in to leave a review" }, { status: 401 });

  let body: { hospitalId?: string; doctorId?: string; rating?: number; comment?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { hospitalId, doctorId, rating, comment } = body;

  if ((!hospitalId && !doctorId) || typeof rating !== "number" || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "hospitalId or doctorId, and rating (1–5), are required" }, { status: 400 });
  }

  const dbUser = await ensureClerkUserInDb(clerkId);
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Validate whichever target was supplied; the review is scoped to that target.
  if (doctorId) {
    const doctor = await db.doctor.findUnique({ where: { id: doctorId }, select: { id: true } });
    if (!doctor) return NextResponse.json({ error: "Doctor not found" }, { status: 404 });

    // Doctor reviews are gated: only patients who have COMPLETED an appointment
    // with this doctor may review them. (Hospital reviews are intentionally not gated.)
    const completedVisits = await db.booking.count({
      where: { userId: dbUser.id, doctorId, status: "COMPLETED" },
    });
    if (completedVisits === 0) {
      return NextResponse.json(
        { error: "You can review this doctor only after a completed appointment." },
        { status: 403 },
      );
    }
  } else {
    const hospital = await db.hospital.findUnique({ where: { id: hospitalId }, select: { id: true } });
    if (!hospital) return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
  }

  const targetWhere = doctorId ? { doctorId } : { hospitalId: hospitalId! };
  const targetLabel = doctorId ? "doctor" : "hospital";

  // Max 3 reviews per user per target
  const reviewCount = await db.review.count({ where: { userId: dbUser.id, ...targetWhere } });
  if (reviewCount >= 3) return NextResponse.json({ error: `You can leave up to 3 reviews per ${targetLabel}` }, { status: 409 });

  const review = await db.review.create({
    data: {
      userId: dbUser.id,
      hospitalId: hospitalId ?? null,
      doctorId: doctorId ?? null,
      rating,
      comment: comment?.trim() || null,
    },
    select: {
      id: true, rating: true, comment: true, createdAt: true,
      user: { select: { fullName: true } },
    },
  });

  const hasBooking = await db.booking.count({
    where: { userId: dbUser.id, ...targetWhere, status: { in: ["CONFIRMED", "COMPLETED"] } },
  }) > 0;

  return NextResponse.json({ ...review, isOwn: true, isVerifiedPatient: hasBooking }, { status: 201 });
}
