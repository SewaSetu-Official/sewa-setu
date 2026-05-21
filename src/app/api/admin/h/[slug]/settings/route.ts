import { NextResponse } from "next/server";
import { requireHospitalAccess, writeAuditLog } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/admin/h/[slug]/settings
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let ctx;
  try { ctx = await requireHospitalAccess(slug, "MANAGE_PUBLIC_PROFILE", { apiMode: true }); }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ error: msg }, { status: msg === "FORBIDDEN" ? 403 : 401 });
  }

  const hospital = await db.hospital.findUnique({
    where: { id: ctx.membership.hospitalId },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      phone: true,
      email: true,
      website: true,
      openingHours: true,
      emergencyAvailable: true,
      servicesSummary: true,
      verified: true,
      verifiedAt: true,
      isActive: true,
      suspendedAt: true,
      suspensionReason: true,
      location: {
        select: {
          country: true,
          province: true,
          district: true,
          city: true,
          area: true,
          addressLine: true,
        },
      },
    },
  });

  if (!hospital) return NextResponse.json({ error: "Hospital not found" }, { status: 404 });

  const ownerSummary = ctx.membership.role === "OWNER"
    ? await getOwnerSummary(ctx.membership.hospitalId, hospital)
    : null;

  return NextResponse.json({
    hospital,
    role: ctx.membership.role,
    canManageOwnerControls: ctx.membership.role === "OWNER",
    ownerSummary,
  });
}

async function getOwnerSummary(
  hospitalId: string,
  hospital: {
    phone: string | null;
    email: string | null;
    website: string | null;
    servicesSummary: string | null;
    verified: boolean;
    verifiedAt: Date | null;
    isActive: boolean;
    suspendedAt: Date | null;
    suspensionReason: string | null;
    location: unknown;
  },
) {
  const [owners, pendingRequests, activeMembers, paidBookings, refundedBookings, revenue] = await Promise.all([
    db.hospitalMembership.count({ where: { hospitalId, role: "OWNER", status: "APPROVED" } }),
    db.hospitalMembership.count({ where: { hospitalId, status: "PENDING" } }),
    db.hospitalMembership.count({ where: { hospitalId, status: "APPROVED" } }),
    db.booking.count({ where: { hospitalId, status: { in: ["CONFIRMED", "COMPLETED"] } } }),
    db.booking.count({ where: { hospitalId, stripeRefundId: { not: null } } }),
    db.booking.aggregate({
      where: { hospitalId, status: { in: ["CONFIRMED", "COMPLETED"] } },
      _sum: { amountPaid: true },
    }),
  ]);

  const readinessItems = [
    { label: "Phone", complete: Boolean(hospital.phone) },
    { label: "Email", complete: Boolean(hospital.email) },
    { label: "Website", complete: Boolean(hospital.website) },
    { label: "Services", complete: Boolean(hospital.servicesSummary) },
    { label: "Location", complete: Boolean(hospital.location) },
    { label: "Platform verification", complete: hospital.verified },
  ];

  return {
    billing: {
      provider: "Stripe",
      status: process.env.STRIPE_SECRET_KEY ? "connected" : "not_configured",
      paidBookings,
      refundedBookings,
      totalRevenue: revenue._sum.amountPaid ?? 0,
    },
    governance: {
      owners,
      activeMembers,
      pendingRequests,
      verified: hospital.verified,
      verifiedAt: hospital.verifiedAt?.toISOString() ?? null,
      isActive: hospital.isActive,
      suspendedAt: hospital.suspendedAt?.toISOString() ?? null,
      suspensionReason: hospital.suspensionReason,
    },
    readiness: {
      completed: readinessItems.filter((item) => item.complete).length,
      total: readinessItems.length,
      items: readinessItems,
    },
  };
}

// PATCH /api/admin/h/[slug]/settings
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let ctx;
  try { ctx = await requireHospitalAccess(slug, "MANAGE_PUBLIC_PROFILE", { apiMode: true }); }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ error: msg }, { status: msg === "FORBIDDEN" ? 403 : 401 });
  }

  let body: {
    phone?: string;
    email?: string;
    website?: string;
    openingHours?: string;
    emergencyAvailable?: boolean;
    servicesSummary?: string;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await db.hospital.findUnique({
    where: { id: ctx.membership.hospitalId },
    select: { phone: true, email: true, website: true, openingHours: true, emergencyAvailable: true, servicesSummary: true },
  });
  if (!existing) return NextResponse.json({ error: "Hospital not found" }, { status: 404 });

  const updateData: Record<string, unknown> = {};
  if (body.phone      !== undefined) updateData.phone      = body.phone?.trim()      || null;
  if (body.email      !== undefined) updateData.email      = body.email?.trim()      || null;
  if (body.website    !== undefined) updateData.website    = body.website?.trim()    || null;
  if (body.openingHours !== undefined) updateData.openingHours = body.openingHours?.trim() || null;
  if (body.emergencyAvailable !== undefined) updateData.emergencyAvailable = body.emergencyAvailable;
  if (body.servicesSummary !== undefined) updateData.servicesSummary = body.servicesSummary?.trim() || null;

  const updated = await db.hospital.update({
    where: { id: ctx.membership.hospitalId },
    data: updateData as never,
  });

  await writeAuditLog({
    actorUserId: ctx.user.id,
    hospitalId: ctx.membership.hospitalId,
    action: "HOSPITAL_SETTINGS_UPDATED",
    entity: "Hospital",
    entityId: ctx.membership.hospitalId,
    before: existing,
    after: updateData,
  });

  return NextResponse.json({ success: true, hospital: updated });
}
