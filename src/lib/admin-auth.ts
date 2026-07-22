import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { HospitalRole, UserRole, Prisma } from "@prisma/client";
import { hasPermission, type Permission } from "@/lib/admin-permissions";
import { isPlatformAdmin, isPlatformStaff } from "@/lib/admin-roles";
import { ensureClerkUserInDb } from "@/lib/clerk-user-sync";
export { hasPermission, type Permission } from "@/lib/admin-permissions";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdminUser = {
  id: string;
  clerkId: string;
  fullName: string;
  email: string;
  role: UserRole;
};

export type HospitalAccessContext = {
  user: AdminUser;
  membership: {
    id: string;
    hospitalId: string;
    role: HospitalRole;
  };
};

export type PlatformAccessContext = {
  user: AdminUser;
  isAdmin: boolean;
  assignedHospitalIds: string[];
};


// ─── Platform Admin Guard ─────────────────────────────────────────────────────

/**
 * Use in Server Components and API routes that require platform admin access.
 * Redirects to / on failure (server component) or throws (API route).
 */
export async function requirePlatformAdmin(options?: { apiMode?: boolean }): Promise<AdminUser> {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    if (options?.apiMode) throw new Error("UNAUTHORIZED");
    redirect("/sign-in");
  }

  await ensureClerkUserInDb(clerkId);

  const user = await db.user.findUnique({
    where: { clerkId },
    select: { id: true, clerkId: true, fullName: true, email: true, role: true, bannedAt: true },
  });

  if (!user || user.bannedAt) {
    if (options?.apiMode) throw new Error("UNAUTHORIZED");
    redirect("/");
  }

  if (!isPlatformAdmin(user.role)) {
    if (options?.apiMode) throw new Error("FORBIDDEN");
    redirect("/");
  }

  return user;
}

/**
 * Use for platform routes that may be accessed by either PLATFORM_ADMIN or
 * PLATFORM_SUPPORT. Support users are always scoped to explicit assignments.
 */
export async function requirePlatformStaff(options?: { apiMode?: boolean }): Promise<PlatformAccessContext> {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    if (options?.apiMode) throw new Error("UNAUTHORIZED");
    redirect("/sign-in");
  }

  await ensureClerkUserInDb(clerkId);

  const user = await db.user.findUnique({
    where: { clerkId },
    select: { id: true, clerkId: true, fullName: true, email: true, role: true, bannedAt: true },
  });

  if (!user || user.bannedAt) {
    if (options?.apiMode) throw new Error("UNAUTHORIZED");
    redirect("/");
  }

  if (!isPlatformStaff(user.role)) {
    if (options?.apiMode) throw new Error("FORBIDDEN");
    redirect("/");
  }

  const isAdmin = isPlatformAdmin(user.role);
  const assignments = isAdmin
    ? []
    : await db.supportAssignment.findMany({
        where: { supportUserId: user.id, isActive: true },
        select: { hospitalId: true },
      });

  return {
    user,
    isAdmin,
    assignedHospitalIds: assignments.map((assignment) => assignment.hospitalId),
  };
}

// ─── Hospital Access Guard ────────────────────────────────────────────────────

/**
 * Use in hospital workspace Server Components and API routes.
 * Validates that the current user has an APPROVED membership for the given hospital.
 * Optionally checks a specific permission.
 */
export async function requireHospitalAccess(
  hospitalSlug: string,
  permission?: Permission,
  options?: { apiMode?: boolean }
): Promise<HospitalAccessContext> {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    if (options?.apiMode) throw new Error("UNAUTHORIZED");
    redirect("/sign-in");
  }

  await ensureClerkUserInDb(clerkId);

  const user = await db.user.findUnique({
    where: { clerkId },
    select: { id: true, clerkId: true, fullName: true, email: true, role: true, bannedAt: true },
  });

  if (!user || user.bannedAt) {
    if (options?.apiMode) throw new Error("UNAUTHORIZED");
    redirect("/sign-in");
  }

  // Look up hospital membership
  const hospital = await db.hospital.findUnique({
    where: { slug: hospitalSlug },
    select: { id: true },
  });

  if (!hospital) {
    if (options?.apiMode) throw new Error("NOT_FOUND");
    redirect("/admin");
  }

  const membership = await db.hospitalMembership.findUnique({
    where: { userId_hospitalId: { userId: user.id, hospitalId: hospital.id } },
    select: { id: true, hospitalId: true, role: true, status: true },
  });

  if (!membership || membership.status !== "APPROVED") {
    if (options?.apiMode) throw new Error("FORBIDDEN");
    redirect("/admin/request-access");
  }

  // Check specific permission if required
  if (permission && !hasPermission(membership.role, permission)) {
    if (options?.apiMode) throw new Error("FORBIDDEN");
    redirect(`/admin/h/${hospitalSlug}/dashboard`);
  }

  return { user, membership };
}

// ─── General Admin Resolver ───────────────────────────────────────────────────

/**
 * Resolves where a signed-in user should land in the admin area.
 * Used by /admin auto-router.
 */
export async function resolveAdminRedirect(): Promise<string> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return "/sign-in";

  await ensureClerkUserInDb(clerkId);

  const user = await db.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      role: true,
      bannedAt: true,
      memberships: {
        where: { status: "APPROVED" },
        include: { hospital: { select: { slug: true } } },
      },
    },
  });

  if (!user || user.bannedAt) return "/sign-in";

  // Platform staff goes to platform dashboard
  if (isPlatformStaff(user.role)) {
    return "/admin/platform/dashboard";
  }

  const approved = user.memberships.filter((m) => m.status === "APPROVED");

  if (approved.length === 0) {
    // Check if they have a pending request
    const pending = await db.hospitalMembership.findFirst({
      where: { userId: user.id, status: "PENDING" },
    });
    return pending ? "/admin/request-access?status=pending" : "/admin/request-access";
  }

  if (approved.length === 1) {
    return `/admin/h/${approved[0].hospital.slug}/dashboard`;
  }

  // Multiple hospitals — let them pick
  return "/admin/select-hospital";
}

// ─── Audit Log Writer ─────────────────────────────────────────────────────────

/**
 * Write an audit-log entry.
 *
 * Pass a Prisma transaction client as the second argument to make the audit
 * write atomic with the mutation it records — if the surrounding transaction
 * rolls back, so does the log (no orphaned or missing audit entries). When
 * omitted it writes on the default connection (best-effort, back-compatible).
 */
export async function writeAuditLog(
  {
    actorUserId,
    hospitalId,
    action,
    entity,
    entityId,
    before,
    after,
  }: {
    actorUserId: string;
    hospitalId?: string;
    action: string;
    entity: string;
    entityId: string;
    before?: object;
    after?: object;
  },
  client: Prisma.TransactionClient = db,
) {
  await client.auditLog.create({
    data: {
      actorUserId,
      hospitalId: hospitalId ?? null,
      action,
      entity,
      entityId,
      before: before ?? undefined,
      after: after ?? undefined,
    },
  });
}
