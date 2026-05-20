import { NextResponse } from "next/server";
import { requireHospitalAccess, writeAuditLog } from "@/lib/admin-auth";
import { buildRollingOccurrences, formatDate } from "@/lib/availability";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateKey(date: Date) {
  return formatDate(date);
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  return hour * 60 + minute;
}

function windowsOverlap(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && startB < endA;
}

// GET /api/admin/h/[slug]/availability
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let ctx;
  try { ctx = await requireHospitalAccess(slug, "VIEW_AVAILABILITY", { apiMode: true }); }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "UNAUTHORIZED";
    return NextResponse.json({ error: msg }, { status: msg === "FORBIDDEN" ? 403 : 401 });
  }

  const hospitalId = ctx.membership.hospitalId;
  const isDoctorRole = ctx.membership.role === "DOCTOR";
  const doctorProfile = isDoctorRole
    ? await db.doctor.findFirst({
        where: {
          userId: ctx.user.id,
          hospitals: { some: { hospitalId } },
        },
        select: { id: true, fullName: true },
      })
    : null;
  const { searchParams } = new URL(req.url);
  const requestedDepartmentId = searchParams.get("departmentId") ?? "all";
  const requestedDoctorId = searchParams.get("doctorId");
  const requestedViewMode = searchParams.get("viewMode") === "all" ? "all" : "single";
  const startParam = searchParams.get("start");
  const requestedStart = startParam ? new Date(`${startParam}T00:00:00`) : new Date();
  const rangeStart = Number.isNaN(requestedStart.getTime()) ? startOfDay(new Date()) : startOfDay(requestedStart);
  const rangeEnd = addDays(rangeStart, 7);
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(rangeStart, index);
    return {
      date: dateKey(date),
      dayOfWeek: date.getDay(),
      label: date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
    };
  });

  const doctorRoster = await db.doctorHospital.findMany({
    where: {
      hospitalId,
      ...(isDoctorRole ? { doctorId: doctorProfile?.id ?? "__NO_DOCTOR_PROFILE__" } : {}),
    },
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
          departments: {
            where: { isActive: true, department: { hospitalId, isActive: true } },
            include: { department: { select: { id: true, name: true, sortOrder: true } } },
            orderBy: [
              { department: { sortOrder: "asc" } },
              { sortOrder: "asc" },
              { department: { name: "asc" } },
            ],
          },
        },
      },
    },
    orderBy: [{ doctor: { fullName: "asc" } }],
  });

  const departments = Array.from(
    new Map(
      doctorRoster
        .flatMap(({ doctor }) =>
          doctor.departments.map((entry) => ({
            id: entry.department.id,
            name: entry.department.name,
            sortOrder: entry.department.sortOrder,
          })),
        )
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        .map((department) => [department.id, department]),
    ).values(),
  );

  const doctorOptions = doctorRoster
    .map(({ doctor }) => ({
      doctorId: doctor.id,
      doctorName: doctor.fullName,
      specialty: doctor.specialties[0]?.specialty.name ?? null,
      department: doctor.departments[0]
        ? {
            id: doctor.departments[0].department.id,
            name: doctor.departments[0].department.name,
            sortOrder: doctor.departments[0].department.sortOrder,
          }
        : null,
    }))
    .filter((doctor) => requestedDepartmentId === "all" || doctor.department?.id === requestedDepartmentId)
    .sort((a, b) => {
      const departmentDelta = (a.department?.sortOrder ?? 9999) - (b.department?.sortOrder ?? 9999);
      if (departmentDelta !== 0) return departmentDelta;
      const departmentNameDelta = (a.department?.name ?? "Unassigned").localeCompare(b.department?.name ?? "Unassigned");
      if (departmentNameDelta !== 0) return departmentNameDelta;
      return a.doctorName.localeCompare(b.doctorName);
    });

  const selectedDoctorId = isDoctorRole
    ? doctorProfile?.id ?? null
    : requestedViewMode === "all"
      ? null
      : doctorOptions.some((doctor) => doctor.doctorId === requestedDoctorId)
        ? requestedDoctorId ?? null
        : doctorOptions[0]?.doctorId ?? null;

  const activeDoctorIds = isDoctorRole
    ? doctorProfile?.id
      ? [doctorProfile.id]
      : []
    : requestedViewMode === "all"
      ? doctorOptions.map((doctor) => doctor.doctorId)
      : selectedDoctorId
        ? [selectedDoctorId]
        : [];

  const doctorScope =
    activeDoctorIds.length > 0
      ? { doctorId: { in: activeDoctorIds } }
      : { doctorId: "__NO_DOCTOR_PROFILE__" };

  const [slots, bookings] = await Promise.all([
    db.availabilitySlot.findMany({
      where: { hospitalId, ...doctorScope },
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
            departments: {
              where: { isActive: true, department: { hospitalId, isActive: true } },
              include: { department: { select: { id: true, name: true, sortOrder: true } } },
              orderBy: [
                { department: { sortOrder: "asc" } },
                { sortOrder: "asc" },
                { department: { name: "asc" } },
              ],
            },
          },
        },
      },
      orderBy: [{ doctor: { fullName: "asc" } }, { dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    db.booking.findMany({
      where: {
        hospitalId,
        ...doctorScope,
        scheduledAt: { gte: rangeStart, lt: rangeEnd },
        status: { not: "DRAFT" },
      },
      select: {
        id: true,
        doctorId: true,
        availabilitySlotId: true,
        mode: true,
        scheduledAt: true,
        slotTime: true,
        status: true,
        checkedInAt: true,
        patient: {
          select: {
            fullName: true,
            phone: true,
          },
        },
        doctor: {
          select: {
            id: true,
            fullName: true,
            specialties: {
              where: { isPrimary: true },
              include: { specialty: { select: { name: true } } },
              take: 1,
            },
            departments: {
              where: { isActive: true, department: { hospitalId, isActive: true } },
              include: { department: { select: { id: true, name: true, sortOrder: true } } },
              orderBy: [
                { department: { sortOrder: "asc" } },
                { sortOrder: "asc" },
                { department: { name: "asc" } },
              ],
            },
          },
        },
      },
      orderBy: [{ scheduledAt: "asc" }, { slotTime: "asc" }],
    }),
  ]);

  // Group by doctor
  const doctorMap: Record<string, {
    doctorId: string;
    doctorName: string;
    specialty: string | null;
    department: {
      id: string;
      name: string;
      sortOrder: number;
    } | null;
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
    occurrences: {
      date: string;
      dayOfWeek: number;
      mode: string;
      startTime: string;
      endTime: string;
      doctorId: string;
      windowId: string;
      bookingId: string | null;
      bookingStatus: string | null;
      patientName: string | null;
      patientPhone: string | null;
    }[];
    appointments: {
      id: string;
      date: string;
      mode: string;
      scheduledAt: string;
      slotTime: string | null;
      status: string;
      checkedInAt: string | null;
      patientName: string;
      patientPhone: string | null;
    }[];
  }> = {};

  for (const slot of slots) {
    const did = slot.doctorId;
    if (!doctorMap[did]) {
      doctorMap[did] = {
        doctorId: did,
        doctorName: slot.doctor.fullName,
        specialty: slot.doctor.specialties[0]?.specialty.name ?? null,
        department: slot.doctor.departments[0]
          ? {
              id: slot.doctor.departments[0].department.id,
              name: slot.doctor.departments[0].department.name,
              sortOrder: slot.doctor.departments[0].department.sortOrder,
            }
          : null,
        slots: [],
        occurrences: [],
        appointments: [],
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

  for (const booking of bookings) {
    if (!booking.doctorId || !booking.doctor) continue;
    const did = booking.doctorId;
    if (!doctorMap[did]) {
      doctorMap[did] = {
        doctorId: did,
        doctorName: booking.doctor.fullName,
        specialty: booking.doctor.specialties[0]?.specialty.name ?? null,
        department: booking.doctor.departments[0]
          ? {
              id: booking.doctor.departments[0].department.id,
              name: booking.doctor.departments[0].department.name,
              sortOrder: booking.doctor.departments[0].department.sortOrder,
            }
          : null,
        slots: [],
        occurrences: [],
        appointments: [],
      };
    }

    doctorMap[did].appointments.push({
      id: booking.id,
      date: dateKey(booking.scheduledAt),
      mode: booking.mode,
      scheduledAt: booking.scheduledAt.toISOString(),
      slotTime: booking.slotTime,
      status: booking.status,
      checkedInAt: booking.checkedInAt?.toISOString() ?? null,
      patientName: booking.patient.fullName,
      patientPhone: booking.patient.phone,
    });
  }

  const bookingBySlotDate = new Map(
    bookings
      .filter((booking) => booking.availabilitySlotId && booking.status !== "CANCELLED")
      .map((booking) => [`${booking.availabilitySlotId}::${dateKey(booking.scheduledAt)}`, booking]),
  );

  const rolling = buildRollingOccurrences(
    slots.map((slot) => ({
      id: slot.id,
      doctorId: slot.doctorId,
      hospitalId: slot.hospitalId,
      mode: slot.mode,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      slotDurationMinutes: slot.slotDurationMinutes,
      isActive: slot.isActive,
    })),
    rangeStart,
    7,
  );

  for (const occurrences of Object.values(rolling.occurrencesByDate)) {
    for (const occurrence of occurrences) {
      const doctor = doctorMap[occurrence.doctorId];
      if (!doctor) continue;

      const booking = bookingBySlotDate.get(`${occurrence.windowId}::${occurrence.date}`);
      doctor.occurrences.push({
        date: occurrence.date,
        dayOfWeek: occurrence.dayOfWeek,
        mode: occurrence.mode,
        startTime: occurrence.startTime,
        endTime: occurrence.endTime,
        doctorId: occurrence.doctorId,
        windowId: occurrence.windowId,
        bookingId: booking?.id ?? null,
        bookingStatus: booking?.status ?? null,
        patientName: booking?.patient.fullName ?? null,
        patientPhone: booking?.patient.phone ?? null,
      });
    }
  }

  const doctors = Object.values(doctorMap).sort((a, b) => {
    const departmentDelta = (a.department?.sortOrder ?? 9999) - (b.department?.sortOrder ?? 9999);
    if (departmentDelta !== 0) return departmentDelta;
    const departmentNameDelta = (a.department?.name ?? "Unassigned").localeCompare(b.department?.name ?? "Unassigned");
    if (departmentNameDelta !== 0) return departmentNameDelta;
    return a.doctorName.localeCompare(b.doctorName);
  });

  return NextResponse.json({
    role: ctx.membership.role,
    doctorName: doctorProfile?.fullName ?? null,
    departments,
    doctorOptions,
    selectedDoctorId,
    viewMode: isDoctorRole ? "single" : requestedViewMode,
    dates,
    doctors,
  });
}

// POST /api/admin/h/[slug]/availability - create weekly availability window
export async function POST(
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

  let body: {
    doctorId?: string;
    dayOfWeek?: number;
    mode?: "ONLINE" | "PHYSICAL";
    startTime?: string;
    endTime?: string;
    slotDurationMinutes?: number;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const doctorId = body.doctorId?.trim();
  const dayOfWeek = Number(body.dayOfWeek);
  const mode = body.mode;
  const startTime = body.startTime?.trim();
  const endTime = body.endTime?.trim();
  const slotDurationMinutes = Number(body.slotDurationMinutes ?? 30);

  if (!doctorId || !mode || !startTime || !endTime) {
    return NextResponse.json({ error: "doctorId, mode, startTime and endTime are required" }, { status: 400 });
  }
  if (!["ONLINE", "PHYSICAL"].includes(mode)) {
    return NextResponse.json({ error: "Invalid consultation mode" }, { status: 400 });
  }
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return NextResponse.json({ error: "Invalid day of week" }, { status: 400 });
  }
  if (!Number.isInteger(slotDurationMinutes) || slotDurationMinutes < 5 || slotDurationMinutes > 240) {
    return NextResponse.json({ error: "Slot duration must be between 5 and 240 minutes" }, { status: 400 });
  }

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
    return NextResponse.json({ error: "Invalid time window" }, { status: 400 });
  }
  if ((endMinutes - startMinutes) < slotDurationMinutes) {
    return NextResponse.json({ error: "Window must be at least one slot duration long" }, { status: 400 });
  }

  const doctorHospital = await db.doctorHospital.findUnique({
    where: { doctorId_hospitalId: { doctorId, hospitalId: ctx.membership.hospitalId } },
    select: { doctorId: true },
  });
  if (!doctorHospital) {
    return NextResponse.json({ error: "Doctor is not assigned to this hospital" }, { status: 404 });
  }

  const existingSlots = await db.availabilitySlot.findMany({
    where: { doctorId, hospitalId: ctx.membership.hospitalId, mode, dayOfWeek },
    select: { startTime: true, endTime: true },
  });
  const conflict = existingSlots.find((slot) => {
    const existingStart = timeToMinutes(slot.startTime);
    const existingEnd = timeToMinutes(slot.endTime);
    return existingStart !== null && existingEnd !== null && windowsOverlap(startMinutes, endMinutes, existingStart, existingEnd);
  });
  if (conflict) {
    return NextResponse.json({ error: "This schedule overlaps an existing window" }, { status: 409 });
  }

  const slot = await db.availabilitySlot.create({
    data: {
      doctorId,
      hospitalId: ctx.membership.hospitalId,
      mode,
      dayOfWeek,
      startTime,
      endTime,
      slotDurationMinutes,
      isActive: true,
    },
  });

  await writeAuditLog({
    actorUserId: ctx.user.id,
    hospitalId: ctx.membership.hospitalId,
    action: "SLOT_CREATED",
    entity: "AvailabilitySlot",
    entityId: slot.id,
    after: { doctorId, mode, dayOfWeek, startTime, endTime, slotDurationMinutes },
  });

  return NextResponse.json({ success: true, slot }, { status: 201 });
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

  let body: {
    slotId?: string;
    isActive?: boolean;
    dayOfWeek?: number;
    mode?: "ONLINE" | "PHYSICAL";
    startTime?: string;
    endTime?: string;
    slotDurationMinutes?: number;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { slotId, isActive } = body;
  if (!slotId) {
    return NextResponse.json({ error: "slotId is required" }, { status: 400 });
  }

  const slot = await db.availabilitySlot.findFirst({
    where: { id: slotId, hospitalId: ctx.membership.hospitalId },
  });
  if (!slot) return NextResponse.json({ error: "Slot not found" }, { status: 404 });

  const nextDayOfWeek = body.dayOfWeek === undefined ? slot.dayOfWeek : Number(body.dayOfWeek);
  const nextMode = body.mode ?? slot.mode;
  const nextStartTime = body.startTime?.trim() ?? slot.startTime;
  const nextEndTime = body.endTime?.trim() ?? slot.endTime;
  const nextSlotDuration = body.slotDurationMinutes === undefined ? slot.slotDurationMinutes : Number(body.slotDurationMinutes);

  if (!["ONLINE", "PHYSICAL"].includes(nextMode)) {
    return NextResponse.json({ error: "Invalid consultation mode" }, { status: 400 });
  }
  if (!Number.isInteger(nextDayOfWeek) || nextDayOfWeek < 0 || nextDayOfWeek > 6) {
    return NextResponse.json({ error: "Invalid day of week" }, { status: 400 });
  }
  if (!Number.isInteger(nextSlotDuration) || nextSlotDuration < 5 || nextSlotDuration > 240) {
    return NextResponse.json({ error: "Slot duration must be between 5 and 240 minutes" }, { status: 400 });
  }

  const startMinutes = timeToMinutes(nextStartTime);
  const endMinutes = timeToMinutes(nextEndTime);
  if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
    return NextResponse.json({ error: "Invalid time window" }, { status: 400 });
  }
  if ((endMinutes - startMinutes) < nextSlotDuration) {
    return NextResponse.json({ error: "Window must be at least one slot duration long" }, { status: 400 });
  }

  const existingSlots = await db.availabilitySlot.findMany({
    where: {
      doctorId: slot.doctorId,
      hospitalId: ctx.membership.hospitalId,
      mode: nextMode,
      dayOfWeek: nextDayOfWeek,
      id: { not: slotId },
    },
    select: { startTime: true, endTime: true },
  });
  const conflict = existingSlots.find((existing) => {
    const existingStart = timeToMinutes(existing.startTime);
    const existingEnd = timeToMinutes(existing.endTime);
    return existingStart !== null && existingEnd !== null && windowsOverlap(startMinutes, endMinutes, existingStart, existingEnd);
  });
  if (conflict) {
    return NextResponse.json({ error: "This schedule overlaps an existing window" }, { status: 409 });
  }

  const updateData = {
    dayOfWeek: nextDayOfWeek,
    mode: nextMode,
    startTime: nextStartTime,
    endTime: nextEndTime,
    slotDurationMinutes: nextSlotDuration,
    ...(isActive === undefined ? {} : { isActive }),
  };

  const updated = await db.availabilitySlot.update({
    where: { id: slotId },
    data: updateData,
  });

  const scheduleChanged =
    slot.dayOfWeek !== updated.dayOfWeek ||
    slot.mode !== updated.mode ||
    slot.startTime !== updated.startTime ||
    slot.endTime !== updated.endTime ||
    slot.slotDurationMinutes !== updated.slotDurationMinutes;

  await writeAuditLog({
    actorUserId: ctx.user.id,
    hospitalId: ctx.membership.hospitalId,
    action: scheduleChanged
      ? "SLOT_UPDATED"
      : updated.isActive
        ? "SLOT_ACTIVATED"
        : "SLOT_DEACTIVATED",
    entity: "AvailabilitySlot",
    entityId: slotId,
    before: {
      dayOfWeek: slot.dayOfWeek,
      mode: slot.mode,
      startTime: slot.startTime,
      endTime: slot.endTime,
      slotDurationMinutes: slot.slotDurationMinutes,
      isActive: slot.isActive,
    },
    after: {
      dayOfWeek: updated.dayOfWeek,
      mode: updated.mode,
      startTime: updated.startTime,
      endTime: updated.endTime,
      slotDurationMinutes: updated.slotDurationMinutes,
      isActive: updated.isActive,
    },
  });

  return NextResponse.json({ success: true, slot: updated });
}
