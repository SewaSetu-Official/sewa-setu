import { NextResponse } from "next/server";
import { requireHospitalAccess } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/admin/h/[slug]/doctors
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let ctx;
  try { ctx = await requireHospitalAccess(slug, "VIEW_DOCTORS", { apiMode: true }); }
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

  const doctorHospitals = await db.doctorHospital.findMany({
    where: {
      hospitalId,
      ...(isDoctorRole ? { doctorId: doctorProfile?.id ?? "__NO_DOCTOR_PROFILE__" } : {}),
    },
    include: {
      doctor: {
        include: {
          specialties: {
            include: { specialty: { select: { name: true } } },
            where: { isPrimary: true },
            take: 1,
          },
          media: {
            where: { isPrimary: true },
            take: 1,
            select: { url: true },
          },
          user: {
            select: { id: true, email: true, fullName: true },
          },
          invites: {
            where: { status: "PENDING" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, email: true, expiresAt: true, createdAt: true },
          },
          availability: {
            where: { hospitalId, isActive: true },
            select: { id: true },
          },
          departments: {
            where: { isActive: true, department: { hospitalId, isActive: true } },
            include: {
              department: { select: { id: true, name: true, sortOrder: true } },
            },
            orderBy: [
              { department: { sortOrder: "asc" } },
              { sortOrder: "asc" },
              { department: { name: "asc" } },
            ],
          },
          _count: {
            select: {
              bookings: {
                where: { hospitalId, status: { in: ["CONFIRMED", "COMPLETED"] } },
              },
            },
          },
        },
      },
    },
    orderBy: { doctor: { fullName: "asc" } },
  });

  const doctors = doctorHospitals
    .map(({ doctor, positionTitle }) => {
      const primaryDepartment = doctor.departments[0] ?? null;

      return {
    id: doctor.id,
    fullName: doctor.fullName,
    gender: doctor.gender ?? null,
    experienceYears: doctor.experienceYears ?? null,
    licenseNumber: doctor.licenseNumber ?? null,
    verified: doctor.verified,
    positionTitle: positionTitle ?? null,
    linkedUser: doctor.user
      ? {
          id: doctor.user.id,
          email: doctor.user.email,
          fullName: doctor.user.fullName,
        }
      : null,
    pendingInvite: doctor.invites[0]
      ? {
          id: doctor.invites[0].id,
          email: doctor.invites[0].email,
          expiresAt: doctor.invites[0].expiresAt.toISOString(),
          createdAt: doctor.invites[0].createdAt.toISOString(),
        }
      : null,
    primaryDepartment: primaryDepartment
      ? {
          id: primaryDepartment.department.id,
          name: primaryDepartment.department.name,
          sortOrder: primaryDepartment.department.sortOrder,
          doctorSortOrder: primaryDepartment.sortOrder,
        }
      : null,
    departments: doctor.departments.map((entry) => ({
      id: entry.department.id,
      name: entry.department.name,
      sortOrder: entry.department.sortOrder,
      doctorSortOrder: entry.sortOrder,
    })),
    primarySpecialty: doctor.specialties[0]?.specialty.name ?? null,
    photoUrl: doctor.media[0]?.url ?? null,
    activeSlots: doctor.availability.length,
    bookingCount: doctor._count.bookings,
    feeMin: doctor.feeMin ?? null,
    feeMax: doctor.feeMax ?? null,
    currency: doctor.currency ?? "EUR",
    consultationModes: doctor.consultationModes ?? null,
      };
    })
    .sort((a, b) => {
      const departmentDelta = (a.primaryDepartment?.sortOrder ?? 9999) - (b.primaryDepartment?.sortOrder ?? 9999);
      if (departmentDelta !== 0) return departmentDelta;
      const departmentNameDelta = (a.primaryDepartment?.name ?? "Unassigned").localeCompare(b.primaryDepartment?.name ?? "Unassigned");
      if (departmentNameDelta !== 0) return departmentNameDelta;
      const doctorSortDelta = (a.primaryDepartment?.doctorSortOrder ?? 9999) - (b.primaryDepartment?.doctorSortOrder ?? 9999);
      if (doctorSortDelta !== 0) return doctorSortDelta;
      return a.fullName.localeCompare(b.fullName);
    });

  return NextResponse.json({
    role: ctx.membership.role,
    doctorName: doctorProfile?.fullName ?? null,
    doctors,
  });
}
