import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") || "all"; // all | upcoming | past
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(20, Math.max(5, parseInt(searchParams.get("pageSize") || "10", 10)));

  const dbUser = await db.user.findUnique({ where: { clerkId } });
  if (!dbUser) return NextResponse.json({ bookings: [], total: 0, hasMore: false });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let extraWhere = {};
  if (filter === "upcoming") {
    extraWhere = { scheduledAt: { gte: today } };
  } else if (filter === "past") {
    extraWhere = { scheduledAt: { lt: today } };
  }

  const where = { userId: dbUser.id, ...extraWhere };
  const totalAll = await db.booking.count({ where: { userId: dbUser.id } });

  const [total, raw] = await Promise.all([
    db.booking.count({ where }),
    db.booking.findMany({
      where,
      include: {
        hospital: {
          select: {
            name: true, slug: true, phone: true,
            location: { select: { city: true, district: true, area: true, addressLine: true } },
          },
        },
        doctor: { select: { fullName: true } },
        package: { select: { title: true, price: true, currency: true } },
        patient: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const bookings = raw.map((b) => ({
    id: b.id,
    status: b.status,
    scheduledAt: b.scheduledAt.toISOString(),
    slotTime: b.slotTime ?? null,
    amountPaid: b.amountPaid ?? null,
    currency: b.currency ?? null,
    mode: b.mode,
    hospital: b.hospital
      ? { name: b.hospital.name, slug: b.hospital.slug, phone: b.hospital.phone ?? null, location: b.hospital.location ?? null }
      : null,
    doctor: b.doctor ? { fullName: b.doctor.fullName } : null,
    package: b.package ? { title: b.package.title, price: b.package.price ?? null, currency: b.package.currency ?? null } : null,
    patient: b.patient ? { fullName: b.patient.fullName } : null,
  }));

  return NextResponse.json({ bookings, total, totalAll, page, pageSize, hasMore: page * pageSize < total });
}
