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

  const doctorHospitals = await db.doctorHospital.findMany({
    where: { hospitalId },
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
          availability: {
            where: { hospitalId, isActive: true },
            select: { id: true },
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

  const doctors = doctorHospitals.map(({ doctor, positionTitle }) => ({
    id: doctor.id,
    fullName: doctor.fullName,
    gender: doctor.gender ?? null,
    experienceYears: doctor.experienceYears ?? null,
    licenseNumber: doctor.licenseNumber ?? null,
    verified: doctor.verified,
    positionTitle: positionTitle ?? null,
    primarySpecialty: doctor.specialties[0]?.specialty.name ?? null,
    photoUrl: doctor.media[0]?.url ?? null,
    activeSlots: doctor.availability.length,
    bookingCount: doctor._count.bookings,
    feeMin: doctor.feeMin ?? null,
    feeMax: doctor.feeMax ?? null,
    currency: doctor.currency ?? "EUR",
    consultationModes: doctor.consultationModes ?? null,
  }));

  return NextResponse.json({ doctors });
}
