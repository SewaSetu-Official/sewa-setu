import { NextResponse } from "next/server";
import { requireHospitalAccess, writeAuditLog } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/admin-permissions";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type HospitalTaskStatus = "PENDING" | "IN_PROGRESS" | "DONE" | "CANCELLED";
type HospitalTaskPriority = "LOW" | "NORMAL" | "HIGH";

const STATUSES: HospitalTaskStatus[] = ["PENDING", "IN_PROGRESS", "DONE", "CANCELLED"];
const PRIORITIES: HospitalTaskPriority[] = ["LOW", "NORMAL", "HIGH"];
const prisma = db as typeof db & { hospitalTask: {
  findMany: (args: unknown) => Promise<HospitalTaskRecord[]>;
  findFirst: (args: unknown) => Promise<HospitalTaskRecord | null>;
  create: (args: unknown) => Promise<HospitalTaskRecord>;
  update: (args: unknown) => Promise<HospitalTaskRecord>;
  delete: (args: unknown) => Promise<HospitalTaskRecord>;
} };

type HospitalTaskRecord = {
  id: string;
  title: string;
  description: string | null;
  priority: HospitalTaskPriority;
  status: HospitalTaskStatus;
  dueAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  assignedToUserId: string | null;
  createdById: string;
  assignedToUser?: { id: string; fullName: string; email: string } | null;
  createdBy?: { fullName: string };
};

function jsonError(error: unknown) {
  const message = error instanceof Error ? error.message : "UNAUTHORIZED";
  return NextResponse.json({ error: message }, { status: message === "FORBIDDEN" ? 403 : 401 });
}

