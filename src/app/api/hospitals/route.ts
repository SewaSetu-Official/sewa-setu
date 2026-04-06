import { NextResponse } from "next/server";
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

  const whereConditions: any[] = [];

  if (q) {
    whereConditions.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { servicesSummary: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (city) whereConditions.push({ location: { city: { equals: city, mode: "insensitive" } } });
  if (district) whereConditions.push({ location: { district: { equals: district, mode: "insensitive" } } });
  if (country) whereConditions.push({ location: { country: { equals: country, mode: "insensitive" } } });

  if (type && ["HOSPITAL", "CLINIC", "LAB"].includes(type.toUpperCase())) {
    whereConditions.push({ type: type.toUpperCase() as any });
  }

  if (emergency === "true") {
    whereConditions.push({ emergencyAvailable: true });
  }

  if (specialty) {
    whereConditions.push({
      OR: [
        // Hospital has a department linked to this specialty slug
        { departments: { some: { specialty: { slug: specialty } } } },
        // Hospital has a doctor with this specialty
        { doctors: { some: { doctor: { specialties: { some: { specialty: { slug: specialty } } } } } } },
      ],
    });
  }

  // Price filters apply to PACKAGES now
  const packageFilters: any[] = [{ isActive: true }];
  if (minPrice) packageFilters.push({ price: { gte: parseInt(minPrice, 10) } });
  if (maxPrice) packageFilters.push({ price: { lte: parseInt(maxPrice, 10) } });

  let orderBy: any = { createdAt: "desc" };
  if (sortBy === "name") orderBy = { name: "asc" };

  const where = whereConditions.length > 0 ? { AND: whereConditions } : undefined;

  const isPriceSort = sortBy === "price-low" || sortBy === "price-high";

  // For price-based sorts we must fetch all matching rows first (sort is post-DB)
  const [total, raw] = await Promise.all([
    db.hospital.count({ where }),
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
    currency: h.packages[0]?.currency ?? "NPR",
    emergencyAvailable: h.emergencyAvailable,
  }));

  if (sortBy === "price-low") {
    payload = payload.sort((a, b) => (a.fromPrice ?? 1e18) - (b.fromPrice ?? 1e18));
    payload = payload.slice((page - 1) * pageSize, page * pageSize);
  } else if (sortBy === "price-high") {
    payload = payload.sort((a, b) => (b.fromPrice ?? 1e18) - (a.fromPrice ?? 1e18));
    payload = payload.slice((page - 1) * pageSize, page * pageSize);
  }

  return NextResponse.json({
    hospitals: payload,
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  });
}