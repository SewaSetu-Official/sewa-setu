import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import type { HospitalRole } from "@prisma/client";

const VALID_ROLES: HospitalRole[] = ["HOSPITAL_OWNER", "HOSPITAL_MANAGER", "RECEPTION", "CONTENT_EDITOR"];

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { hospitalId?: string; role?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { hospitalId, role } = body;

  if (!hospitalId || !role) {
    return NextResponse.json({ error: "hospitalId and role are required" }, { status: 400 });
  }

  if (!VALID_ROLES.includes(role as HospitalRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { clerkId },
    select: { id: true, bannedAt: true },
  });

  if (!user || user.bannedAt) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hospital = await db.hospital.findUnique({
    where: { id: hospitalId, isActive: true },
    select: { id: true },
  });

  if (!hospital) {
    return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
  }

  // Check for existing membership
  const existing = await db.hospitalMembership.findUnique({
    where: { userId_hospitalId: { userId: user.id, hospitalId } },
  });

  if (existing) {
    if (existing.status === "APPROVED") {
      return NextResponse.json({ error: "You already have access to this hospital" }, { status: 409 });
    }
    if (existing.status === "PENDING") {
      return NextResponse.json({ error: "You already have a pending request for this hospital" }, { status: 409 });
    }
    // REJECTED — allow re-request by updating the record
    const updated = await db.hospitalMembership.update({
      where: { id: existing.id },
      data: { role: role as HospitalRole, status: "PENDING", rejectedReason: null },
    });
    return NextResponse.json({ membership: updated }, { status: 200 });
  }

  const membership = await db.hospitalMembership.create({
    data: {
      userId: user.id,
      hospitalId,
      role: role as HospitalRole,
      status: "PENDING",
    },
  });

  return NextResponse.json({ membership }, { status: 201 });
}
