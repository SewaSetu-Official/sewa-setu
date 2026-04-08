import { NextResponse } from "next/server";
import { requirePlatformAdmin, writeAuditLog } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  let actor;
  try { actor = await requirePlatformAdmin({ apiMode: true }); }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
  void actor;

  const { searchParams } = new URL(req.url);
  const search    = searchParams.get("search") ?? "";
  const filter    = searchParams.get("filter") ?? "all"; // all | pending | banned
  const page      = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize  = 20;

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  if (filter === "pending") {
    where.memberships = { some: { status: "PENDING" } };
  }
  if (filter === "banned") {
    where.bannedAt = { not: null };
  }

  const [total, users] = await Promise.all([
    db.user.count({ where: where as never }),
    db.user.findMany({
      where: where as never,
      include: {
        memberships: {
          include: { hospital: { select: { name: true, slug: true } } },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { bookings: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone ?? null,
      role: u.role,
      bannedAt: u.bannedAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      bookingCount: u._count.bookings,
      memberships: u.memberships.map((m) => ({
        id: m.id,
        role: m.role,
        status: m.status,
        hospitalName: m.hospital.name,
        hospitalSlug: m.hospital.slug,
      })),
    })),
    total,
    page,
    hasMore: page * pageSize < total,
  });
}

// PATCH — approve/reject membership, ban/unban user
export async function PATCH(req: Request) {
  let actor;
  try { actor = await requirePlatformAdmin({ apiMode: true }); }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  let body: {
    action?: string;
    userId?: string;
    membershipId?: string;
    rejectedReason?: string;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, userId, membershipId, rejectedReason } = body;

  if (action === "APPROVE_MEMBERSHIP" || action === "REJECT_MEMBERSHIP") {
    if (!membershipId) return NextResponse.json({ error: "membershipId required" }, { status: 400 });
    const m = await db.hospitalMembership.findUnique({ where: { id: membershipId } });
    if (!m) return NextResponse.json({ error: "Membership not found" }, { status: 404 });

    const updated = await db.hospitalMembership.update({
      where: { id: membershipId },
      data: {
        status: action === "APPROVE_MEMBERSHIP" ? "APPROVED" : "REJECTED",
        rejectedReason: action === "REJECT_MEMBERSHIP" ? (rejectedReason?.trim() ?? null) : null,
      },
    });

    await writeAuditLog({
      actorUserId: actor.id,
      action,
      entity: "HospitalMembership",
      entityId: membershipId,
      before: { status: m.status },
      after: { status: updated.status },
    });

    return NextResponse.json({ success: true });
  }

  if (action === "BAN_USER" || action === "UNBAN_USER") {
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    await db.user.update({
      where: { id: userId },
      data: { bannedAt: action === "BAN_USER" ? new Date() : null },
    });

    await writeAuditLog({
      actorUserId: actor.id,
      action,
      entity: "User",
      entityId: userId,
      before: { bannedAt: user.bannedAt },
      after: { bannedAt: action === "BAN_USER" ? new Date() : null },
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
