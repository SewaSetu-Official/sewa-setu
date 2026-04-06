import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Doctor ID required" }, { status: 400 });

  const doctor = await db.doctor.findUnique({
    where: { id },
    include: {
      media: true,
      specialties: { include: { specialty: true } },
      hospitals: {
        include: {
          hospital: {
            include: {
              location: { select: { city: true, district: true } },
              media: { where: { isPrimary: true }, take: 1 },
            },
          },
        },
      },
      departments: {
        where: { isActive: true },
        include: { department: { select: { name: true, hospital: { select: { name: true } } } } },
      },
      availability: { where: { isActive: true }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
    },
  });

  if (!doctor) return NextResponse.json({ error: "Doctor not found" }, { status: 404 });

  const primaryImage = doctor.media.find((m) => m.isPrimary)?.url ?? doctor.media[0]?.url ?? null;

  return NextResponse.json({
    id: doctor.id,
    fullName: doctor.fullName,
    gender: doctor.gender,
    experienceYears: doctor.experienceYears,
    education: doctor.education,
    bio: doctor.bio,
    languages: (doctor.languages as string[]) ?? [],
    consultationModes: (doctor.consultationModes as string[]) ?? [],
    licenseNumber: doctor.licenseNumber,
    feeMin: doctor.feeMin,
    feeMax: doctor.feeMax,
    currency: doctor.currency ?? "eur",
    verified: doctor.verified,
    image: primaryImage,
    specialties: doctor.specialties.map((ds) => ({
      id: ds.specialty.id,
      name: ds.specialty.name,
      slug: ds.specialty.slug,
      isPrimary: ds.isPrimary,
    })),
    hospitals: doctor.hospitals.map((dh) => ({
      id: dh.hospital.id,
      slug: dh.hospital.slug,
      name: dh.hospital.name,
      positionTitle: dh.positionTitle,
      isPrimary: dh.isPrimary,
      city: dh.hospital.location.city,
      district: dh.hospital.location.district,
      image: dh.hospital.media[0]?.url ?? null,
    })),
    availability: doctor.availability.map((s) => ({
      id: s.id,
      doctorId: s.doctorId,
      hospitalId: s.hospitalId,
      mode: s.mode,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      slotDurationMinutes: s.slotDurationMinutes,
      isActive: s.isActive,
    })),
  });
}
