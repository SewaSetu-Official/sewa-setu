import { NextResponse } from "next/server";
import { HospitalType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Shape toPayload reads from — structurally matches every findMany below regardless of the
// where-filters on the included relations.
type HospitalRow = Prisma.HospitalGetPayload<{ include: { location: true; media: true; packages: true } }>;
type RatingAgg = Record<string, { _avg: { rating: number | null }; _count: { rating: number } }>;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const q = (searchParams.get("q") || "").trim();
  const city = (searchParams.get("city") || "").trim();
  const district = (searchParams.get("district") || "").trim();
  const country = (searchParams.get("country") || "").trim();
  const type = (searchParams.get("type") || "").trim();
  const emergency = searchParams.get("emergency");
  const verifiedOnly = searchParams.get("verified") === "true";
  const minRating = Math.max(0, parseFloat(searchParams.get("minRating") || "0") || 0);
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

  // `verified` is a real column, so it filters in the DB — counts/facets/pagination all stay correct.
  if (verifiedOnly) {
    baseConditions.push({ verified: true });
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
  const typeUpper = type.toUpperCase() as HospitalType;
  const whereConditions: Prisma.HospitalWhereInput[] = typeValid
    ? [...baseConditions, { type: typeUpper }]
    : baseConditions;

  // Price filters apply to PACKAGES now (affects the displayed "from" price only).
  const packageFilters: Prisma.HospitalPackageWhereInput[] = [{ isActive: true }];
  if (minPrice) packageFilters.push({ price: { gte: parseInt(minPrice, 10) } });
  if (maxPrice) packageFilters.push({ price: { lte: parseInt(maxPrice, 10) } });

  const include = {
    location: true,
    media: { where: { isPrimary: true }, take: 1 },
    packages: { where: { AND: packageFilters }, orderBy: [{ price: "asc" as const }], take: 1 },
  };

  let orderBy: Prisma.HospitalOrderByWithRelationInput = { createdAt: "desc" };
  if (sortBy === "name") orderBy = { name: "asc" };

  const whereBase = baseConditions.length > 0 ? { AND: baseConditions } : undefined;
  const where = whereConditions.length > 0 ? { AND: whereConditions } : undefined;

  const buildAggMap = async (ids: string[]): Promise<RatingAgg> => {
    if (ids.length === 0) return {};
    const aggs = await db.review.groupBy({
      by: ["hospitalId"],
      where: { hospitalId: { in: ids } },
      _avg: { rating: true },
      _count: { rating: true },
    });
    return Object.fromEntries(aggs.map((a) => [a.hospitalId, a])) as RatingAgg;
  };

  const toPayload = (h: HospitalRow, aggMap: RatingAgg) => ({
    id: h.id,
    slug: h.slug,
    name: h.name,
    type: h.type,
    rating: aggMap[h.id]?._avg.rating ? Math.round(aggMap[h.id]._avg.rating! * 10) / 10 : 0,
    reviewCount: aggMap[h.id]?._count.rating ?? 0,
    verified: h.verified,
    specialty: h.servicesSummary || "General",
    city: h.location.city,
    district: h.location.district,
    area: h.location.area,
    image: h.media[0]?.url || null,
    fromPrice: h.packages[0]?.price ?? null,
    currency: h.packages[0]?.currency ?? "EUR",
    emergencyAvailable: h.emergencyAvailable,
  });

  const isPriceSort = sortBy === "price-low" || sortBy === "price-high";
  // Rating is a computed aggregate (not a column), so any rating filter — like price sorting —
  // can only be resolved after the DB read. Both force a full scan over the base set.
  const needsFullScan = isPriceSort || minRating > 0;

  if (needsFullScan) {
    // Scan the whole base set (all types) so totals, facet counts AND pagination all respect
    // the post-aggregate rating filter.
    const rawAll = await db.hospital.findMany({ where: whereBase, include });
    const aggMap = await buildAggMap(rawAll.map((h) => h.id));

    let enriched = rawAll.map((h) => ({ h, payload: toPayload(h, aggMap) }));
    if (minRating > 0) enriched = enriched.filter((e) => e.payload.rating >= minRating);

    const typeCounts = { HOSPITAL: 0, CLINIC: 0, LAB: 0 } as Record<"HOSPITAL" | "CLINIC" | "LAB", number>;
    for (const e of enriched) if (e.h.type in typeCounts) typeCounts[e.h.type as keyof typeof typeCounts]++;

    const typed = typeValid ? enriched.filter((e) => e.h.type === typeUpper) : enriched;

    typed.sort((a, b) => {
      if (sortBy === "price-low") return (a.payload.fromPrice ?? 1e18) - (b.payload.fromPrice ?? 1e18);
      if (sortBy === "price-high") return (b.payload.fromPrice ?? 1e18) - (a.payload.fromPrice ?? 1e18);
      if (sortBy === "name") return a.h.name.localeCompare(b.h.name);
      return b.h.createdAt.getTime() - a.h.createdAt.getTime(); // recent
    });

    const total = typed.length;
    const hospitals = typed.slice((page - 1) * pageSize, page * pageSize).map((e) => e.payload);
    const allCount = typeCounts.HOSPITAL + typeCounts.CLINIC + typeCounts.LAB;

    return NextResponse.json({
      hospitals,
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
      typeCounts: { all: allCount, ...typeCounts },
    });
  }

  // Common path: no post-aggregate filtering needed, so the DB handles pagination directly.
  const [total, typeGroups, raw] = await Promise.all([
    db.hospital.count({ where }),
    db.hospital.groupBy({ by: ["type"], where: whereBase, _count: { _all: true } }),
    db.hospital.findMany({
      where,
      include,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const aggMap = await buildAggMap(raw.map((h) => h.id));
  const hospitals = raw.map((h) => toPayload(h, aggMap));

  const typeCounts = { HOSPITAL: 0, CLINIC: 0, LAB: 0 } as Record<"HOSPITAL" | "CLINIC" | "LAB", number>;
  for (const g of typeGroups) {
    if (g.type in typeCounts) typeCounts[g.type as keyof typeof typeCounts] = g._count._all;
  }
  const allCount = typeCounts.HOSPITAL + typeCounts.CLINIC + typeCounts.LAB;

  return NextResponse.json({
    hospitals,
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
    typeCounts: { all: allCount, ...typeCounts },
  });
}
