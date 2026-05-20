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
      isActive: true,
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

  return NextResponse.json({
    hospital,
    role: ctx.membership.role,
    canManageOwnerControls: ctx.membership.role === "OWNER",
  });
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
