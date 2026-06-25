import { NextResponse } from "next/server";
import { HospitalType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const q = (searchParams.get("q") || "").trim();
  const city = (searchParams.get("city") || "").trim();
  const district = (searchParams.get("district") || "").trim();
  const country = (searchParams.get("country") || "").trim();
  const type = (searchParams.get("type") || "").trim();
  const emergency = searchParams.get("emergency");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  const specialty = (searchParams.get("specialty") || "").trim();
  const sortBy = searchParams.get("sortBy") || "recent";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(24, Math.max(6, parseInt(searchParams.get("pageSize") || "12", 10)));

  // Base conditions exclude the type filter so we can compute per-type facet counts.
  const baseConditions: Prisma.HospitalWhereInput[] = [];

  if (q) {
    baseConditions.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { servicesSummary: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (city) baseConditions.push({ location: { city: { equals: city, mode: "insensitive" } } });
  if (district) baseConditions.push({ location: { district: { equals: district, mode: "insensitive" } } });
  if (country) baseConditions.push({ location: { country: { equals: country, mode: "insensitive" } } });

  if (emergency === "true") {
    baseConditions.push({ emergencyAvailable: true });
  }

  if (specialty) {
    baseConditions.push({
      OR: [
        // Hospital has a department linked to this specialty slug
        { departments: { some: { specialty: { slug: specialty } } } },
        // Hospital has a doctor with this specialty
        { doctors: { some: { doctor: { specialties: { some: { specialty: { slug: specialty } } } } } } },
      ],
    });
  }

  const typeValid = type && ["HOSPITAL", "CLINIC", "LAB"].includes(type.toUpperCase());
  const whereConditions: Prisma.HospitalWhereInput[] = typeValid
    ? [...baseConditions, { type: type.toUpperCase() as HospitalType }]
    : baseConditions;

  // Price filters apply to PACKAGES now
  const packageFilters: Prisma.HospitalPackageWhereInput[] = [{ isActive: true }];
  if (minPrice) packageFilters.push({ price: { gte: parseInt(minPrice, 10) } });
  if (maxPrice) packageFilters.push({ price: { lte: parseInt(maxPrice, 10) } });

  let orderBy: Prisma.HospitalOrderByWithRelationInput = { createdAt: "desc" };
  if (sortBy === "name") orderBy = { name: "asc" };

  const whereBase = baseConditions.length > 0 ? { AND: baseConditions } : undefined;
  const where = whereConditions.length > 0 ? { AND: whereConditions } : undefined;

  const isPriceSort = sortBy === "price-low" || sortBy === "price-high";

  // For price-based sorts we must fetch all matching rows first (sort is post-DB)
  const [total, typeGroups, raw] = await Promise.all([
    db.hospital.count({ where }),
    db.hospital.groupBy({ by: ["type"], where: whereBase, _count: { _all: true } }),
    db.hospital.findMany({
      where,
      include: {
        location: true,
        media: { where: { isPrimary: true }, take: 1 },
        packages: {
          where: { AND: packageFilters },
          orderBy: [{ price: "asc" }],
          take: 1,
        },
      },
      orderBy: isPriceSort ? undefined : orderBy,
      skip: isPriceSort ? 0 : (page - 1) * pageSize,
      take: isPriceSort ? undefined : pageSize,
    }),
  ]);

  const ids = raw.map((h) => h.id);
  const aggs = await db.review.groupBy({
    by: ["hospitalId"],
    where: { hospitalId: { in: ids } },
    _avg: { rating: true },
    _count: { rating: true },
  });
  const aggMap = Object.fromEntries(aggs.map((a) => [a.hospitalId, a]));

  let payload = raw.map((h) => ({
    id: h.id,
    slug: h.slug,
    name: h.name,
    type: h.type,
    rating: aggMap[h.id]?._avg.rating ? Math.round(aggMap[h.id]._avg.rating! * 10) / 10 : 0,
    reviewCount: aggMap[h.id]?._count.rating ?? 0,
    specialty: h.servicesSummary || "General",
    city: h.location.city,
    district: h.location.district,
    area: h.location.area,
    image: h.media[0]?.url || null,
    fromPrice: h.packages[0]?.price ?? null,
    currency: h.packages[0]?.currency ?? "EUR",
    emergencyAvailable: h.emergencyAvailable,
  }));

  if (sortBy === "price-low") {
    payload = payload.sort((a, b) => (a.fromPrice ?? 1e18) - (b.fromPrice ?? 1e18));
    payload = payload.slice((page - 1) * pageSize, page * pageSize);
  } else if (sortBy === "price-high") {
    payload = payload.sort((a, b) => (b.fromPrice ?? 1e18) - (a.fromPrice ?? 1e18));
    payload = payload.slice((page - 1) * pageSize, page * pageSize);
  }

  const typeCounts = { HOSPITAL: 0, CLINIC: 0, LAB: 0 } as Record<"HOSPITAL" | "CLINIC" | "LAB", number>;
  for (const g of typeGroups) {
    if (g.type in typeCounts) typeCounts[g.type as keyof typeof typeCounts] = g._count._all;
  }
  const allCount = typeCounts.HOSPITAL + typeCounts.CLINIC + typeCounts.LAB;

  return NextResponse.json({
    hospitals: payload,
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
    typeCounts: { all: allCount, ...typeCounts },
  });
}
