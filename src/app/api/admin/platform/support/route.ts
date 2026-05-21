import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  let actor;
  try { actor = await requirePlatformAdmin({ apiMode: true }); }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ error: msg }, { status: msg === "FORBIDDEN" ? 403 : 401 });
  }
  void actor;

  const [supportUsers, hospitals] = await Promise.all([
    db.user.findMany({
      where: { role: "PLATFORM_SUPPORT", bannedAt: null },
      select: {
        id: true,
        fullName: true,
        email: true,
        supportAssignments: {
          where: { isActive: true },
          select: {
            id: true,
            createdAt: true,
            hospital: { select: { id: true, name: true, slug: true, isActive: true, verified: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { fullName: "asc" },
    }),
    db.hospital.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        verified: true,
        supportAssignments: {
          where: { isActive: true },
          select: {
            id: true,
            createdAt: true,
            supportUser: { select: { id: true, fullName: true, email: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({
    supportUsers: supportUsers.map((user) => ({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      assignments: user.supportAssignments.map((assignment) => ({
        id: assignment.id,
        createdAt: assignment.createdAt.toISOString(),
        hospital: assignment.hospital,
      })),
    })),
    hospitals: hospitals.map((hospital) => ({
      id: hospital.id,
      name: hospital.name,
      slug: hospital.slug,
      verified: hospital.verified,
      assignments: hospital.supportAssignments.map((assignment) => ({
        id: assignment.id,
        createdAt: assignment.createdAt.toISOString(),
        supportUser: assignment.supportUser,
      })),
    })),
  });
}
