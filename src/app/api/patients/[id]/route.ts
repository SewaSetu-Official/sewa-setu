import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { BookingStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { ensureClerkUserInDb } from "@/lib/clerk-user-sync";

export const dynamic = "force-dynamic";

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [BookingStatus.REQUESTED, BookingStatus.CONFIRMED];

const GENDERS = ["Male", "Female", "Other"];

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
  if (isNaN(d.getTime()) || d.getTime() > Date.now()) return null;
  return d;
}

async function ownPatient(clerkId: string, id: string) {
  const dbUser = await ensureClerkUserInDb(clerkId);
  if (!dbUser) return { error: NextResponse.json({ error: "User not found" }, { status: 404 }) };
  const patient = await db.patient.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!patient) return { error: NextResponse.json({ error: "Family member not found" }, { status: 404 }) };
  if (patient.userId !== dbUser.id) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { dbUser };
}

// PATCH /api/patients/:id — edit a family member
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owned = await ownPatient(clerkId, id);
  if (owned.error) return owned.error;

  let body: { fullName?: string; gender?: string; dateOfBirth?: string | null; phone?: string | null; notes?: string | null };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const data: Record<string, unknown> = {};

  if (body.fullName !== undefined) {
    const name = cleanName(body.fullName);
    if (!name) return NextResponse.json({ error: "A valid name (2–100 characters) is required" }, { status: 400 });
    data.fullName = name;
  }
  if (body.gender !== undefined) data.gender = body.gender && GENDERS.includes(body.gender) ? body.gender : null;
  if (body.dateOfBirth !== undefined) data.dateOfBirth = cleanDob(body.dateOfBirth);
  if (body.phone !== undefined) data.phone = cleanPhone(body.phone);
  if (body.notes !== undefined) data.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 300) : null;

  const updated = await db.patient.update({
    where: { id },
    data,
    select: {
      id: true, fullName: true, gender: true, dateOfBirth: true, phone: true, notes: true,
      _count: { select: { bookings: true } },
    },
  });

  const activeBookingCount = await db.booking.count({
    where: { patientId: id, status: { in: ACTIVE_BOOKING_STATUSES } },
  });

  return NextResponse.json({
    id: updated.id,
    fullName: updated.fullName,
    gender: updated.gender,
    dateOfBirth: updated.dateOfBirth ? updated.dateOfBirth.toISOString() : null,
    phone: updated.phone,
    notes: updated.notes,
    bookingCount: updated._count.bookings,
    activeBookingCount,
  });
}

// DELETE /api/patients/:id — remove a family member.
// Blocked while they have a live (upcoming/not-yet-completed) appointment. Otherwise:
// Booking.patientId cascades, so to preserve past appointment history we soft-archive members
// who have any bookings (hidden from lists, history intact) and hard-delete those with none.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owned = await ownPatient(clerkId, id);
  if (owned.error) return owned.error;

  const activeCount = await db.booking.count({
    where: { patientId: id, status: { in: ACTIVE_BOOKING_STATUSES } },
  });
  if (activeCount > 0) {
    return NextResponse.json(
      { error: "This member has an upcoming appointment. You can remove them once it's completed." },
      { status: 409 },
    );
  }

  const bookingCount = await db.booking.count({ where: { patientId: id } });
  if (bookingCount > 0) {
    await db.patient.update({ where: { id }, data: { archivedAt: new Date() } });
    return NextResponse.json({ ok: true, archived: true });
  }

  await db.patient.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
