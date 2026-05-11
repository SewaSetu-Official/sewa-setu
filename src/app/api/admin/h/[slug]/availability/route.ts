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
