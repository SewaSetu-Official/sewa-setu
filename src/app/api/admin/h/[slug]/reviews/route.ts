import { NextResponse } from "next/server";
import { requireHospitalAccess, writeAuditLog } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/admin/h/[slug]/reviews
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let ctx;
  try { ctx = await requireHospitalAccess(slug, "MODERATE_REVIEWS", { apiMode: true }); }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ error: msg }, { status: msg === "FORBIDDEN" ? 403 : 401 });
  }

  const { searchParams } = new URL(req.url);
  const showHidden = searchParams.get("hidden") === "true";
  const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = 20;

  const where = {
    hospitalId: ctx.membership.hospitalId,
    ...(showHidden ? {} : { hidden: false }),
  };

  const [total, reviews] = await Promise.all([
    db.review.count({ where }),
    db.review.findMany({
      where,
      include: {
        user: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment ?? null,
      hidden: r.hidden,
      hiddenAt: r.hiddenAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      user: { fullName: r.user.fullName, email: r.user.email },
    })),
    total,
    page,
    hasMore: page * pageSize < total,
  });
}

// PATCH /api/admin/h/[slug]/reviews — toggle hidden
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let ctx;
  try { ctx = await requireHospitalAccess(slug, "MODERATE_REVIEWS", { apiMode: true }); }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ error: msg }, { status: msg === "FORBIDDEN" ? 403 : 401 });
  }

  let body: { reviewId?: string; hidden?: boolean };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { reviewId, hidden } = body;
  if (!reviewId || hidden === undefined) {
    return NextResponse.json({ error: "reviewId and hidden are required" }, { status: 400 });
  }

  const review = await db.review.findFirst({
    where: { id: reviewId, hospitalId: ctx.membership.hospitalId },
  });
  if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });

  const updated = await db.review.update({
    where: { id: reviewId },
    data: {
      hidden,
      hiddenById: hidden ? ctx.user.id : null,
      hiddenAt: hidden ? new Date() : null,
    },
  });

  await writeAuditLog({
    actorUserId: ctx.user.id,
    hospitalId: ctx.membership.hospitalId,
    action: hidden ? "REVIEW_HIDDEN" : "REVIEW_RESTORED",
    entity: "Review",
    entityId: reviewId,
    before: { hidden: review.hidden },
    after: { hidden: updated.hidden },
  });

  return NextResponse.json({ success: true, hidden: updated.hidden });
}
