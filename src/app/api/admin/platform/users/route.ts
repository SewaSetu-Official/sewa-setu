import { NextResponse } from "next/server";
import type { Prisma, HospitalRole } from "@prisma/client";
import { requirePlatformAdmin, writeAuditLog } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { apiError, ApiError } from "@/lib/api-errors";
import { parseBody, z } from "@/lib/api-validation";

export const dynamic = "force-dynamic";

const usersPatchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.enum(["APPROVE_MEMBERSHIP", "REJECT_MEMBERSHIP"]),
    membershipId: z.string().min(1, "membershipId required"),
    rejectedReason: z.string().optional(),
  }),
  z.object({
    action: z.enum(["BAN_USER", "UNBAN_USER"]),
    userId: z.string().min(1, "userId required"),
  }),
  z.object({
    action: z.literal("UPDATE_PLATFORM_ROLE"),
    userId: z.string().min(1, "userId required"),
    role: z.enum(["USER", "PLATFORM_SUPPORT", "PLATFORM_ADMIN"]),
  }),
  z.object({
    action: z.literal("ASSIGN_SUPPORT"),
    userId: z.string().min(1, "userId required"),
    hospitalId: z.string().min(1, "hospitalId required"),
  }),
  z.object({
    action: z.literal("UNASSIGN_SUPPORT"),
    assignmentId: z.string().min(1, "assignmentId required"),
  }),
]);

