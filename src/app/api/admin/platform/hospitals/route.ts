import { NextResponse } from "next/server";
import { requirePlatformAdmin, requirePlatformStaff, writeAuditLog } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { apiError, ApiError } from "@/lib/api-errors";
import { parseBody, z } from "@/lib/api-validation";

export const dynamic = "force-dynamic";

const hospitalsPatchSchema = z.object({
  hospitalId: z.string().min(1, "hospitalId required"),
  verified: z.boolean().optional(),
  isActive: z.boolean().optional(),
  suspensionReason: z.string().optional(),
  ownerMembershipId: z.string().optional(),
  ownerStatus: z.enum(["APPROVED", "REJECTED"]).optional(),
  rejectedReason: z.string().optional(),
});

export async function GET(req: Request) {
  let ctx;
  try { ctx = await requirePlatformStaff({ apiMode: true }); }
  catch (e: unknown) { return apiError(e); }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = 20;

  const where = {
    ...(ctx.isAdmin ? {} : { id: { in: ctx.assignedHospitalIds } }),
    ...(search
      ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { slug: { contains: search, mode: "insensitive" as const } }] }
      : {}),
  };

  const [total, hospitals] = await Promise.all([
    db.hospital.count({ where }),
    db.hospital.findMany({
      where,
      include: {
        location: { select: { city: true, district: true } },
        _count: { select: { bookings: true, doctors: true, memberships: true } },
        memberships: {
          where: { role: "OWNER", status: { in: ["PENDING", "APPROVED"] } },
          include: { user: { select: { fullName: true, email: true } } },
          orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        },
        supportAssignments: {
          where: { isActive: true },
          select: {
            id: true,
            supportUser: { select: { id: true, fullName: true, email: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    hospitals: hospitals.map((h) => ({
      id: h.id,
      name: h.name,
      slug: h.slug,
      type: h.type,
      verified: h.verified,
      verifiedAt: h.verifiedAt?.toISOString() ?? null,
      isActive: h.isActive,
      suspendedAt: h.suspendedAt?.toISOString() ?? null,
      suspensionReason: h.suspensionReason,
      location: h.location ? `${h.location.city}, ${h.location.district}` : null,
      bookingCount: h._count.bookings,
      doctorCount: h._count.doctors,
      staffCount: h._count.memberships,
      supportAssignments: h.supportAssignments.map((assignment) => ({
        id: assignment.id,
        userId: assignment.supportUser.id,
        fullName: assignment.supportUser.fullName,
        email: assignment.supportUser.email,
      })),
      owners: h.memberships.filter((member) => member.status === "APPROVED").map((member) => ({
        id: member.id,
        userId: member.userId,
        fullName: member.user.fullName,
        email: member.user.email,
        status: member.status,
        createdAt: member.createdAt.toISOString(),
      })),
      pendingOwnerRequests: h.memberships.filter((member) => member.status === "PENDING").map((member) => ({
        id: member.id,
        userId: member.userId,
        fullName: member.user.fullName,
        email: member.user.email,
        status: member.status,
        createdAt: member.createdAt.toISOString(),
      })),
      readiness: getReadiness(h),
    })),
    total,
    page,
    hasMore: page * pageSize < total,
    canManage: ctx.isAdmin,
    scope: ctx.isAdmin ? "platform" : "assigned",
  });
}

function getReadiness(hospital: {
  phone: string | null;
  email: string | null;
  website: string | null;
  servicesSummary: string | null;
  verified: boolean;
  location: unknown;
  memberships: { status: string }[];
}) {
  const items = [
    { label: "Phone", complete: Boolean(hospital.phone) },
    { label: "Email", complete: Boolean(hospital.email) },
    { label: "Website", complete: Boolean(hospital.website) },
    { label: "Services", complete: Boolean(hospital.servicesSummary) },
    { label: "Location", complete: Boolean(hospital.location) },
    { label: "Verified", complete: hospital.verified },
    { label: "Owner", complete: hospital.memberships.some((member) => member.status === "APPROVED") },
  ];

  return {
    completed: items.filter((item) => item.complete).length,
    total: items.length,
    items,
  };
}

// PATCH - verify, suspend, or reactivate hospital, or decide an owner request.
// The mutation and its audit entry share one transaction.
export async function PATCH(req: Request) {
  try {
    const actor = await requirePlatformAdmin({ apiMode: true });
    const body = await parseBody(req, hospitalsPatchSchema);
    const { hospitalId, verified, isActive, suspensionReason, ownerMembershipId, ownerStatus, rejectedReason } = body;

    if (verified === undefined && isActive === undefined && !ownerMembershipId) {
      throw new ApiError("verified, isActive, or ownerMembershipId required", 400);
    }

    const existing = await db.hospital.findUnique({ where: { id: hospitalId } });
    if (!existing) throw new ApiError("Not found", 404);

    if (ownerMembershipId) {
      if (ownerStatus !== "APPROVED" && ownerStatus !== "REJECTED") {
        throw new ApiError("ownerStatus must be APPROVED or REJECTED", 400);
      }

      const membership = await db.hospitalMembership.findFirst({
        where: { id: ownerMembershipId, hospitalId, role: "OWNER" },
        include: { user: { select: { fullName: true, email: true } } },
      });
      if (!membership) throw new ApiError("Owner request not found", 404);

      const updatedMembership = await db.$transaction(async (tx) => {
        const result = await tx.hospitalMembership.update({
          where: { id: membership.id },
          data: ownerStatus === "APPROVED"
            ? {
                status: "APPROVED",
                approvedAt: new Date(),
                approvedById: actor.id,
                rejectedAt: null,
                rejectedById: null,
                rejectedReason: null,
              }
            : {
                status: "REJECTED",
                rejectedAt: new Date(),
                rejectedById: actor.id,
                rejectedReason: rejectedReason?.trim() || "Rejected by platform admin",
                approvedAt: null,
                approvedById: null,
              },
        });

        await writeAuditLog({
          actorUserId: actor.id,
          hospitalId,
          action: ownerStatus === "APPROVED" ? "OWNER_REQUEST_APPROVED" : "OWNER_REQUEST_REJECTED",
          entity: "HospitalMembership",
          entityId: membership.id,
          before: { status: membership.status, role: membership.role },
          after: {
            status: result.status,
            role: result.role,
            userEmail: membership.user.email,
          },
        }, tx);

        return result;
      });

      return NextResponse.json({
        success: true,
        ownerMembership: {
          id: updatedMembership.id,
          userId: updatedMembership.userId,
          fullName: membership.user.fullName,
          email: membership.user.email,
          status: updatedMembership.status,
          createdAt: updatedMembership.createdAt.toISOString(),
        },
      });
    }

    const updateData: Record<string, unknown> = {};
    const now = new Date();

    if (verified !== undefined) {
      updateData.verified = verified;
      updateData.verifiedAt = verified ? now : null;
      updateData.verifiedById = verified ? actor.id : null;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
      if (isActive) {
        updateData.suspendedAt = null;
        updateData.suspendedById = null;
        updateData.suspensionReason = null;
      } else {
        const reason = suspensionReason?.trim();
        if (!reason) {
          throw new ApiError("Suspension reason required", 400);
        }
        updateData.suspendedAt = now;
        updateData.suspendedById = actor.id;
        updateData.suspensionReason = reason;
      }
    }

    const action = isActive !== undefined
      ? (isActive ? "HOSPITAL_REACTIVATED" : "HOSPITAL_SUSPENDED")
      : (verified ? "HOSPITAL_VERIFIED" : "HOSPITAL_UNVERIFIED");

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.hospital.update({ where: { id: hospitalId }, data: updateData as never });

      await writeAuditLog({
        actorUserId: actor.id,
        hospitalId,
        action,
        entity: "Hospital",
        entityId: hospitalId,
        before: {
          verified: existing.verified,
          verifiedAt: existing.verifiedAt,
          verifiedById: existing.verifiedById,
          isActive: existing.isActive,
          suspendedAt: existing.suspendedAt,
          suspendedById: existing.suspendedById,
          suspensionReason: existing.suspensionReason,
        },
        after: {
          verified: result.verified,
          verifiedAt: result.verifiedAt,
          verifiedById: result.verifiedById,
          isActive: result.isActive,
          suspendedAt: result.suspendedAt,
          suspendedById: result.suspendedById,
          suspensionReason: result.suspensionReason,
        },
      }, tx);

      return result;
    });

    return NextResponse.json({
      success: true,
      hospital: {
        id: updated.id,
        verified: updated.verified,
        verifiedAt: updated.verifiedAt?.toISOString() ?? null,
        isActive: updated.isActive,
        suspendedAt: updated.suspendedAt?.toISOString() ?? null,
        suspensionReason: updated.suspensionReason,
      },
    });
  } catch (e: unknown) {
    return apiError(e);
  }
}
