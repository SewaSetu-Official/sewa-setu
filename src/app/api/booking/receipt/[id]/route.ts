import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/booking/receipt/:id — auth required, owner only
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Booking ID required" }, { status: 400 });

  const booking = await db.booking.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      slotTime: true,
      mode: true,
      amountPaid: true,
      currency: true,
      user: { select: { clerkId: true } },
      hospital: { select: { name: true } },
      doctor:   { select: { fullName: true } },
      package:  { select: { title: true } },
      patient:  { select: { fullName: true, phone: true, gender: true, disability: true, dateOfBirth: true } },
    },
  });

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.user.clerkId !== clerkId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const dob = booking.patient?.dateOfBirth;
  const age = dob
    ? String(new Date().getFullYear() - new Date(dob).getFullYear())
    : "";

  const doctorConsultationTitle = booking.doctor?.fullName
    ? `Consultation — ${booking.doctor.fullName}`
    : undefined;

  return NextResponse.json({
    fullId:             booking.id,
    id:                 booking.id.slice(-10).toUpperCase(),
    patientName:        booking.patient?.fullName ?? "",
    patientAge:         age,
    patientGender:      booking.patient?.gender ?? "",
    patientDisability:  booking.patient?.disability ?? "",
    patientPhone:       booking.patient?.phone ?? "",
    packageName:        booking.package?.title ?? doctorConsultationTitle ?? "",
    hospitalName:       booking.hospital?.name ?? "",
    bookingDate:        booking.scheduledAt.toISOString(),
    slotTime:           booking.slotTime ?? "",
    consultationMode:   booking.mode,
    amountPaid:         booking.amountPaid != null
      ? `€${(booking.amountPaid / 100).toFixed(2)}`
      : "",
    type:               booking.package ? "package" : "doctor",
  });
}
