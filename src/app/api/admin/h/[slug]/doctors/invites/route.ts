import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { requireHospitalAccess, writeAuditLog } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  let ctx;
  try {
    ctx = await requireHospitalAccess(slug, "MANAGE_DOCTORS", { apiMode: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ error: msg }, { status: msg === "FORBIDDEN" ? 403 : 401 });
  }

  let body: { doctorId?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const doctorId = body.doctorId?.trim();
  const email = body.email ? normalizeEmail(body.email) : "";

  if (!doctorId || !email || !email.includes("@")) {
    return NextResponse.json({ error: "doctorId and a valid email are required" }, { status: 400 });
  }

  const doctor = await db.doctor.findFirst({
    where: {
      id: doctorId,
      hospitals: { some: { hospitalId: ctx.membership.hospitalId } },
    },
    select: { id: true, fullName: true, userId: true },
  });

  if (!doctor) return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  if (doctor.userId) return NextResponse.json({ error: "Doctor is already linked to a user account" }, { status: 409 });

  const existingUser = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      memberships: {
        where: { hospitalId: ctx.membership.hospitalId },
        select: { role: true, status: true },
      },
    },
  });

  const existingMembership = existingUser?.memberships[0] ?? null;
  if (existingMembership && existingMembership.role !== "DOCTOR") {
    return NextResponse.json({
      error: `This email already has ${existingMembership.role.toLowerCase()} access for this hospital. Doctor invites cannot change existing hospital authority.`,
    }, { status: 409 });
  }

  await db.doctorInvite.updateMany({
    where: {
      doctorId,
      hospitalId: ctx.membership.hospitalId,
      status: "PENDING",
    },
    data: { status: "REVOKED", revokedAt: new Date() },
  });

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);

  const invite = await db.doctorInvite.create({
    data: {
      doctorId,
      hospitalId: ctx.membership.hospitalId,
      email,
      tokenHash: hashToken(token),
      invitedById: ctx.user.id,
      expiresAt,
    },
  });

  await writeAuditLog({
    actorUserId: ctx.user.id,
    hospitalId: ctx.membership.hospitalId,
    action: "DOCTOR_INVITE_CREATED",
    entity: "DoctorInvite",
    entityId: invite.id,
    after: { doctorId, doctorName: doctor.fullName, email, expiresAt: expiresAt.toISOString() },
  });

  const inviteUrl = new URL(`/doctor-invite/${token}`, req.url).toString();

  return NextResponse.json({
    invite: {
      id: invite.id,
      email: invite.email,
      expiresAt: invite.expiresAt.toISOString(),
      inviteUrl,
    },
  });
}
