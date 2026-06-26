import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { ensureClerkUserInDb } from "@/lib/clerk-user-sync";

export const dynamic = "force-dynamic";

// GET /api/favorites                  → { doctorIds: string[], hospitalIds: string[] }
// GET /api/favorites?doctorId=X        → { saved: boolean }
// GET /api/favorites?hospitalId=Y      → { saved: boolean }
// Anonymous users get an empty/false result (200) so the UI renders cleanly.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const doctorId = searchParams.get("doctorId");
  const hospitalId = searchParams.get("hospitalId");
  const single = doctorId || hospitalId;

  const emptyList = { doctorIds: [] as string[], hospitalIds: [] as string[] };

  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json(single ? { saved: false } : emptyList);

  const dbUser = await ensureClerkUserInDb(clerkId);
  if (!dbUser) return NextResponse.json(single ? { saved: false } : emptyList);

  if (doctorId) {
    const fav = await db.favorite.findFirst({ where: { userId: dbUser.id, doctorId }, select: { id: true } });
    return NextResponse.json({ saved: Boolean(fav) });
  }
  if (hospitalId) {
    const fav = await db.favorite.findFirst({ where: { userId: dbUser.id, hospitalId }, select: { id: true } });
    return NextResponse.json({ saved: Boolean(fav) });
  }

  const favorites = await db.favorite.findMany({
    where: { userId: dbUser.id },
    select: { doctorId: true, hospitalId: true },
  });
  return NextResponse.json({
    doctorIds: favorites.map((f) => f.doctorId).filter((id): id is string => Boolean(id)),
    hospitalIds: favorites.map((f) => f.hospitalId).filter((id): id is string => Boolean(id)),
  });
}

// POST /api/favorites { doctorId } | { hospitalId } — toggles the saved state, returns { saved: boolean }
export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Sign in to save" }, { status: 401 });

  let body: { doctorId?: string; hospitalId?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { doctorId, hospitalId } = body;
  if (!doctorId && !hospitalId) {
    return NextResponse.json({ error: "doctorId or hospitalId is required" }, { status: 400 });
  }

  const dbUser = await ensureClerkUserInDb(clerkId);
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Validate whichever target was supplied.
  if (doctorId) {
    const doctor = await db.doctor.findUnique({ where: { id: doctorId }, select: { id: true } });
    if (!doctor) return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  } else {
    const hospital = await db.hospital.findUnique({ where: { id: hospitalId }, select: { id: true } });
    if (!hospital) return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
  }

  const targetWhere = doctorId ? { doctorId } : { hospitalId: hospitalId! };

  const existing = await db.favorite.findFirst({ where: { userId: dbUser.id, ...targetWhere }, select: { id: true } });
  if (existing) {
    await db.favorite.delete({ where: { id: existing.id } });
    return NextResponse.json({ saved: false });
  }

  await db.favorite.create({
    data: { userId: dbUser.id, doctorId: doctorId ?? null, hospitalId: hospitalId ?? null },
  });
  return NextResponse.json({ saved: true }, { status: 201 });
}
