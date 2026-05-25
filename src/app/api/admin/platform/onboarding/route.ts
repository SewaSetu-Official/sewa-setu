import { NextRequest, NextResponse } from "next/server";
import {
  HospitalOnboardingStatus,
  HospitalType,
  type Prisma,
} from "@prisma/client";
import { requirePlatformStaff, writeAuditLog } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const DEFAULT_CHECKLIST = [
  "Hospital basic info added",
  "Location verified",
  "Departments added",
  "Doctors added",
  "Schedules configured",
  "Packages configured",
  "Hospital media added",
  "Owner account linked",
  "Hospital confirmation received",
];

function jsonError(error: unknown) {
  const message = error instanceof Error ? error.message : "UNAUTHORIZED";
  return NextResponse.json({ error: message }, { status: message === "FORBIDDEN" ? 403 : 401 });
}

function slugifyHospitalName(name: string) {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `hospital-${Date.now()}`;
}

function slugifyValue(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `item-${Date.now()}`;
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

function statusTimestamps(status: HospitalOnboardingStatus) {
  const now = new Date();
  return {
    ...(status === "DATA_RECEIVED" ? { dataReceivedAt: now } : {}),
    ...(status === "DATA_ENTRY_IN_PROGRESS" ? { dataEntryStartedAt: now } : {}),
    ...(status === "READY_TO_PUBLISH" ? { readyToPublishAt: now } : {}),
    ...(status === "WAITING_FOR_HOSPITAL_CONFIRMATION" ? { confirmationSentAt: now } : {}),
    ...(status === "PUBLISHED" ? { publishedAt: now } : {}),
  };
}

async function markChecklist(onboardingId: string, title: string, userId: string) {
  await db.hospitalOnboardingChecklistItem.updateMany({
    where: { onboardingId, title },
    data: { isCompleted: true, completedAt: new Date(), completedById: userId },
  });
}

function queueAuditLog(entry: Parameters<typeof writeAuditLog>[0]) {
  void writeAuditLog(entry).catch((error) => {
    console.warn("Failed to write onboarding audit log", error);
  });
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  return hour * 60 + minute;
}

async function canAccessOnboarding(
  ctx: { isAdmin: boolean; user: { id: string }; assignedHospitalIds: string[] },
  onboardingId: string,
) {
  const onboarding = await db.hospitalOnboarding.findUnique({
    where: { id: onboardingId },
    select: { id: true, hospitalId: true, assignedToUserId: true },
  });

  if (!onboarding) return null;
  if (ctx.isAdmin) return onboarding;
  if (onboarding.assignedToUserId === ctx.user.id) return onboarding;
  if (onboarding.hospitalId && ctx.assignedHospitalIds.includes(onboarding.hospitalId)) return onboarding;
  return null;
}

// GET /api/admin/platform/onboarding
export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requirePlatformStaff({ apiMode: true }); }
  catch (error: unknown) { return jsonError(error); }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const status = searchParams.get("status") ?? "all";
  const search = searchParams.get("search")?.trim() ?? "";
  const PAGE_SIZE = 20;

  const accessFilter: Prisma.HospitalOnboardingWhereInput = ctx.isAdmin
    ? {}
    : {
        OR: [
          { assignedToUserId: ctx.user.id },
          ...(ctx.assignedHospitalIds.length ? [{ hospitalId: { in: ctx.assignedHospitalIds } }] : []),
        ],
      };
  const statusFilter: Prisma.HospitalOnboardingWhereInput =
    status !== "all" ? { status: status as HospitalOnboardingStatus } : {};
  const searchFilter: Prisma.HospitalOnboardingWhereInput = search
    ? {
        OR: [
          { hospital: { name: { contains: search, mode: "insensitive" } } },
          { partnerInquiry: { hospitalName: { contains: search, mode: "insensitive" } } },
          { partnerInquiry: { contactName: { contains: search, mode: "insensitive" } } },
          { partnerInquiry: { email: { contains: search, mode: "insensitive" } } },
          { partnerInquiry: { city: { contains: search, mode: "insensitive" } } },
        ],
      }
    : {};

  const where: Prisma.HospitalOnboardingWhereInput = {
    AND: [accessFilter, statusFilter, searchFilter].filter((filter) => Object.keys(filter).length > 0),
  };

  const countWhere: Prisma.HospitalOnboardingWhereInput = {
    AND: [accessFilter, searchFilter].filter((filter) => Object.keys(filter).length > 0),
  };

  const [total, onboardings, statusCounts, supportUsers, inquiries] = await Promise.all([
    db.hospitalOnboarding.count({ where }),
    db.hospitalOnboarding.findMany({
      where,
      include: {
        hospital: {
          select: {
            id: true,
            slug: true,
            name: true,
            type: true,
            verified: true,
            isActive: true,
            phone: true,
            email: true,
            website: true,
            openingHours: true,
            emergencyAvailable: true,
            servicesSummary: true,
            location: {
              select: {
                country: true,
                province: true,
                district: true,
                city: true,
                area: true,
                addressLine: true,
                lat: true,
                lng: true,
              },
            },
            departments: {
              where: { isActive: true },
              select: { id: true, name: true, overview: true, sortOrder: true },
              orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            },
            doctors: {
              select: {
                doctor: {
                  select: {
                    id: true,
                    fullName: true,
                    licenseNumber: true,
                    experienceYears: true,
                    feeMin: true,
                    feeMax: true,
                    currency: true,
                    media: {
                      select: { id: true, url: true, altText: true, isPrimary: true },
                      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
                      take: 1,
                    },
                    departments: {
                      where: { isActive: true, department: { isActive: true } },
                      select: { departmentId: true },
                      take: 1,
                    },
                  },
                },
                positionTitle: true,
              },
              orderBy: { doctor: { fullName: "asc" } },
            },
            availabilitySlots: {
              where: { isActive: true },
              select: {
                id: true,
                doctorId: true,
                dayOfWeek: true,
                mode: true,
                startTime: true,
                endTime: true,
                slotDurationMinutes: true,
                doctor: { select: { fullName: true } },
              },
              orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
            },
            packages: {
              where: { isActive: true },
              select: { id: true, title: true, description: true, price: true, currency: true },
              orderBy: { createdAt: "desc" },
              take: 8,
            },
            media: {
              select: { id: true, url: true, altText: true, isPrimary: true },
              orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
              take: 12,
            },
            memberships: {
              where: { role: "OWNER", status: "APPROVED" },
              select: { id: true, user: { select: { id: true, fullName: true, email: true } } },
              orderBy: { createdAt: "asc" },
            },
          },
        },
        partnerInquiry: {
          select: { id: true, hospitalName: true, type: true, contactName: true, email: true, phone: true, city: true, status: true },
        },
        assignedTo: { select: { id: true, fullName: true, email: true, role: true } },
        createdBy: { select: { fullName: true } },
        checklist: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        notes: {
          include: { author: { select: { fullName: true } } },
          orderBy: { createdAt: "desc" },
          take: 3,
        },
        imports: { orderBy: { createdAt: "desc" }, take: 3 },
        _count: { select: { files: true, imports: true, notes: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.hospitalOnboarding.groupBy({ by: ["status"], where: countWhere, _count: { id: true } }),
    ctx.isAdmin
      ? db.user.findMany({
          where: { role: { in: ["PLATFORM_ADMIN", "PLATFORM_SUPPORT"] }, bannedAt: null },
          select: { id: true, fullName: true, email: true, role: true },
          orderBy: [{ role: "asc" }, { fullName: "asc" }],
        })
      : Promise.resolve([]),
    ctx.isAdmin
      ? db.partnerInquiry.findMany({
          where: { onboarding: null, status: { not: "REJECTED" } },
          select: { id: true, hospitalName: true, contactName: true, email: true, city: true, type: true },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    onboardings,
    total,
    page,
    hasMore: page * PAGE_SIZE < total,
    canManage: ctx.isAdmin,
    supportUsers,
    inquiries,
    statusCounts: statusCounts.map((item) => ({ status: item.status, count: item._count.id })),
  });
}

// POST /api/admin/platform/onboarding
export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requirePlatformStaff({ apiMode: true }); }
  catch (error: unknown) { return jsonError(error); }

  if (!ctx.isAdmin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body: {
    source?: "inquiry" | "direct";
    partnerInquiryId?: string;
    hospitalId?: string;
    assignedToUserId?: string;
    internalNotes?: string;
    directContact?: {
      hospitalName?: string;
      type?: HospitalType;
      contactName?: string;
      email?: string;
      phone?: string;
      city?: string;
    };
  } = await req.json();

  const directContact = body.source === "direct" ? body.directContact : undefined;
  const directHospitalName = directContact?.hospitalName?.trim();
  const directContactName = directContact?.contactName?.trim();
  const directEmail = directContact?.email?.trim();
  const directPhone = directContact?.phone?.trim();
  const directCity = directContact?.city?.trim();
  const directType = directContact?.type && ["HOSPITAL", "CLINIC", "LAB"].includes(directContact.type)
    ? directContact.type
    : "HOSPITAL";

  if (body.source === "direct" && (!directHospitalName || !directContactName || !directEmail || !directPhone || !directCity)) {
    return NextResponse.json({ error: "Hospital name, contact, email, phone, and city are required for direct contact setup" }, { status: 400 });
  }

  if (!body.partnerInquiryId && !body.hospitalId && body.source !== "direct") {
    return NextResponse.json({ error: "Select an inquiry or hospital" }, { status: 400 });
  }

  const onboarding = await db.$transaction(async (tx) => {
    let partnerInquiryId = body.partnerInquiryId || null;

    if (body.source === "direct") {
      const inquiry = await tx.partnerInquiry.create({
        data: {
          hospitalName: directHospitalName!,
          type: directType,
          contactName: directContactName!,
          email: directEmail!,
          phone: directPhone!,
          city: directCity!,
          status: "CONTACTED",
          message: body.internalNotes?.trim() || "Direct contact created by platform team.",
        },
      });
      partnerInquiryId = inquiry.id;
    }

    const created = await tx.hospitalOnboarding.create({
      data: {
        partnerInquiryId,
        hospitalId: body.hospitalId || null,
        assignedToUserId: body.assignedToUserId || null,
        createdById: ctx.user.id,
        internalNotes: body.internalNotes?.trim() || null,
        checklist: {
          create: DEFAULT_CHECKLIST.map((title, index) => ({
            title,
            sortOrder: index,
            isRequired: true,
          })),
        },
      },
    });

    if (body.hospitalId) {
      await tx.hospital.update({
        where: { id: body.hospitalId },
        data: { onboardingStatus: "NEW", isActive: false, verified: false },
      });
    }

    return created;
  });

  queueAuditLog({
    actorUserId: ctx.user.id,
    action: "HOSPITAL_ONBOARDING_CREATED",
    entity: "HospitalOnboarding",
    entityId: onboarding.id,
    hospitalId: onboarding.hospitalId ?? undefined,
    after: { source: body.source ?? "inquiry", partnerInquiryId: onboarding.partnerInquiryId, hospitalId: onboarding.hospitalId },
  });

  return NextResponse.json({ success: true, id: onboarding.id }, { status: 201 });
}

// PATCH /api/admin/platform/onboarding
export async function PATCH(req: NextRequest) {
  let ctx;
  try { ctx = await requirePlatformStaff({ apiMode: true }); }
  catch (error: unknown) { return jsonError(error); }

  const body: {
    action?: string;
    onboardingId?: string;
    status?: HospitalOnboardingStatus;
    assignedToUserId?: string | null;
    meetingDate?: string | null;
    meetingNotes?: string | null;
    internalNotes?: string | null;
    hospitalConfirmationNotes?: string | null;
    title?: string;
    body?: string;
    itemId?: string;
    entityId?: string;
    isCompleted?: boolean;
    isRequired?: boolean;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    openingHours?: string | null;
    emergencyAvailable?: boolean;
    servicesSummary?: string | null;
    country?: string | null;
    province?: string | null;
    district?: string | null;
    city?: string | null;
    area?: string | null;
    addressLine?: string | null;
    lat?: number | null;
    lng?: number | null;
    name?: string;
    overview?: string | null;
    sortOrder?: number;
    departmentId?: string | null;
    fullName?: string;
    licenseNumber?: string | null;
    experienceYears?: number | null;
    positionTitle?: string | null;
    feeMin?: number | null;
    feeMax?: number | null;
    currency?: string | null;
    photoUrl?: string | null;
    doctorId?: string;
    dayOfWeek?: number;
    mode?: "ONLINE" | "PHYSICAL";
    startTime?: string;
    endTime?: string;
    slotDurationMinutes?: number;
    description?: string | null;
    price?: number | null;
    ownerEmail?: string | null;
    url?: string | null;
    altText?: string | null;
    isPrimary?: boolean;
  } = await req.json();

  if (!body.action || !body.onboardingId) {
    return NextResponse.json({ error: "action and onboardingId are required" }, { status: 400 });
  }

  const access = await canAccessOnboarding(ctx, body.onboardingId);
  if (!access) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const requireHospital = () => {
    if (!access.hospitalId) {
      throw new Error("Create a hospital shell before adding data");
    }
    return access.hospitalId;
  };

  if (body.action === "UPDATE") {
    const before = await db.hospitalOnboarding.findUnique({ where: { id: body.onboardingId } });
    if (!before) return NextResponse.json({ error: "Hospital setup case not found" }, { status: 404 });

    const nextStatus = body.status && Object.values(HospitalOnboardingStatus).includes(body.status)
      ? body.status
      : undefined;

    const updated = await db.hospitalOnboarding.update({
      where: { id: body.onboardingId },
      data: {
        ...(nextStatus ? { status: nextStatus, ...statusTimestamps(nextStatus) } : {}),
        ...(ctx.isAdmin && body.assignedToUserId !== undefined ? { assignedToUserId: body.assignedToUserId || null } : {}),
        ...(body.meetingDate !== undefined ? { meetingDate: body.meetingDate ? new Date(body.meetingDate) : null } : {}),
        ...(body.meetingNotes !== undefined ? { meetingNotes: body.meetingNotes?.trim() || null } : {}),
        ...(body.internalNotes !== undefined ? { internalNotes: body.internalNotes?.trim() || null } : {}),
        ...(body.hospitalConfirmationNotes !== undefined
          ? { hospitalConfirmationNotes: body.hospitalConfirmationNotes?.trim() || null }
          : {}),
      },
    });

    if (nextStatus && updated.hospitalId) {
      await db.hospital.update({
        where: { id: updated.hospitalId },
        data: { onboardingStatus: nextStatus },
      });
    }

    queueAuditLog({
      actorUserId: ctx.user.id,
      hospitalId: updated.hospitalId ?? undefined,
      action: "HOSPITAL_ONBOARDING_UPDATED",
      entity: "HospitalOnboarding",
      entityId: updated.id,
      before: { status: before.status, assignedToUserId: before.assignedToUserId },
      after: { status: updated.status, assignedToUserId: updated.assignedToUserId },
    });

    return NextResponse.json({ success: true });
  }

  if (body.action === "SAVE_PROFILE") {
    let hospitalId: string;
    try { hospitalId = requireHospital(); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Missing hospital" }, { status: 400 }); }

    const updateData = {
      phone: body.phone?.trim() || null,
      email: body.email?.trim() || null,
      website: body.website?.trim() || null,
      openingHours: body.openingHours?.trim() || null,
      emergencyAvailable: Boolean(body.emergencyAvailable),
      servicesSummary: body.servicesSummary?.trim() || null,
      location: {
        update: {
          country: body.country?.trim() || "NP",
          province: body.province?.trim() || null,
          district: body.district?.trim() || body.city?.trim() || "Unknown",
          city: body.city?.trim() || body.district?.trim() || "Unknown",
          area: body.area?.trim() || null,
          addressLine: body.addressLine?.trim() || null,
          lat: typeof body.lat === "number" && Number.isFinite(body.lat) ? body.lat : null,
          lng: typeof body.lng === "number" && Number.isFinite(body.lng) ? body.lng : null,
        },
      },
    };

    const hospital = await db.hospital.update({
      where: { id: hospitalId },
      data: updateData,
    });

    await markChecklist(body.onboardingId, "Hospital basic info added", ctx.user.id);
    queueAuditLog({
      actorUserId: ctx.user.id,
      hospitalId,
      action: "ONBOARDING_PROFILE_SAVED",
      entity: "Hospital",
      entityId: hospitalId,
      after: updateData,
    });

    return NextResponse.json({ success: true, hospital });
  }

  if (body.action === "ADD_DEPARTMENT") {
    let hospitalId: string;
    try { hospitalId = requireHospital(); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Missing hospital" }, { status: 400 }); }

    const name = body.name?.trim();
    if (!name) return NextResponse.json({ error: "Department name is required" }, { status: 400 });

    const baseSlug = slugifyValue(name);
    let slug = baseSlug;
    let suffix = 2;
    while (await db.hospitalDepartment.findUnique({ where: { hospitalId_slug: { hospitalId, slug } }, select: { id: true } })) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const department = await db.hospitalDepartment.create({
      data: {
        hospitalId,
        name,
        slug,
        overview: body.overview?.trim() || null,
        sortOrder: Number.isInteger(body.sortOrder) ? Number(body.sortOrder) : 0,
        dataOrigin: "ONBOARDING",
      },
    });

    await markChecklist(body.onboardingId, "Departments added", ctx.user.id);
    queueAuditLog({
      actorUserId: ctx.user.id,
      hospitalId,
      action: "ONBOARDING_DEPARTMENT_ADDED",
      entity: "HospitalDepartment",
      entityId: department.id,
      after: { name: department.name },
    });

    return NextResponse.json({ success: true, department });
  }

  if (body.action === "UPDATE_DEPARTMENT") {
    let hospitalId: string;
    try { hospitalId = requireHospital(); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Missing hospital" }, { status: 400 }); }

    if (!body.entityId) return NextResponse.json({ error: "Department id is required" }, { status: 400 });
    const name = body.name?.trim();
    if (!name) return NextResponse.json({ error: "Department name is required" }, { status: 400 });

    const existing = await db.hospitalDepartment.findFirst({ where: { id: body.entityId, hospitalId } });
    if (!existing) return NextResponse.json({ error: "Department not found" }, { status: 404 });

    const department = await db.hospitalDepartment.update({
      where: { id: existing.id },
      data: {
        name,
        overview: body.overview?.trim() || null,
        sortOrder: Number.isInteger(body.sortOrder) ? Number(body.sortOrder) : existing.sortOrder,
      },
    });

    queueAuditLog({
      actorUserId: ctx.user.id,
      hospitalId,
      action: "ONBOARDING_DEPARTMENT_UPDATED",
      entity: "HospitalDepartment",
      entityId: department.id,
      before: { name: existing.name, overview: existing.overview },
      after: { name: department.name, overview: department.overview },
    });

    return NextResponse.json({ success: true, department });
  }

  if (body.action === "DELETE_DEPARTMENT") {
    let hospitalId: string;
    try { hospitalId = requireHospital(); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Missing hospital" }, { status: 400 }); }

    if (!body.entityId) return NextResponse.json({ error: "Department id is required" }, { status: 400 });
    const existing = await db.hospitalDepartment.findFirst({ where: { id: body.entityId, hospitalId } });
    if (!existing) return NextResponse.json({ error: "Department not found" }, { status: 404 });

    await db.hospitalDepartment.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    queueAuditLog({
      actorUserId: ctx.user.id,
      hospitalId,
      action: "ONBOARDING_DEPARTMENT_DELETED",
      entity: "HospitalDepartment",
      entityId: existing.id,
      before: { name: existing.name },
    });

    return NextResponse.json({ success: true });
  }

  if (body.action === "ADD_DOCTOR") {
    let hospitalId: string;
    try { hospitalId = requireHospital(); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Missing hospital" }, { status: 400 }); }

    const fullName = body.fullName?.trim();
    if (!fullName) return NextResponse.json({ error: "Doctor name is required" }, { status: 400 });

    const doctor = await db.$transaction(async (tx) => {
      const created = await tx.doctor.create({
        data: {
          fullName,
          licenseNumber: body.licenseNumber?.trim() || null,
          experienceYears: body.experienceYears === null || body.experienceYears === undefined ? null : Number(body.experienceYears),
          feeMin: body.feeMin === null || body.feeMin === undefined ? null : Number(body.feeMin),
          feeMax: body.feeMax === null || body.feeMax === undefined ? null : Number(body.feeMax),
          currency: body.currency?.trim() || "EUR",
          verified: false,
          dataOrigin: "ONBOARDING",
        },
      });

      await tx.doctorHospital.create({
        data: {
          doctorId: created.id,
          hospitalId,
          positionTitle: body.positionTitle?.trim() || null,
        },
      });

      if (body.departmentId) {
        await tx.departmentDoctor.create({
          data: { departmentId: body.departmentId, doctorId: created.id },
        });
      }

      const photoUrl = body.photoUrl?.trim();
      if (photoUrl) {
        await tx.doctorMedia.create({
          data: {
            doctorId: created.id,
            url: photoUrl,
            altText: `${fullName} photo`,
            isPrimary: true,
            dataOrigin: "ONBOARDING",
          },
        });
      }

      return created;
    });

    await markChecklist(body.onboardingId, "Doctors added", ctx.user.id);
    queueAuditLog({
      actorUserId: ctx.user.id,
      hospitalId,
      action: "ONBOARDING_DOCTOR_ADDED",
      entity: "Doctor",
      entityId: doctor.id,
      after: { fullName: doctor.fullName },
    });

    return NextResponse.json({ success: true, doctor });
  }

  if (body.action === "UPDATE_DOCTOR") {
    let hospitalId: string;
    try { hospitalId = requireHospital(); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Missing hospital" }, { status: 400 }); }

    const doctorId = body.entityId?.trim();
    const fullName = body.fullName?.trim();
    if (!doctorId) return NextResponse.json({ error: "Doctor id is required" }, { status: 400 });
    if (!fullName) return NextResponse.json({ error: "Doctor name is required" }, { status: 400 });

    const link = await db.doctorHospital.findUnique({
      where: { doctorId_hospitalId: { doctorId, hospitalId } },
      select: { doctorId: true, positionTitle: true },
    });
    if (!link) return NextResponse.json({ error: "Doctor is not linked to this hospital" }, { status: 404 });

    const doctor = await db.$transaction(async (tx) => {
      const updated = await tx.doctor.update({
        where: { id: doctorId },
        data: {
          fullName,
          licenseNumber: body.licenseNumber?.trim() || null,
          experienceYears: body.experienceYears === null || body.experienceYears === undefined ? null : Number(body.experienceYears),
          feeMin: body.feeMin === null || body.feeMin === undefined ? null : Number(body.feeMin),
          feeMax: body.feeMax === null || body.feeMax === undefined ? null : Number(body.feeMax),
          currency: body.currency?.trim() || "EUR",
        },
      });

      await tx.doctorHospital.update({
        where: { doctorId_hospitalId: { doctorId, hospitalId } },
        data: { positionTitle: body.positionTitle?.trim() || null },
      });

      const hospitalDepartmentIds = await tx.hospitalDepartment.findMany({
        where: { hospitalId },
        select: { id: true },
      });
      await tx.departmentDoctor.deleteMany({
        where: { doctorId, departmentId: { in: hospitalDepartmentIds.map((dept) => dept.id) } },
      });
      if (body.departmentId) {
        await tx.departmentDoctor.create({
          data: { departmentId: body.departmentId, doctorId },
        });
      }

      const photoUrl = body.photoUrl?.trim();
      if (photoUrl) {
        await tx.doctorMedia.updateMany({
          where: { doctorId },
          data: { isPrimary: false },
        });
        await tx.doctorMedia.create({
          data: {
            doctorId,
            url: photoUrl,
            altText: `${fullName} photo`,
            isPrimary: true,
            dataOrigin: "ONBOARDING",
          },
        });
      }

      return updated;
    });

    queueAuditLog({
      actorUserId: ctx.user.id,
      hospitalId,
      action: "ONBOARDING_DOCTOR_UPDATED",
      entity: "Doctor",
      entityId: doctor.id,
      after: { fullName: doctor.fullName },
    });

    return NextResponse.json({ success: true, doctor });
  }

  if (body.action === "DELETE_DOCTOR") {
    let hospitalId: string;
    try { hospitalId = requireHospital(); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Missing hospital" }, { status: 400 }); }

    const doctorId = body.entityId?.trim();
    if (!doctorId) return NextResponse.json({ error: "Doctor id is required" }, { status: 400 });
    const link = await db.doctorHospital.findUnique({ where: { doctorId_hospitalId: { doctorId, hospitalId } } });
    if (!link) return NextResponse.json({ error: "Doctor is not linked to this hospital" }, { status: 404 });

    await db.$transaction(async (tx) => {
      const hospitalDepartmentIds = await tx.hospitalDepartment.findMany({
        where: { hospitalId },
        select: { id: true },
      });
      await tx.availabilitySlot.deleteMany({ where: { hospitalId, doctorId } });
      await tx.departmentDoctor.deleteMany({
        where: { doctorId, departmentId: { in: hospitalDepartmentIds.map((dept) => dept.id) } },
      });
      await tx.doctorHospital.delete({ where: { doctorId_hospitalId: { doctorId, hospitalId } } });
    });

    queueAuditLog({
      actorUserId: ctx.user.id,
      hospitalId,
      action: "ONBOARDING_DOCTOR_DELETED",
      entity: "Doctor",
      entityId: doctorId,
    });

    return NextResponse.json({ success: true });
  }

  if (body.action === "ADD_SCHEDULE") {
    let hospitalId: string;
    try { hospitalId = requireHospital(); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Missing hospital" }, { status: 400 }); }

    const doctorId = body.doctorId?.trim();
    const mode = body.mode;
    const dayOfWeek = Number(body.dayOfWeek);
    const startTime = body.startTime?.trim();
    const endTime = body.endTime?.trim();
    const slotDurationMinutes = Number(body.slotDurationMinutes ?? 30);

    if (!doctorId || !mode || !startTime || !endTime) {
      return NextResponse.json({ error: "doctor, mode, start time and end time are required" }, { status: 400 });
    }
    if (!["ONLINE", "PHYSICAL"].includes(mode)) return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return NextResponse.json({ error: "Invalid day" }, { status: 400 });
    if (!Number.isInteger(slotDurationMinutes) || slotDurationMinutes < 5 || slotDurationMinutes > 240) {
      return NextResponse.json({ error: "Slot duration must be between 5 and 240 minutes" }, { status: 400 });
    }

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
      return NextResponse.json({ error: "Invalid time window" }, { status: 400 });
    }

    const doctorHospital = await db.doctorHospital.findUnique({
      where: { doctorId_hospitalId: { doctorId, hospitalId } },
      select: { doctorId: true },
    });
    if (!doctorHospital) return NextResponse.json({ error: "Doctor is not linked to this hospital" }, { status: 404 });

    try {
      const slot = await db.availabilitySlot.create({
        data: {
          doctorId,
          hospitalId,
          mode,
          dayOfWeek,
          startTime,
          endTime,
          slotDurationMinutes,
          dataOrigin: "ONBOARDING",
        },
      });

      await markChecklist(body.onboardingId, "Schedules configured", ctx.user.id);
      queueAuditLog({
        actorUserId: ctx.user.id,
        hospitalId,
        action: "ONBOARDING_SCHEDULE_ADDED",
        entity: "AvailabilitySlot",
        entityId: slot.id,
        after: { doctorId, mode, dayOfWeek, startTime, endTime },
      });

      return NextResponse.json({ success: true, slot });
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
        return NextResponse.json({ error: "This schedule already exists" }, { status: 409 });
      }
      throw error;
    }
  }

  if (body.action === "UPDATE_SCHEDULE") {
    let hospitalId: string;
    try { hospitalId = requireHospital(); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Missing hospital" }, { status: 400 }); }

    const slotId = body.entityId?.trim();
    const doctorId = body.doctorId?.trim();
    const mode = body.mode;
    const dayOfWeek = Number(body.dayOfWeek);
    const startTime = body.startTime?.trim();
    const endTime = body.endTime?.trim();
    const slotDurationMinutes = Number(body.slotDurationMinutes ?? 30);

    if (!slotId) return NextResponse.json({ error: "Schedule id is required" }, { status: 400 });
    if (!doctorId || !mode || !startTime || !endTime) {
      return NextResponse.json({ error: "doctor, mode, start time and end time are required" }, { status: 400 });
    }
    if (!["ONLINE", "PHYSICAL"].includes(mode)) return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return NextResponse.json({ error: "Invalid day" }, { status: 400 });

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
      return NextResponse.json({ error: "Invalid time window" }, { status: 400 });
    }

    const existing = await db.availabilitySlot.findFirst({ where: { id: slotId, hospitalId } });
    if (!existing) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });

    const slot = await db.availabilitySlot.update({
      where: { id: slotId },
      data: { doctorId, mode, dayOfWeek, startTime, endTime, slotDurationMinutes },
    });

    queueAuditLog({
      actorUserId: ctx.user.id,
      hospitalId,
      action: "ONBOARDING_SCHEDULE_UPDATED",
      entity: "AvailabilitySlot",
      entityId: slot.id,
      before: { doctorId: existing.doctorId, dayOfWeek: existing.dayOfWeek, startTime: existing.startTime },
      after: { doctorId, dayOfWeek, startTime },
    });

    return NextResponse.json({ success: true, slot });
  }

  if (body.action === "DELETE_SCHEDULE") {
    let hospitalId: string;
    try { hospitalId = requireHospital(); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Missing hospital" }, { status: 400 }); }

    const slotId = body.entityId?.trim();
    if (!slotId) return NextResponse.json({ error: "Schedule id is required" }, { status: 400 });
    const existing = await db.availabilitySlot.findFirst({ where: { id: slotId, hospitalId } });
    if (!existing) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });

    await db.availabilitySlot.update({ where: { id: slotId }, data: { isActive: false } });

    queueAuditLog({
      actorUserId: ctx.user.id,
      hospitalId,
      action: "ONBOARDING_SCHEDULE_DELETED",
      entity: "AvailabilitySlot",
      entityId: slotId,
      before: { doctorId: existing.doctorId, dayOfWeek: existing.dayOfWeek, startTime: existing.startTime },
    });

    return NextResponse.json({ success: true });
  }

  if (body.action === "ADD_PACKAGE") {
    let hospitalId: string;
    try { hospitalId = requireHospital(); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Missing hospital" }, { status: 400 }); }

    const title = body.title?.trim();
    if (!title) return NextResponse.json({ error: "Package title is required" }, { status: 400 });

    const pkg = await db.hospitalPackage.create({
      data: {
        hospitalId,
        title,
        description: body.description?.trim() || null,
        price: body.price === null || body.price === undefined ? null : Number(body.price),
        currency: body.currency?.trim() || "EUR",
        dataOrigin: "ONBOARDING",
      },
    });

    await markChecklist(body.onboardingId, "Packages configured", ctx.user.id);
    queueAuditLog({
      actorUserId: ctx.user.id,
      hospitalId,
      action: "ONBOARDING_PACKAGE_ADDED",
      entity: "HospitalPackage",
      entityId: pkg.id,
      after: { title: pkg.title, price: pkg.price },
    });

    return NextResponse.json({ success: true, package: pkg });
  }

  if (body.action === "UPDATE_PACKAGE") {
    let hospitalId: string;
    try { hospitalId = requireHospital(); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Missing hospital" }, { status: 400 }); }

    const packageId = body.entityId?.trim();
    const title = body.title?.trim();
    if (!packageId) return NextResponse.json({ error: "Package id is required" }, { status: 400 });
    if (!title) return NextResponse.json({ error: "Package title is required" }, { status: 400 });

    const existing = await db.hospitalPackage.findFirst({ where: { id: packageId, hospitalId } });
    if (!existing) return NextResponse.json({ error: "Package not found" }, { status: 404 });

    const pkg = await db.hospitalPackage.update({
      where: { id: packageId },
      data: {
        title,
        description: body.description?.trim() || null,
        price: body.price === null || body.price === undefined ? null : Number(body.price),
        currency: body.currency?.trim() || "EUR",
      },
    });

    queueAuditLog({
      actorUserId: ctx.user.id,
      hospitalId,
      action: "ONBOARDING_PACKAGE_UPDATED",
      entity: "HospitalPackage",
      entityId: pkg.id,
      before: { title: existing.title, price: existing.price },
      after: { title: pkg.title, price: pkg.price },
    });

    return NextResponse.json({ success: true, package: pkg });
  }

  if (body.action === "DELETE_PACKAGE") {
    let hospitalId: string;
    try { hospitalId = requireHospital(); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Missing hospital" }, { status: 400 }); }

    const packageId = body.entityId?.trim();
    if (!packageId) return NextResponse.json({ error: "Package id is required" }, { status: 400 });
    const existing = await db.hospitalPackage.findFirst({ where: { id: packageId, hospitalId } });
    if (!existing) return NextResponse.json({ error: "Package not found" }, { status: 404 });

    await db.hospitalPackage.update({ where: { id: packageId }, data: { isActive: false } });

    queueAuditLog({
      actorUserId: ctx.user.id,
      hospitalId,
      action: "ONBOARDING_PACKAGE_DELETED",
      entity: "HospitalPackage",
      entityId: packageId,
      before: { title: existing.title, price: existing.price },
    });

    return NextResponse.json({ success: true });
  }

  if (body.action === "ADD_MEDIA") {
    let hospitalId: string;
    try { hospitalId = requireHospital(); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Missing hospital" }, { status: 400 }); }

    const url = body.url?.trim();
    if (!url) return NextResponse.json({ error: "Media URL is required" }, { status: 400 });

    const media = await db.$transaction(async (tx) => {
      if (body.isPrimary) {
        await tx.hospitalMedia.updateMany({ where: { hospitalId }, data: { isPrimary: false } });
      }

      return tx.hospitalMedia.create({
        data: {
          hospitalId,
          url,
          altText: body.altText?.trim() || null,
          isPrimary: Boolean(body.isPrimary),
          dataOrigin: "ONBOARDING",
        },
      });
    });

    await markChecklist(body.onboardingId, "Hospital media added", ctx.user.id);
    queueAuditLog({
      actorUserId: ctx.user.id,
      hospitalId,
      action: "ONBOARDING_MEDIA_ADDED",
      entity: "HospitalMedia",
      entityId: media.id,
      after: { url: media.url, isPrimary: media.isPrimary },
    });

    return NextResponse.json({ success: true, media });
  }

  if (body.action === "UPDATE_MEDIA") {
    let hospitalId: string;
    try { hospitalId = requireHospital(); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Missing hospital" }, { status: 400 }); }

    const mediaId = body.entityId?.trim();
    const url = body.url?.trim();
    if (!mediaId) return NextResponse.json({ error: "Media id is required" }, { status: 400 });
    if (!url) return NextResponse.json({ error: "Media URL is required" }, { status: 400 });

    const existing = await db.hospitalMedia.findFirst({ where: { id: mediaId, hospitalId } });
    if (!existing) return NextResponse.json({ error: "Media not found" }, { status: 404 });

    const media = await db.$transaction(async (tx) => {
      if (body.isPrimary) {
        await tx.hospitalMedia.updateMany({ where: { hospitalId, id: { not: mediaId } }, data: { isPrimary: false } });
      }

      return tx.hospitalMedia.update({
        where: { id: mediaId },
        data: {
          url,
          altText: body.altText?.trim() || null,
          isPrimary: Boolean(body.isPrimary),
        },
      });
    });

    queueAuditLog({
      actorUserId: ctx.user.id,
      hospitalId,
      action: "ONBOARDING_MEDIA_UPDATED",
      entity: "HospitalMedia",
      entityId: media.id,
      before: { url: existing.url, isPrimary: existing.isPrimary },
      after: { url: media.url, isPrimary: media.isPrimary },
    });

    return NextResponse.json({ success: true, media });
  }

  if (body.action === "DELETE_MEDIA") {
    let hospitalId: string;
    try { hospitalId = requireHospital(); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Missing hospital" }, { status: 400 }); }

    const mediaId = body.entityId?.trim();
    if (!mediaId) return NextResponse.json({ error: "Media id is required" }, { status: 400 });
    const existing = await db.hospitalMedia.findFirst({ where: { id: mediaId, hospitalId } });
    if (!existing) return NextResponse.json({ error: "Media not found" }, { status: 404 });

    await db.hospitalMedia.delete({ where: { id: mediaId } });

    queueAuditLog({
      actorUserId: ctx.user.id,
      hospitalId,
      action: "ONBOARDING_MEDIA_DELETED",
      entity: "HospitalMedia",
      entityId: mediaId,
      before: { url: existing.url, isPrimary: existing.isPrimary },
    });

    return NextResponse.json({ success: true });
  }

  if (body.action === "ASSIGN_OWNER") {
    let hospitalId: string;
    try { hospitalId = requireHospital(); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Missing hospital" }, { status: 400 }); }

    const email = body.ownerEmail?.trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "Main hospital admin email is required" }, { status: 400 });

    const owner = await db.user.findUnique({
      where: { email },
      select: { id: true, fullName: true, email: true },
    });
    if (!owner) {
      return NextResponse.json({ error: "This user must sign up before they can become the main hospital admin" }, { status: 404 });
    }

    const membership = await db.hospitalMembership.upsert({
      where: { userId_hospitalId: { userId: owner.id, hospitalId } },
      update: {
        role: "OWNER",
        status: "APPROVED",
        approvedAt: new Date(),
        approvedById: ctx.user.id,
        rejectedAt: null,
        rejectedById: null,
        rejectedReason: null,
      },
      create: {
        userId: owner.id,
        hospitalId,
        role: "OWNER",
        status: "APPROVED",
        invitedBy: ctx.user.id,
        approvedAt: new Date(),
        approvedById: ctx.user.id,
      },
    });

    await markChecklist(body.onboardingId, "Owner account linked", ctx.user.id);
    queueAuditLog({
      actorUserId: ctx.user.id,
      hospitalId,
      action: "ONBOARDING_OWNER_ASSIGNED",
      entity: "HospitalMembership",
      entityId: membership.id,
      after: { userId: owner.id, email: owner.email },
    });

    return NextResponse.json({ success: true, membership });
  }

  if (body.action === "ADD_NOTE") {
    if (!body.body?.trim()) return NextResponse.json({ error: "Note body is required" }, { status: 400 });

    const note = await db.hospitalOnboardingNote.create({
      data: {
        onboardingId: body.onboardingId,
        authorUserId: ctx.user.id,
        title: body.title?.trim() || null,
        body: body.body.trim(),
      },
    });

    queueAuditLog({
      actorUserId: ctx.user.id,
      hospitalId: access.hospitalId ?? undefined,
      action: "HOSPITAL_ONBOARDING_NOTE_ADDED",
      entity: "HospitalOnboardingNote",
      entityId: note.id,
      after: { onboardingId: body.onboardingId, title: note.title },
    });

    return NextResponse.json({ success: true });
  }

  if (body.action === "ADD_CHECKLIST") {
    if (!body.title?.trim()) return NextResponse.json({ error: "Checklist title is required" }, { status: 400 });

    const item = await db.hospitalOnboardingChecklistItem.create({
      data: {
        onboardingId: body.onboardingId,
        title: body.title.trim(),
        isRequired: body.isRequired ?? true,
        sortOrder: 999,
      },
    });

    return NextResponse.json({ success: true, id: item.id });
  }

  if (body.action === "SET_CHECKLIST") {
    if (!body.itemId) return NextResponse.json({ error: "itemId is required" }, { status: 400 });

    const item = await db.hospitalOnboardingChecklistItem.findFirst({
      where: { id: body.itemId, onboardingId: body.onboardingId },
    });
    if (!item) return NextResponse.json({ error: "Checklist item not found" }, { status: 404 });

    await db.hospitalOnboardingChecklistItem.update({
      where: { id: item.id },
      data: {
        isCompleted: Boolean(body.isCompleted),
        completedAt: body.isCompleted ? new Date() : null,
        completedById: body.isCompleted ? ctx.user.id : null,
      },
    });

    return NextResponse.json({ success: true });
  }

  if (body.action === "CREATE_HOSPITAL_SHELL") {
    if (!ctx.isAdmin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const onboarding = await db.hospitalOnboarding.findUnique({
      where: { id: body.onboardingId },
      include: { partnerInquiry: true },
    });
    if (!onboarding) return NextResponse.json({ error: "Hospital setup case not found" }, { status: 404 });
    if (onboarding.hospitalId) return NextResponse.json({ error: "Hospital record already linked" }, { status: 409 });
    if (!onboarding.partnerInquiry) return NextResponse.json({ error: "No inquiry linked to create the hospital record from" }, { status: 400 });

    const inquiry = onboarding.partnerInquiry;
    const slug = await createUniqueHospitalSlug(inquiry.hospitalName);
    const hospital = await db.$transaction(async (tx) => {
      const created = await tx.hospital.create({
        data: {
          slug,
          name: inquiry.hospitalName,
          type: inquiry.type as HospitalType,
          phone: inquiry.phone,
          email: inquiry.email,
          isActive: false,
          verified: false,
          onboardingStatus: "DATA_ENTRY_IN_PROGRESS",
          location: { create: { country: "NP", district: inquiry.city, city: inquiry.city } },
        },
      });

      await tx.hospitalOnboarding.update({
        where: { id: onboarding.id },
        data: {
          hospitalId: created.id,
          status: "DATA_ENTRY_IN_PROGRESS",
          dataEntryStartedAt: new Date(),
        },
      });

      await tx.partnerInquiry.update({
        where: { id: inquiry.id },
        data: { hospitalId: created.id, status: "CONTACTED" },
      });

      return created;
    });

    queueAuditLog({
      actorUserId: ctx.user.id,
      hospitalId: hospital.id,
      action: "HOSPITAL_SHELL_CREATED_FROM_ONBOARDING",
      entity: "Hospital",
      entityId: hospital.id,
      after: { onboardingId: onboarding.id, inquiryId: inquiry.id, slug: hospital.slug },
    });

    return NextResponse.json({ success: true, hospitalId: hospital.id });
  }

  if (body.action === "PUBLISH") {
    if (!ctx.isAdmin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const onboarding = await db.hospitalOnboarding.findUnique({
      where: { id: body.onboardingId },
      include: { checklist: true },
    });
    if (!onboarding?.hospitalId) return NextResponse.json({ error: "Create the hospital record before making it live" }, { status: 400 });

    const missingRequired = onboarding.checklist.filter((item) => item.isRequired && !item.isCompleted);
    if (missingRequired.length > 0) {
      return NextResponse.json({ error: "Complete required launch checklist items before making the hospital live" }, { status: 400 });
    }

    const now = new Date();
    await db.$transaction([
      db.hospital.update({
        where: { id: onboarding.hospitalId },
        data: {
          isActive: true,
          verified: true,
          verifiedAt: now,
          verifiedById: ctx.user.id,
          onboardingStatus: "PUBLISHED",
          publishedAt: now,
          publishedById: ctx.user.id,
        },
      }),
      db.hospitalOnboarding.update({
        where: { id: onboarding.id },
        data: { status: "PUBLISHED", publishedAt: now },
      }),
      ...(onboarding.partnerInquiryId
        ? [
            db.partnerInquiry.update({
              where: { id: onboarding.partnerInquiryId },
              data: { status: "ONBOARDED", hospitalId: onboarding.hospitalId },
            }),
          ]
        : []),
    ]);

    queueAuditLog({
      actorUserId: ctx.user.id,
      hospitalId: onboarding.hospitalId,
      action: "HOSPITAL_ONBOARDING_PUBLISHED",
      entity: "HospitalOnboarding",
      entityId: onboarding.id,
      after: { hospitalId: onboarding.hospitalId },
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
