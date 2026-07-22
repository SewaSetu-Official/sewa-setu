import { NextRequest, NextResponse } from "next/server";
import { requirePlatformStaff } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { apiError } from "@/lib/api-errors";

export const dynamic = "force-dynamic";

// GET /api/admin/platform/audit-logs?page=&search=&entity=&hospitalId=
export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requirePlatformStaff({ apiMode: true }); }
  catch (e: unknown) { return apiError(e); }

  const { searchParams } = new URL(req.url);
  const page       = Math.max(1, Number(searchParams.get("page") ?? 1));
  const search     = searchParams.get("search")?.trim() ?? "";
  const entity     = searchParams.get("entity") ?? "all";
  const hospitalId = searchParams.get("hospitalId") ?? "";
  const PAGE_SIZE  = 30;
  const assignedHospitalIds = ctx.assignedHospitalIds;
  const supportHospitalFilter = hospitalId
    ? (assignedHospitalIds.includes(hospitalId) ? hospitalId : { in: [] as string[] })
    : { in: assignedHospitalIds };

  // If searching by actor name/email, resolve actor IDs first
  let actorIds: string[] | null = null;
  if (search) {
    const matchingUsers = await db.user.findMany({
      where: {
        OR: [
          { fullName: { contains: search, mode: "insensitive" } },
          { email:    { contains: search, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    actorIds = matchingUsers.map((u) => u.id);
  }

  const where = {
    ...(entity !== "all" ? { entity } : {}),
    ...(ctx.isAdmin
      ? (hospitalId ? { hospitalId } : {})
      : { hospitalId: supportHospitalFilter }),
    ...(actorIds !== null ? { actorUserId: { in: actorIds } } : {}),
  };

  const [total, logs, hospitals] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.hospital.findMany({
      where: {
        isActive: true,
        ...(ctx.isAdmin ? {} : { id: { in: assignedHospitalIds } }),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Resolve actor names
  const actorUserIds = [...new Set(logs.map((l) => l.actorUserId))];
  const actors = await db.user.findMany({
    where: { id: { in: actorUserIds } },
    select: { id: true, fullName: true, email: true, role: true },
  });
  const actorMap = Object.fromEntries(actors.map((a) => [a.id, a]));

  // Resolve hospital names for logs that have hospitalId
  const logHospitalIds = [...new Set(logs.map((l) => l.hospitalId).filter(Boolean))] as string[];
  const logHospitals = logHospitalIds.length
    ? await db.hospital.findMany({
        where: { id: { in: logHospitalIds } },
        select: { id: true, name: true, slug: true },
      })
    : [];
  const hospitalMap = Object.fromEntries(logHospitals.map((h) => [h.id, h]));

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      entity: l.entity,
      entityId: l.entityId,
      before: l.before,
      after: l.after,
      createdAt: l.createdAt.toISOString(),
      actor: actorMap[l.actorUserId]
        ? { id: l.actorUserId, name: actorMap[l.actorUserId].fullName, email: actorMap[l.actorUserId].email, role: actorMap[l.actorUserId].role }
        : { id: l.actorUserId, name: "Unknown", email: "", role: "" },
      hospital: l.hospitalId && hospitalMap[l.hospitalId]
        ? { id: l.hospitalId, name: hospitalMap[l.hospitalId].name, slug: hospitalMap[l.hospitalId].slug }
        : null,
    })),
    total,
    hasMore: page * PAGE_SIZE < total,
    hospitals,
    scope: ctx.isAdmin ? "platform" : "assigned",
  });
}
