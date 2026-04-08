import { NextResponse } from "next/server";
import { requireHospitalAccess, writeAuditLog } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import type { HospitalRole } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_ROLES: HospitalRole[] = ["HOSPITAL_OWNER", "HOSPITAL_MANAGER", "RECEPTION", "CONTENT_EDITOR"];

// GET /api/admin/h/[slug]/team
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let ctx;
  try { ctx = await requireHospitalAccess(slug, "MANAGE_TEAM", { apiMode: true }); }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ error: msg }, { status: msg === "FORBIDDEN" ? 403 : 401 });
  }

  const members = await db.hospitalMembership.findMany({
    where: { hospitalId: ctx.membership.hospitalId },
    include: {
      user: { select: { fullName: true, email: true, createdAt: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({
    members: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      status: m.status,
      invitedBy: m.invitedBy ?? null,
      rejectedReason: m.rejectedReason ?? null,
      createdAt: m.createdAt.toISOString(),
      user: {
        fullName: m.user.fullName,
        email: m.user.email,
        memberSince: m.user.createdAt.toISOString(),
      },
    })),
  });
}

// PATCH /api/admin/h/[slug]/team — update role or status of a member
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let ctx;
  try { ctx = await requireHospitalAccess(slug, "MANAGE_TEAM", { apiMode: true }); }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ error: msg }, { status: msg === "FORBIDDEN" ? 403 : 401 });
  }

  let body: { memberId?: string; role?: string; status?: string; rejectedReason?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { memberId, role, status, rejectedReason } = body;
  if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });

  if (role && !VALID_ROLES.includes(role as HospitalRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const member = await db.hospitalMembership.findFirst({
    where: { id: memberId, hospitalId: ctx.membership.hospitalId },
  });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // Prevent owner from demoting themselves
  if (member.userId === ctx.user.id && role && role !== "HOSPITAL_OWNER") {
    return NextResponse.json({ error: "You cannot change your own role" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (role) updateData.role = role;
  if (status === "APPROVED") {
    updateData.status = "APPROVED";
    updateData.rejectedReason = null;
  }
  if (status === "REJECTED") {
    updateData.status = "REJECTED";
    updateData.rejectedReason = rejectedReason?.trim() ?? null;
  }

  const updated = await db.hospitalMembership.update({
    where: { id: memberId },
    data: updateData as never,
  });

  await writeAuditLog({
    actorUserId: ctx.user.id,
    hospitalId: ctx.membership.hospitalId,
    action: status === "REJECTED" ? "MEMBER_REJECTED" : status === "APPROVED" ? "MEMBER_APPROVED" : "MEMBER_ROLE_CHANGED",
    entity: "HospitalMembership",
    entityId: memberId,
    before: { role: member.role, status: member.status },
    after: { role: updated.role, status: updated.status },
  });

  return NextResponse.json({ success: true });
}

// DELETE /api/admin/h/[slug]/team — remove a member
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let ctx;
  try { ctx = await requireHospitalAccess(slug, "MANAGE_TEAM", { apiMode: true }); }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ error: msg }, { status: msg === "FORBIDDEN" ? 403 : 401 });
  }

  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("memberId");
  if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });

  const member = await db.hospitalMembership.findFirst({
    where: { id: memberId, hospitalId: ctx.membership.hospitalId },
  });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // Cannot remove yourself
  if (member.userId === ctx.user.id) {
    return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 });
  }

  await db.hospitalMembership.delete({ where: { id: memberId } });

  await writeAuditLog({
    actorUserId: ctx.user.id,
    hospitalId: ctx.membership.hospitalId,
    action: "MEMBER_REMOVED",
    entity: "HospitalMembership",
    entityId: memberId,
    before: { role: member.role, status: member.status },
  });

  return NextResponse.json({ success: true });
}
