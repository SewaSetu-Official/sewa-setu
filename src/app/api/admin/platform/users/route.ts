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
        supportAssignments: {
          where: { isActive: true },
          include: { hospital: { select: { id: true, name: true, slug: true } } },
          orderBy: { createdAt: "asc" },
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
      supportAssignments: u.supportAssignments.map((assignment) => ({
        id: assignment.id,
        hospitalId: assignment.hospital.id,
        hospitalName: assignment.hospital.name,
        hospitalSlug: assignment.hospital.slug,
      })),
    })),
    total,
    page,
    hasMore: page * pageSize < total,
    supportAssignableHospitals: await db.hospital.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    currentUserId: actor.id,
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
    hospitalId?: string;
    assignmentId?: string;
    role?: string;
    rejectedReason?: string;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, userId, membershipId, hospitalId, assignmentId, role, rejectedReason } = body;

  if (action === "APPROVE_MEMBERSHIP" || action === "REJECT_MEMBERSHIP") {
    if (!membershipId) return NextResponse.json({ error: "membershipId required" }, { status: 400 });
    const m = await db.hospitalMembership.findUnique({ where: { id: membershipId } });
    if (!m) return NextResponse.json({ error: "Membership not found" }, { status: 404 });

    const updated = await db.hospitalMembership.update({
      where: { id: membershipId },
      data: {
        status: action === "APPROVE_MEMBERSHIP" ? "APPROVED" : "REJECTED",
        approvedAt: action === "APPROVE_MEMBERSHIP" ? new Date() : null,
        approvedById: action === "APPROVE_MEMBERSHIP" ? actor.id : null,
        rejectedAt: action === "REJECT_MEMBERSHIP" ? new Date() : null,
        rejectedById: action === "REJECT_MEMBERSHIP" ? actor.id : null,
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
    if (user.id === actor.id) {
      return NextResponse.json({ error: "You cannot ban your own account" }, { status: 400 });
    }
    if (user.role === "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "Platform admins must be demoted before they can be banned" }, { status: 400 });
    }

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

  if (action === "UPDATE_PLATFORM_ROLE") {
    if (!userId || !role) {
      return NextResponse.json({ error: "userId and role required" }, { status: 400 });
    }
    if (!["USER", "PLATFORM_SUPPORT", "PLATFORM_ADMIN"].includes(role)) {
      return NextResponse.json({ error: "Invalid platform role" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (user.role === "PLATFORM_ADMIN" && role !== "PLATFORM_ADMIN") {
      const adminCount = await db.user.count({ where: { role: "PLATFORM_ADMIN", bannedAt: null } });
      if (adminCount <= 1) {
        return NextResponse.json({ error: "At least one active platform admin must remain" }, { status: 400 });
      }
    }

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id: userId },
        data: { role: role as "USER" | "PLATFORM_SUPPORT" | "PLATFORM_ADMIN" },
      });

      if (role !== "PLATFORM_SUPPORT") {
        await tx.supportAssignment.updateMany({
          where: { supportUserId: userId, isActive: true },
          data: { isActive: false },
        });
      }

      return result;
    });

    await writeAuditLog({
      actorUserId: actor.id,
      action: "PLATFORM_ROLE_CHANGED",
      entity: "User",
      entityId: userId,
      before: { role: user.role },
      after: { role: updated.role },
    });

    return NextResponse.json({ success: true });
  }

  if (action === "ASSIGN_SUPPORT") {
    if (!userId || !hospitalId) {
      return NextResponse.json({ error: "userId and hospitalId required" }, { status: 400 });
    }

    const [user, hospital] = await Promise.all([
      db.user.findUnique({ where: { id: userId } }),
      db.hospital.findUnique({ where: { id: hospitalId } }),
    ]);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (!hospital) return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
    if (user.role !== "PLATFORM_SUPPORT") {
      return NextResponse.json({ error: "Only platform support users can be assigned to hospitals" }, { status: 400 });
    }

    const assignment = await db.supportAssignment.upsert({
      where: { supportUserId_hospitalId: { supportUserId: userId, hospitalId } },
      update: { isActive: true, assignedById: actor.id },
      create: { supportUserId: userId, hospitalId, assignedById: actor.id },
    });

    await writeAuditLog({
      actorUserId: actor.id,
      hospitalId,
      action: "SUPPORT_ASSIGNED",
      entity: "SupportAssignment",
      entityId: assignment.id,
      after: {
        supportUserId: userId,
        supportUser: user.fullName,
        supportEmail: user.email,
        hospitalId,
        hospital: hospital.name,
      },
    });

    return NextResponse.json({ success: true });
  }

  if (action === "UNASSIGN_SUPPORT") {
    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId required" }, { status: 400 });
    }

    const assignment = await db.supportAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        supportUser: { select: { fullName: true, email: true } },
        hospital: { select: { name: true } },
      },
    });
    if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

    await db.supportAssignment.update({
      where: { id: assignmentId },
      data: { isActive: false },
    });

    await writeAuditLog({
      actorUserId: actor.id,
      hospitalId: assignment.hospitalId,
      action: "SUPPORT_UNASSIGNED",
      entity: "SupportAssignment",
      entityId: assignment.id,
      before: {
        supportUserId: assignment.supportUserId,
        supportUser: assignment.supportUser.fullName,
        supportEmail: assignment.supportUser.email,
        hospitalId: assignment.hospitalId,
        hospital: assignment.hospital.name,
      },
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
