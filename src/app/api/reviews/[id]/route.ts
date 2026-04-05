import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// PATCH /api/reviews/:id — edit own review
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await db.user.findUnique({ where: { clerkId }, select: { id: true } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const review = await db.review.findUnique({ where: { id }, select: { userId: true } });
  if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });
  if (review.userId !== dbUser.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { rating?: number; comment?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { rating, comment } = body;
  if (rating !== undefined && (typeof rating !== "number" || rating < 1 || rating > 5)) {
    return NextResponse.json({ error: "Rating must be 1–5" }, { status: 400 });
  }

  const updated = await db.review.update({
    where: { id },
    data: {
      ...(rating !== undefined && { rating }),
      ...(comment !== undefined && { comment: comment.trim() || null }),
    },
    select: {
      id: true, rating: true, comment: true, createdAt: true,
      user: { select: { fullName: true } },
    },
  });

  return NextResponse.json({ ...updated, isOwn: true });
}

// DELETE /api/reviews/:id — delete own review
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await db.user.findUnique({ where: { clerkId }, select: { id: true } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const review = await db.review.findUnique({ where: { id }, select: { userId: true } });
  if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });
  if (review.userId !== dbUser.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.review.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
