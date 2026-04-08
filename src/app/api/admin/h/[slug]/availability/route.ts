import { NextResponse } from "next/server";
import { requireHospitalAccess, writeAuditLog } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// GET /api/admin/h/[slug]/availability
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let ctx;
  try { ctx = await requireHospitalAccess(slug, "MANAGE_AVAILABILITY", { apiMode: true }); }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ error: msg }, { status: msg === "FORBIDDEN" ? 403 : 401 });
  }

  const hospitalId = ctx.membership.hospitalId;

  const slots = await db.availabilitySlot.findMany({
    where: { hospitalId },
    include: {
      doctor: {
        select: {
          id: true,
          fullName: true,
          specialties: {
            where: { isPrimary: true },
            include: { specialty: { select: { name: true } } },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ doctor: { fullName: "asc" } }, { dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  // Group by doctor
  const doctorMap: Record<string, {
    doctorId: string;
    doctorName: string;
    specialty: string | null;
    slots: {
      id: string;
      dayOfWeek: number;
      dayLabel: string;
      mode: string;
      startTime: string;
      endTime: string;
      slotDurationMinutes: number;
      isActive: boolean;
    }[];
  }> = {};

  for (const slot of slots) {
    const did = slot.doctorId;
    if (!doctorMap[did]) {
      doctorMap[did] = {
        doctorId: did,
        doctorName: slot.doctor.fullName,
        specialty: slot.doctor.specialties[0]?.specialty.name ?? null,
        slots: [],
      };
    }
    doctorMap[did].slots.push({
      id: slot.id,
      dayOfWeek: slot.dayOfWeek,
      dayLabel: DAYS[slot.dayOfWeek] ?? String(slot.dayOfWeek),
      mode: slot.mode,
      startTime: slot.startTime,
      endTime: slot.endTime,
      slotDurationMinutes: slot.slotDurationMinutes,
      isActive: slot.isActive,
    });
  }

  return NextResponse.json({ doctors: Object.values(doctorMap) });
}

// PATCH /api/admin/h/[slug]/availability — toggle slot active/inactive
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let ctx;
  try { ctx = await requireHospitalAccess(slug, "MANAGE_AVAILABILITY", { apiMode: true }); }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ error: msg }, { status: msg === "FORBIDDEN" ? 403 : 401 });
  }

  let body: { slotId?: string; isActive?: boolean };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { slotId, isActive } = body;
  if (!slotId || isActive === undefined) {
    return NextResponse.json({ error: "slotId and isActive are required" }, { status: 400 });
  }

  const slot = await db.availabilitySlot.findFirst({
    where: { id: slotId, hospitalId: ctx.membership.hospitalId },
  });
  if (!slot) return NextResponse.json({ error: "Slot not found" }, { status: 404 });

  const updated = await db.availabilitySlot.update({
    where: { id: slotId },
    data: { isActive },
  });

  await writeAuditLog({
    actorUserId: ctx.user.id,
    hospitalId: ctx.membership.hospitalId,
    action: isActive ? "SLOT_ACTIVATED" : "SLOT_DEACTIVATED",
    entity: "AvailabilitySlot",
    entityId: slotId,
    before: { isActive: slot.isActive },
    after: { isActive: updated.isActive },
  });

  return NextResponse.json({ success: true, isActive: updated.isActive });
}
