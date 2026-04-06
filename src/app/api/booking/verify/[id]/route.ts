import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/booking/verify/:id — public, no auth required (used by QR scan at reception)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
      createdAt: true,
      hospital: { select: { name: true, slug: true, location: { select: { city: true, addressLine: true } } } },
      doctor:   { select: { fullName: true } },
      package:  { select: { title: true } },
      patient:  { select: { fullName: true, phone: true } },
    },
  });

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  return NextResponse.json({
    id:              booking.id,
    displayId:       booking.id.slice(-10).toUpperCase(),
    status:          booking.status,
    scheduledAt:     booking.scheduledAt.toISOString(),
    slotTime:        booking.slotTime ?? null,
    mode:            booking.mode,
    amountPaid:      booking.amountPaid ?? null,
    currency:        booking.currency ?? null,
    createdAt:       booking.createdAt.toISOString(),
    hospital:        booking.hospital ? {
      name:        booking.hospital.name,
      city:        booking.hospital.location?.city ?? null,
      addressLine: booking.hospital.location?.addressLine ?? null,
    } : null,
    doctor:          booking.doctor  ? { fullName: booking.doctor.fullName }  : null,
    package:         booking.package ? { title:    booking.package.title }    : null,
    patient:         booking.patient ? { fullName: booking.patient.fullName, phone: booking.patient.phone ?? null } : null,
  });
}
