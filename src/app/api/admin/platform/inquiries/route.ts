import { NextRequest, NextResponse } from "next/server";
import { requirePlatformStaff, writeAuditLog } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { PartnerInquiryStatus } from "@prisma/client";
import { apiError, ApiError } from "@/lib/api-errors";
import { parseBody, z } from "@/lib/api-validation";
import { hasPlatformPermission } from "@/lib/admin-permissions";
import { isPlatformStaff } from "@/lib/admin-roles";

export const dynamic = "force-dynamic";

const inquiriesPatchSchema = z.object({
  id: z.string().min(1, "Missing id"),
  action: z.enum(["UPDATE", "ASSIGN"]).optional(), // default UPDATE
  status: z.string().optional(),
  reviewNotes: z.string().optional(),
  assignedToUserId: z.string().nullable().optional(),
});

function slugifyHospitalName(name: string) {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `hospital-${Date.now()}`;
}

async function createUniqueHospitalSlug(name: string) {
  const base = slugifyHospitalName(name);
  let slug = base;
  let suffix = 2;

  while (await db.hospital.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

// GET /api/admin/platform/inquiries?page=1&search=&status=&assignee=
//     /api/admin/platform/inquiries?timeline=<inquiryId>  → activity feed
export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requirePlatformStaff({ apiMode: true }); }
  catch (e: unknown) { return apiError(e); }

  const { searchParams } = new URL(req.url);

  // ── Timeline mode: one inquiry's activity feed ──
  const timelineId = searchParams.get("timeline");
  if (timelineId) {
    const inquiry = await db.partnerInquiry.findUnique({
      where: { id: timelineId },
      select: { id: true, hospitalId: true },
    });
    if (!inquiry) return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
    if (!ctx.isAdmin && (!inquiry.hospitalId || !ctx.assignedHospitalIds.includes(inquiry.hospitalId))) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    const activities = await db.inquiryActivity.findMany({
      where: { inquiryId: timelineId },
      include: { actor: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({
      activities: activities.map((a) => ({
        id: a.id,
        type: a.type,
        note: a.note,
        fromStatus: a.fromStatus,
        toStatus: a.toStatus,
        actor: a.actor?.fullName ?? "System",
        createdAt: a.createdAt.toISOString(),
      })),
    });
  }

  const page     = Math.max(1, Number(searchParams.get("page") ?? 1));
  const search   = searchParams.get("search")?.trim() ?? "";
  const status   = searchParams.get("status") ?? "all";
  const assignee = searchParams.get("assignee") ?? ""; // "" | unassigned | me | <userId>
  const PAGE_SIZE = 20;

  const assigneeWhere =
    assignee === "unassigned" ? { assignedToUserId: null }
    : assignee === "me"       ? { assignedToUserId: ctx.user.id }
    : assignee                ? { assignedToUserId: assignee }
    : {};

  // Scope + search + assignee, WITHOUT the status filter — for the funnel counts.
  const baseWhere = {
    ...(ctx.isAdmin ? {} : { hospitalId: { in: ctx.assignedHospitalIds } }),
    ...assigneeWhere,
    ...(search ? {
      OR: [
        { hospitalName: { contains: search, mode: "insensitive" as const } },
        { contactName:  { contains: search, mode: "insensitive" as const } },
        { email:        { contains: search, mode: "insensitive" as const } },
        { city:         { contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
  };
  const where = {
    ...baseWhere,
    ...(status !== "all" ? { status: status as PartnerInquiryStatus } : {}),
  };

  const [total, inquiries, grouped, assignees] = await Promise.all([
    db.partnerInquiry.count({ where }),
    db.partnerInquiry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { assignedTo: { select: { id: true, fullName: true } } },
    }),
    db.partnerInquiry.groupBy({ by: ["status"], where: baseWhere, _count: { _all: true } }),
    db.user.findMany({
      where: { role: { in: ["PLATFORM_ADMIN", "PLATFORM_SUPPORT"] }, bannedAt: null },
      select: { id: true, fullName: true, role: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  // Dedupe detection: flag an inquiry that shares an email or hospital name with
  // another inquiry, or whose hospital name already exists as a real hospital.
  const pageEmails = inquiries.map((i) => i.email);
  const pageNames  = inquiries.map((i) => i.hospitalName);
  const [dupCandidates, existingHospitals] = await Promise.all([
    db.partnerInquiry.findMany({
      where: { OR: [{ email: { in: pageEmails } }, { hospitalName: { in: pageNames } }] },
      select: { id: true, email: true, hospitalName: true },
    }),
    db.hospital.findMany({ where: { name: { in: pageNames } }, select: { name: true } }),
  ]);
  const emailCount = new Map<string, number>();
  const nameCount  = new Map<string, number>();
  for (const c of dupCandidates) {
    const e = c.email.toLowerCase();
    const n = c.hospitalName.toLowerCase();
    emailCount.set(e, (emailCount.get(e) ?? 0) + 1);
    nameCount.set(n, (nameCount.get(n) ?? 0) + 1);
  }
  const existingNames = new Set(existingHospitals.map((h) => h.name.toLowerCase()));

  const stageCounts: Record<string, number> = { all: 0, NEW: 0, REVIEWED: 0, CONTACTED: 0, ONBOARDED: 0, REJECTED: 0 };
  for (const group of grouped) {
    stageCounts[group.status] = group._count._all;
    stageCounts.all += group._count._all;
  }

  return NextResponse.json({
    inquiries: inquiries.map((i) => ({
      id: i.id,
      hospitalId: i.hospitalId,
      hospitalName: i.hospitalName,
      type: i.type,
      contactName: i.contactName,
      email: i.email,
      phone: i.phone,
      city: i.city,
      message: i.message,
      status: i.status,
      reviewNotes: i.reviewNotes,
      reviewedAt: i.reviewedAt ? i.reviewedAt.toISOString() : null,
      createdAt: i.createdAt.toISOString(),
      assignedTo: i.assignedTo ? { id: i.assignedTo.id, fullName: i.assignedTo.fullName } : null,
      duplicate: (emailCount.get(i.email.toLowerCase()) ?? 0) > 1 || (nameCount.get(i.hospitalName.toLowerCase()) ?? 0) > 1,
      hospitalExists: existingNames.has(i.hospitalName.toLowerCase()),
    })),
    total,
    stageCounts,
    assignees,
    hasMore: page * PAGE_SIZE < total,
    canFinalize: ctx.isAdmin,
    scope: ctx.isAdmin ? "platform" : "assigned",
  });
}

// PATCH /api/admin/platform/inquiries
//   { id, status, reviewNotes? }                      → triage / notes
//   { id, action: "ASSIGN", assignedToUserId|null }   → (un)assign owner
export async function PATCH(req: NextRequest) {
  try {
    const ctx = await requirePlatformStaff({ apiMode: true });
    const data = await parseBody(req, inquiriesPatchSchema);
    const { id } = data;

    const existing = await db.partnerInquiry.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError("Inquiry not found", 404);
    }

    // Support may only act on inquiries linked to a hospital they're assigned to.
    if (!ctx.isAdmin && (!existing.hospitalId || !ctx.assignedHospitalIds.includes(existing.hospitalId))) {
      throw new ApiError("FORBIDDEN", 403);
    }

    // ── Assignment ──
    if (data.action === "ASSIGN") {
      const assigneeId = data.assignedToUserId ?? null;
      if (assigneeId) {
        const assignee = await db.user.findUnique({ where: { id: assigneeId }, select: { role: true } });
        if (!assignee || !isPlatformStaff(assignee.role)) {
          throw new ApiError("Assignee must be a platform admin or support user", 400);
        }
      }
      await db.$transaction(async (tx) => {
        await tx.partnerInquiry.update({ where: { id }, data: { assignedToUserId: assigneeId } });
        await tx.inquiryActivity.create({
          data: {
            inquiryId: id,
            actorUserId: ctx.user.id,
            type: assigneeId ? "ASSIGNED" : "UNASSIGNED",
          },
        });
        await writeAuditLog({
          actorUserId: ctx.user.id,
          hospitalId: existing.hospitalId ?? undefined,
          action: assigneeId ? "INQUIRY_ASSIGNED" : "INQUIRY_UNASSIGNED",
          entity: "PartnerInquiry",
          entityId: id,
          before: { assignedToUserId: existing.assignedToUserId },
          after: { assignedToUserId: assigneeId },
        }, tx);
      });
      return NextResponse.json({ success: true });
    }

    // ── Status / notes update ──
    if (!data.status) throw new ApiError("Missing status", 400);
    if (!Object.values(PartnerInquiryStatus).includes(data.status as PartnerInquiryStatus)) {
      throw new ApiError("Invalid status", 400);
    }
    const status = data.status as PartnerInquiryStatus;
    const reviewNotes = data.reviewNotes;
    const statusChanged = existing.status !== status;
    const notesChanged = reviewNotes !== undefined && (reviewNotes ?? "").trim() !== (existing.reviewNotes ?? "");

    if (!ctx.isAdmin) {
      const supportAllowedStatuses: PartnerInquiryStatus[] = ["REVIEWED", "CONTACTED"];
      if (statusChanged && !supportAllowedStatuses.includes(status)) {
        throw new ApiError("Support can only mark inquiries reviewed or contacted", 403);
      }
    }

    if (status === "ONBOARDED") {
      if (!hasPlatformPermission(ctx.user.role, "FINALIZE_INQUIRY")) {
        throw new ApiError("Only platform admins can approve onboarding", 403);
      }
      if (existing.status === "REJECTED") {
        throw new ApiError("Rejected inquiries must be reopened before onboarding", 400);
      }

      const slug = existing.hospitalId ? null : await createUniqueHospitalSlug(existing.hospitalName);
      const now = new Date();

      const result = await db.$transaction(async (tx) => {
        const hospital = existing.hospitalId
          ? await tx.hospital.findUnique({ where: { id: existing.hospitalId } })
          : await tx.hospital.create({
            data: {
              slug: slug!,
              name: existing.hospitalName,
              type: existing.type,
              phone: existing.phone,
              email: existing.email,
              verified: true,
              verifiedAt: now,
              verifiedById: ctx.user.id,
              isActive: true,
              location: {
                create: {
                  country: "NP",
                  district: existing.city,
                  city: existing.city,
                },
              },
            },
          });

      if (!hospital) {
        throw new Error("Linked hospital not found");
      }

      const owner = await tx.user.upsert({
        where: { email: existing.email },
        update: {
          fullName: existing.contactName,
          phone: existing.phone,
        },
        create: {
          clerkId: `pending_owner_${existing.id}`,
          fullName: existing.contactName,
          email: existing.email,
          phone: existing.phone,
          country: "NP",
        },
      });

      const membership = await tx.hospitalMembership.upsert({
        where: { userId_hospitalId: { userId: owner.id, hospitalId: hospital.id } },
        update: {
          role: "OWNER",
          status: "APPROVED",
          approvedAt: now,
          approvedById: ctx.user.id,
          rejectedAt: null,
          rejectedById: null,
          rejectedReason: null,
        },
        create: {
          userId: owner.id,
          hospitalId: hospital.id,
          role: "OWNER",
          status: "APPROVED",
          invitedBy: ctx.user.id,
          approvedAt: now,
          approvedById: ctx.user.id,
        },
      });

      const inquiry = await tx.partnerInquiry.update({
        where: { id },
        data: {
          hospitalId: hospital.id,
          status: "ONBOARDED",
          reviewNotes: reviewNotes ?? undefined,
          reviewedAt: now,
        },
      });

      await writeAuditLog({
        actorUserId: ctx.user.id,
        hospitalId: hospital.id,
        action: existing.hospitalId ? "HOSPITAL_LINKED_FROM_INQUIRY" : "HOSPITAL_CREATED_FROM_INQUIRY",
        entity: "Hospital",
        entityId: hospital.id,
        after: { inquiryId: existing.id, name: hospital.name, slug: hospital.slug },
      }, tx);

      await writeAuditLog({
        actorUserId: ctx.user.id,
        hospitalId: hospital.id,
        action: "INITIAL_OWNER_ASSIGNED",
        entity: "HospitalMembership",
        entityId: membership.id,
        after: { userId: owner.id, role: membership.role, status: membership.status },
      }, tx);

      await writeAuditLog({
        actorUserId: ctx.user.id,
        hospitalId: hospital.id,
        action: "INQUIRY_ONBOARDED",
        entity: "PartnerInquiry",
        entityId: inquiry.id,
        before: { status: existing.status, hospitalId: existing.hospitalId, reviewNotes: existing.reviewNotes },
        after: { status: inquiry.status, hospitalId: inquiry.hospitalId, reviewNotes: inquiry.reviewNotes },
      }, tx);

      await tx.inquiryActivity.create({
        data: {
          inquiryId: id,
          actorUserId: ctx.user.id,
          type: "STATUS_CHANGED",
          fromStatus: existing.status,
          toStatus: "ONBOARDED",
        },
      });

      return inquiry;
    });

    return NextResponse.json(result);
  }

  const updated = await db.$transaction(async (tx) => {
    const inquiry = await tx.partnerInquiry.update({
      where: { id },
      data: {
        status,
        reviewNotes: reviewNotes ?? undefined,
        reviewedAt: new Date(),
      },
    });

    await writeAuditLog({
      actorUserId: ctx.user.id,
      hospitalId: inquiry.hospitalId ?? undefined,
      action: existing.status === status ? "INQUIRY_NOTES_UPDATED" : "INQUIRY_TRIAGED",
      entity: "PartnerInquiry",
      entityId: inquiry.id,
      before: { status: existing.status, reviewNotes: existing.reviewNotes },
      after: { status: inquiry.status, reviewNotes: inquiry.reviewNotes },
    }, tx);

    if (statusChanged) {
      await tx.inquiryActivity.create({
        data: {
          inquiryId: id,
          actorUserId: ctx.user.id,
          type: "STATUS_CHANGED",
          fromStatus: existing.status,
          toStatus: status,
        },
      });
    }
    if (notesChanged) {
      await tx.inquiryActivity.create({
        data: {
          inquiryId: id,
          actorUserId: ctx.user.id,
          type: "NOTE_ADDED",
          note: reviewNotes?.trim() || null,
        },
      });
    }

    return inquiry;
  });

  return NextResponse.json(updated);
  } catch (e: unknown) {
    return apiError(e);
  }
}