async function getAssignableStaff(hospitalId: string) {
  const memberships = await db.hospitalMembership.findMany({
    where: {
      hospitalId,
      status: "APPROVED",
      role: { in: ["STAFF", "RECEPTIONIST", "MANAGER"] },
    },
    include: { user: { select: { id: true, fullName: true, email: true } } },
    orderBy: [{ role: "asc" }, { user: { fullName: "asc" } }],
  });

  return memberships.map((membership) => ({
    membershipId: membership.id,
    userId: membership.userId,
    role: membership.role,
    fullName: membership.user.fullName,
    email: membership.user.email,
  }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  let ctx;
  try { ctx = await requireHospitalAccess(slug, "VIEW_STAFF_TASKS", { apiMode: true }); }
  catch (error: unknown) { return jsonError(error); }

  const canManage = hasPermission(ctx.membership.role, "MANAGE_STAFF_TASKS");
  const where = {
    hospitalId: ctx.membership.hospitalId,
    ...(canManage ? {} : { assignedToUserId: ctx.user.id }),
  };

  const [tasks, assignableStaff] = await Promise.all([
    prisma.hospitalTask.findMany({
      where,
      include: {
        assignedToUser: { select: { id: true, fullName: true, email: true } },
        createdBy: { select: { fullName: true } },
      },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
    }),
    canManage ? getAssignableStaff(ctx.membership.hospitalId) : Promise.resolve([]),
  ]);

  return NextResponse.json({
    role: ctx.membership.role,
    canManage,
    assignableStaff,
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      dueAt: task.dueAt?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      assignedToUser: task.assignedToUser
        ? { id: task.assignedToUser.id, fullName: task.assignedToUser.fullName, email: task.assignedToUser.email }
        : null,
      createdBy: task.createdBy?.fullName ?? "Unknown",
    })),
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  let ctx;
  try { ctx = await requireHospitalAccess(slug, "MANAGE_STAFF_TASKS", { apiMode: true }); }
  catch (error: unknown) { return jsonError(error); }

  let body: {
    title?: string;
    description?: string;
    assignedToUserId?: string;
    priority?: HospitalTaskPriority;
    dueAt?: string;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const title = body.title?.trim();
  if (!title) return NextResponse.json({ error: "Task title is required" }, { status: 400 });

  const priority = body.priority && PRIORITIES.includes(body.priority) ? body.priority : "NORMAL";
  const dueAt = body.dueAt ? new Date(body.dueAt) : null;
  if (dueAt && Number.isNaN(dueAt.getTime())) {
    return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
  }

  if (body.assignedToUserId) {
    const assignee = await db.hospitalMembership.findFirst({
      where: {
        hospitalId: ctx.membership.hospitalId,
        userId: body.assignedToUserId,
        status: "APPROVED",
        role: { in: ["STAFF", "RECEPTIONIST", "MANAGER"] },
      },
      select: { id: true },
    });
    if (!assignee) return NextResponse.json({ error: "Assignee is not approved for this hospital" }, { status: 400 });
  }

  const task = await prisma.hospitalTask.create({
    data: {
      hospitalId: ctx.membership.hospitalId,
      title,
      description: body.description?.trim() || null,
      priority,
      assignedToUserId: body.assignedToUserId || null,
      createdById: ctx.user.id,
      dueAt,
    },
  });

  await writeAuditLog({
    actorUserId: ctx.user.id,
    hospitalId: ctx.membership.hospitalId,
    action: "STAFF_TASK_CREATED",
    entity: "HospitalTask",
    entityId: task.id,
    after: { title: task.title, assignedToUserId: task.assignedToUserId, priority: task.priority },
  });

  return NextResponse.json({ success: true, id: task.id });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  let ctx;
  try { ctx = await requireHospitalAccess(slug, "VIEW_STAFF_TASKS", { apiMode: true }); }
  catch (error: unknown) { return jsonError(error); }

  let body: {
    taskId?: string;
    status?: HospitalTaskStatus;
    title?: string;
    description?: string;
    priority?: HospitalTaskPriority;
    assignedToUserId?: string | null;
    dueAt?: string | null;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.taskId) return NextResponse.json({ error: "taskId is required" }, { status: 400 });

  const canManage = hasPermission(ctx.membership.role, "MANAGE_STAFF_TASKS");
  const task = await prisma.hospitalTask.findFirst({
    where: { id: body.taskId, hospitalId: ctx.membership.hospitalId },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (!canManage && task.assignedToUserId !== ctx.user.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.status) {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    updateData.status = body.status;
    updateData.completedAt = body.status === "DONE" ? new Date() : null;
  }

  if (canManage) {
    if (body.title !== undefined) updateData.title = body.title.trim();
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.priority !== undefined) {
      if (!PRIORITIES.includes(body.priority)) return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
      updateData.priority = body.priority;
    }
    if (body.dueAt !== undefined) {
      const dueAt = body.dueAt ? new Date(body.dueAt) : null;
      if (dueAt && Number.isNaN(dueAt.getTime())) return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
      updateData.dueAt = dueAt;
    }
    if (body.assignedToUserId !== undefined) updateData.assignedToUserId = body.assignedToUserId || null;
  }

  const updated = await prisma.hospitalTask.update({
    where: { id: task.id },
    data: updateData as never,
  });

  await writeAuditLog({
    actorUserId: ctx.user.id,
    hospitalId: ctx.membership.hospitalId,
    action: "STAFF_TASK_UPDATED",
    entity: "HospitalTask",
    entityId: task.id,
    before: { status: task.status, assignedToUserId: task.assignedToUserId, priority: task.priority },
    after: { status: updated.status, assignedToUserId: updated.assignedToUserId, priority: updated.priority },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  let ctx;
  try { ctx = await requireHospitalAccess(slug, "MANAGE_STAFF_TASKS", { apiMode: true }); }
  catch (error: unknown) { return jsonError(error); }

  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "taskId is required" }, { status: 400 });

  const task = await prisma.hospitalTask.findFirst({
    where: { id: taskId, hospitalId: ctx.membership.hospitalId },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  await prisma.hospitalTask.delete({ where: { id: task.id } });

  await writeAuditLog({
    actorUserId: ctx.user.id,
    hospitalId: ctx.membership.hospitalId,
    action: "STAFF_TASK_DELETED",
    entity: "HospitalTask",
    entityId: task.id,
    before: { title: task.title, status: task.status },
  });

  return NextResponse.json({ success: true });
}
