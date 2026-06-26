import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { BookingStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { ensureClerkUserInDb } from "@/lib/clerk-user-sync";

export const dynamic = "force-dynamic";

const GENDERS = ["Male", "Female", "Other"];

// Bookings that are still "live" (not completed/cancelled) — these block removing a family member.
export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [BookingStatus.REQUESTED, BookingStatus.CONFIRMED];

function cleanName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length < 2 || t.length > 100) return null;
  return t.replace(/<[^>]*>/g, "").trim();
}

function cleanPhone(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const digits = v.replace(/[\s\-().+]/g, "");
  return /^\d{7,15}$/.test(digits) ? digits : null;
}

function cleanDob(v: unknown): Date | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  if (d.getTime() > Date.now()) return null; // not in the future
  return d;
}

// GET /api/patients — list the signed-in user's family members
export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ patients: [] });

  const dbUser = await ensureClerkUserInDb(clerkId);
  if (!dbUser) return NextResponse.json({ patients: [] });

  const rows = await db.patient.findMany({
    where: { userId: dbUser.id, archivedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, fullName: true, gender: true, dateOfBirth: true, phone: true, notes: true,
      _count: { select: { bookings: true } },
    },
  });

  const ids = rows.map((r) => r.id);
  const activeAgg = ids.length
    ? await db.booking.groupBy({
        by: ["patientId"],
        where: { patientId: { in: ids }, status: { in: ACTIVE_BOOKING_STATUSES } },
        _count: { _all: true },
      })
    : [];
  const activeMap = Object.fromEntries(activeAgg.map((a) => [a.patientId, a._count._all]));

  const patients = rows.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    gender: p.gender,
    dateOfBirth: p.dateOfBirth ? p.dateOfBirth.toISOString() : null,
    phone: p.phone,
    notes: p.notes,
    bookingCount: p._count.bookings,
    activeBookingCount: activeMap[p.id] ?? 0,
  }));

  return NextResponse.json({ patients });
}

// POST /api/patients — add a family member
export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Sign in to add a family member" }, { status: 401 });

  let body: { fullName?: string; gender?: string; dateOfBirth?: string; phone?: string; notes?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const fullName = cleanName(body.fullName);
  if (!fullName) return NextResponse.json({ error: "A valid name (2–100 characters) is required" }, { status: 400 });

  const dbUser = await ensureClerkUserInDb(clerkId);
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const gender = body.gender && GENDERS.includes(body.gender) ? body.gender : null;
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 300) : null;

  const created = await db.patient.create({
    data: {
      userId: dbUser.id,
      fullName,
      gender,
      dateOfBirth: cleanDob(body.dateOfBirth),
      phone: cleanPhone(body.phone),
      notes,
    },
    select: { id: true, fullName: true, gender: true, dateOfBirth: true, phone: true, notes: true },
  });

  return NextResponse.json({
    ...created,
    dateOfBirth: created.dateOfBirth ? created.dateOfBirth.toISOString() : null,
    bookingCount: 0,
    activeBookingCount: 0,
  }, { status: 201 });
}