export async function GET(req: Request) {
  let actor;
  try { actor = await requirePlatformAdmin({ apiMode: true }); }
  catch (e: unknown) { return apiError(e); }

  const { searchParams } = new URL(req.url);
  const search       = searchParams.get("search") ?? "";
  const filter       = searchParams.get("filter") ?? "all"; // all | pending | banned
  const userType     = searchParams.get("userType") ?? "all"; // all | standard | platform | hospital
  const platformRole = searchParams.get("platformRole") ?? ""; // PLATFORM_ADMIN | PLATFORM_SUPPORT
  const hospitalRole = searchParams.get("hospitalRole") ?? ""; // OWNER | MANAGER | RECEPTIONIST | DOCTOR | STAFF
  const hospitalId   = searchParams.get("hospitalId") ?? "";   // filter hospital members by a specific hospital
  const sort         = searchParams.get("sort") ?? "newest";
  const page         = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize     = 20;

  const searchWhere: Prisma.UserWhereInput = {};
  if (search) {
    searchWhere.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  const accessWhere: Prisma.UserWhereInput = {};
  if (filter === "pending") {
    accessWhere.memberships = { some: { status: "PENDING" } };
  }
  if (filter === "banned") {
    accessWhere.bannedAt = { not: null };
  }

  const HOSPITAL_ROLES: HospitalRole[] = ["OWNER", "MANAGER", "RECEPTIONIST", "DOCTOR", "STAFF"];
  // Tab definitions: Normal users (no hospital ties, not platform staff),
  // Platform team (admin or support), Hospital members (any membership role).
  const standardWhere: Prisma.UserWhereInput = { AND: [{ role: "USER" }, { memberships: { none: {} } }] };
  const platformWhere: Prisma.UserWhereInput = { role: { in: ["PLATFORM_ADMIN", "PLATFORM_SUPPORT"] } };
  const hospitalWhere: Prisma.UserWhereInput = { memberships: { some: {} } };

  const roleWhere: Prisma.UserWhereInput = {};
  if (userType === "standard") {
    Object.assign(roleWhere, standardWhere);
  } else if (userType === "platform" || userType === "platform_admin" || userType === "platform_support") {
    // Legacy values (platform_admin / platform_support) still resolve to a sub-filter.
    const sub =
      userType === "platform_admin" ? "PLATFORM_ADMIN"
      : userType === "platform_support" ? "PLATFORM_SUPPORT"
      : platformRole;
    if (sub === "PLATFORM_ADMIN" || sub === "PLATFORM_SUPPORT") roleWhere.role = sub;
    else Object.assign(roleWhere, platformWhere);
  } else if (userType === "hospital" || userType === "hospital_admin") {
    // A user matches when they hold a single membership that satisfies BOTH the
    // role and hospital filters (when set). Empty `some: {}` = any membership.
    const some: Prisma.HospitalMembershipWhereInput = {};
    if ((HOSPITAL_ROLES as string[]).includes(hospitalRole)) some.role = hospitalRole as HospitalRole;
    if (hospitalId) some.hospitalId = hospitalId;
    roleWhere.memberships = { some };
  }

  const compactWhere = (...parts: Prisma.UserWhereInput[]): Prisma.UserWhereInput => {
    const active = parts.filter((part) => Object.keys(part).length > 0);
    if (active.length === 0) return {};
    if (active.length === 1) return active[0];
    return { AND: active };
  };

  const where = compactWhere(searchWhere, accessWhere, roleWhere);
  const accessCountBase = compactWhere(searchWhere, roleWhere);
  const roleCountBase = compactWhere(searchWhere, accessWhere);
  const orderBy: Prisma.UserOrderByWithRelationInput[] =
    sort === "oldest" ? [{ createdAt: "asc" }]
    : sort === "name_asc" ? [{ fullName: "asc" }]
    : sort === "name_desc" ? [{ fullName: "desc" }]
    : sort === "role" ? [{ role: "asc" }, { fullName: "asc" }]
    : sort === "bookings_desc" ? [{ bookings: { _count: "desc" } }, { fullName: "asc" }]
    : [{ createdAt: "desc" }];

  const [total, counts, roleCounts, users, supportAssignableHospitals] = await Promise.all([
    db.user.count({ where }),
    Promise.all([
      db.user.count({ where: accessCountBase }),
      db.user.count({ where: compactWhere(accessCountBase, { memberships: { some: { status: "PENDING" } } }) }),
      db.user.count({ where: compactWhere(accessCountBase, { bannedAt: { not: null } }) }),
    ]),
    Promise.all([
      db.user.count({ where: roleCountBase }),                                   // all
      db.user.count({ where: compactWhere(roleCountBase, standardWhere) }),      // normal users
      db.user.count({ where: compactWhere(roleCountBase, platformWhere) }),      // platform team
      db.user.count({ where: compactWhere(roleCountBase, hospitalWhere) }),      // hospital members
    ]),
    db.user.findMany({
      where,
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
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.hospital.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
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
    counts: {
      all: counts[0],
      pending: counts[1],
      banned: counts[2],
    },
    tabCounts: {
      all: roleCounts[0],
      standard: roleCounts[1],
      platform: roleCounts[2],
      hospital: roleCounts[3],
    },
    page,
    hasMore: page * pageSize < total,
    supportAssignableHospitals,
    currentUserId: actor.id,
  });
}

// PATCH — approve/reject membership, ban/unban user, change platform role,
// assign/unassign support. Each mutation + its audit entry run in one
// transaction so the log can never drift from the change it records.
export async function PATCH(req: Request) {
  try {
    const actor = await requirePlatformAdmin({ apiMode: true });
    const data = await parseBody(req, usersPatchSchema);

    if (data.action === "APPROVE_MEMBERSHIP" || data.action === "REJECT_MEMBERSHIP") {
      const isApprove = data.action === "APPROVE_MEMBERSHIP";
      const m = await db.hospitalMembership.findUnique({ where: { id: data.membershipId } });
      if (!m) throw new ApiError("Membership not found", 404);

      await db.$transaction(async (tx) => {
        const updated = await tx.hospitalMembership.update({
          where: { id: data.membershipId },
          data: {
            status: isApprove ? "APPROVED" : "REJECTED",
            approvedAt: isApprove ? new Date() : null,
            approvedById: isApprove ? actor.id : null,
            rejectedAt: isApprove ? null : new Date(),
            rejectedById: isApprove ? null : actor.id,
            rejectedReason: isApprove ? null : (data.rejectedReason?.trim() ?? null),
          },
        });
        await writeAuditLog({
          actorUserId: actor.id,
          action: data.action,
          entity: "HospitalMembership",
          entityId: data.membershipId,
          before: { status: m.status },
          after: { status: updated.status },
        }, tx);
      });

      return NextResponse.json({ success: true });
    }

    if (data.action === "BAN_USER" || data.action === "UNBAN_USER") {
      const isBan = data.action === "BAN_USER";
      const user = await db.user.findUnique({ where: { id: data.userId } });
      if (!user) throw new ApiError("User not found", 404);
      if (user.id === actor.id) {
        throw new ApiError("You cannot ban your own account", 400);
      }
      if (user.role === "PLATFORM_ADMIN") {
        throw new ApiError("Platform admins must be demoted before they can be banned", 400);
      }

      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: data.userId },
          data: { bannedAt: isBan ? new Date() : null },
        });
        await writeAuditLog({
          actorUserId: actor.id,
          action: data.action,
          entity: "User",
          entityId: data.userId,
          before: { bannedAt: user.bannedAt },
          after: { bannedAt: isBan ? new Date() : null },
        }, tx);
      });

      return NextResponse.json({ success: true });
    }

    if (data.action === "UPDATE_PLATFORM_ROLE") {
      const user = await db.user.findUnique({ where: { id: data.userId } });
      if (!user) throw new ApiError("User not found", 404);

      if (user.role === "PLATFORM_ADMIN" && data.role !== "PLATFORM_ADMIN") {
        const adminCount = await db.user.count({ where: { role: "PLATFORM_ADMIN", bannedAt: null } });
        if (adminCount <= 1) {
          throw new ApiError("At least one active platform admin must remain", 400);
        }
      }

      await db.$transaction(async (tx) => {
        const updated = await tx.user.update({
          where: { id: data.userId },
          data: { role: data.role },
        });

        if (data.role !== "PLATFORM_SUPPORT") {
          await tx.supportAssignment.updateMany({
            where: { supportUserId: data.userId, isActive: true },
            data: { isActive: false },
          });
        }

        await writeAuditLog({
          actorUserId: actor.id,
          action: "PLATFORM_ROLE_CHANGED",
          entity: "User",
          entityId: data.userId,
          before: { role: user.role },
          after: { role: updated.role },
        }, tx);
      });

      return NextResponse.json({ success: true });
    }

    if (data.action === "ASSIGN_SUPPORT") {
      const [user, hospital] = await Promise.all([
        db.user.findUnique({ where: { id: data.userId } }),
        db.hospital.findUnique({ where: { id: data.hospitalId } }),
      ]);
      if (!user) throw new ApiError("User not found", 404);
      if (!hospital) throw new ApiError("Hospital not found", 404);
      if (user.role !== "PLATFORM_SUPPORT") {
        throw new ApiError("Only platform support users can be assigned to hospitals", 400);
      }

      await db.$transaction(async (tx) => {
        const assignment = await tx.supportAssignment.upsert({
          where: { supportUserId_hospitalId: { supportUserId: data.userId, hospitalId: data.hospitalId } },
          update: { isActive: true, assignedById: actor.id },
          create: { supportUserId: data.userId, hospitalId: data.hospitalId, assignedById: actor.id },
        });
        await writeAuditLog({
          actorUserId: actor.id,
          hospitalId: data.hospitalId,
          action: "SUPPORT_ASSIGNED",
          entity: "SupportAssignment",
          entityId: assignment.id,
          after: {
            supportUserId: data.userId,
            supportUser: user.fullName,
            supportEmail: user.email,
            hospitalId: data.hospitalId,
            hospital: hospital.name,
          },
        }, tx);
      });

      return NextResponse.json({ success: true });
    }

    if (data.action === "UNASSIGN_SUPPORT") {
      const assignment = await db.supportAssignment.findUnique({
        where: { id: data.assignmentId },
        include: {
          supportUser: { select: { fullName: true, email: true } },
          hospital: { select: { name: true } },
        },
      });
      if (!assignment) throw new ApiError("Assignment not found", 404);

      await db.$transaction(async (tx) => {
        await tx.supportAssignment.update({
          where: { id: data.assignmentId },
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
        }, tx);
      });

      return NextResponse.json({ success: true });
    }

    throw new ApiError("Invalid action", 400);
  } catch (e: unknown) {
    return apiError(e);
  }
}
