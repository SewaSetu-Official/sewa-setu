"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ClipboardList, Clock3, Plus, RefreshCw, Trash2 } from "lucide-react";

type TaskStatus = "PENDING" | "IN_PROGRESS" | "DONE" | "CANCELLED";
type TaskPriority = "LOW" | "NORMAL" | "HIGH";

type Task = {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  assignedToUser: { id: string; fullName: string; email: string } | null;
  createdBy: string;
};

type Assignee = {
  userId: string;
  role: string;
  fullName: string;
  email: string;
};

type TasksResponse = {
  role: string;
  canManage: boolean;
  assignableStaff: Assignee[];
  tasks: Task[];
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

const PRIORITY_STYLES: Record<TaskPriority, { bg: string; color: string }> = {
  LOW: { bg: "#ecfdf5", color: "#047857" },
  NORMAL: { bg: "#eff6ff", color: "#1d4ed8" },
  HIGH: { bg: "#fff7ed", color: "#c2410c" },
};

function formatDate(value: string | null) {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function TasksClient({ slug }: { slug: string }) {
  const [data, setData] = useState<TasksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    assignedToUserId: "",
    priority: "NORMAL" as TaskPriority,
    dueAt: "",
  });

  const fetchTasks = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/admin/h/${slug}/tasks`);
      if (!res.ok) throw new Error("Failed");
      setData(await res.json());
    } catch {
      setError("Failed to load staff tasks.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchTasks();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchTasks]);

  const summary = useMemo(() => {
    const tasks = data?.tasks ?? [];
    return {
      open: tasks.filter((task) => task.status === "PENDING" || task.status === "IN_PROGRESS").length,
      done: tasks.filter((task) => task.status === "DONE").length,
      high: tasks.filter((task) => task.priority === "HIGH" && task.status !== "DONE").length,
    };
  }, [data]);

  const createTask = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/h/${slug}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setForm({ title: "", description: "", assignedToUserId: "", priority: "NORMAL", dueAt: "" });
      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task.");
    } finally {
      setSaving(false);
    }
  };

  const updateTask = async (taskId: string, status: TaskStatus) => {
    setActionLoading(taskId + status);
    setError("");
    try {
      const res = await fetch(`/api/admin/h/${slug}/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task.");
    } finally {
      setActionLoading(null);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm("Delete this staff task?")) return;
    setActionLoading(taskId + "delete");
    setError("");
    try {
      const res = await fetch(`/api/admin/h/${slug}/tasks?taskId=${taskId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task.");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#c8a96e] border-r-transparent" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c8a96e]">Staff workflow</p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#0f172a]">
            {data?.canManage ? "Staff Task Assignment" : "My Assigned Tasks"}
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {data?.canManage ? "Assign concrete non-clinical work to hospital staff." : "Update progress on tasks assigned to you."}
          </p>
        </div>
        <button
          onClick={fetchTasks}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <Summary label="Open" value={summary.open} icon={<Clock3 size={16} />} />
        <Summary label="Done" value={summary.done} icon={<CheckCircle2 size={16} />} />
        <Summary label="High Priority" value={summary.high} icon={<AlertCircle size={16} />} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        {data?.canManage && (
          <form onSubmit={createTask} className="rounded-2xl border border-gray-100 bg-white p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "#f7f4ef", color: "#a8874f" }}>
                <Plus size={17} />
              </div>
              <div>
                <p className="text-sm font-extrabold text-[#0f172a]">New task</p>
                <p className="text-xs font-medium text-slate-400">Assign to approved staff or operators.</p>
              </div>
            </div>

            <div className="space-y-3">
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Task title"
                className="h-10 w-full rounded-xl px-3 text-sm outline-none"
                style={{ background: "#f7f4ef", border: "1.5px solid rgba(15,30,56,.1)" }}
              />
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Description or context"
                rows={3}
                className="w-full resize-none rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "#f7f4ef", border: "1.5px solid rgba(15,30,56,.1)" }}
              />
              <select
                value={form.assignedToUserId}
                onChange={(event) => setForm((current) => ({ ...current, assignedToUserId: event.target.value }))}
                className="h-10 w-full rounded-xl px-3 text-sm font-semibold outline-none"
                style={{ background: "#f7f4ef", border: "1.5px solid rgba(15,30,56,.1)" }}
              >
                <option value="">Unassigned</option>
                {data.assignableStaff.map((assignee) => (
                  <option key={assignee.userId} value={assignee.userId}>
                    {assignee.fullName} / {assignee.role.toLowerCase()}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={form.priority}
                  onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as TaskPriority }))}
                  className="h-10 rounded-xl px-3 text-sm font-semibold outline-none"
                  style={{ background: "#f7f4ef", border: "1.5px solid rgba(15,30,56,.1)" }}
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                </select>
                <input
                  type="date"
                  value={form.dueAt}
                  onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))}
                  className="h-10 rounded-xl px-3 text-sm font-semibold outline-none"
                  style={{ background: "#f7f4ef", border: "1.5px solid rgba(15,30,56,.1)" }}
                />
              </div>
              <button
                disabled={saving}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#0f1e38,#1a3059)", color: "#c8a96e" }}
              >
                <ClipboardList size={15} /> {saving ? "Creating..." : "Create task"}
              </button>
            </div>
          </form>
        )}

        <section className={data?.canManage ? "space-y-3" : "xl:col-span-2 space-y-3"}>
          {(data?.tasks ?? []).map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              canManage={Boolean(data?.canManage)}
              busy={Boolean(actionLoading?.startsWith(task.id))}
              onStatus={updateTask}
              onDelete={deleteTask}
            />
          ))}
          {data?.tasks.length === 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center">
              <ClipboardList size={30} className="mx-auto text-gray-200" />
              <p className="mt-3 text-sm font-bold text-slate-400">No tasks yet</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Summary({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-extrabold text-[#0f172a]">{value}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "#f7f4ef", color: "#a8874f" }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function TaskCard({
  task,
  canManage,
  busy,
  onStatus,
  onDelete,
}: {
  task: Task;
  canManage: boolean;
  busy: boolean;
  onStatus: (taskId: string, status: TaskStatus) => void;
  onDelete: (taskId: string) => void;
}) {
  const priority = PRIORITY_STYLES[task.priority];

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-extrabold text-[#0f172a]">{task.title}</h2>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={priority}>
              {task.priority}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
              {STATUS_LABELS[task.status]}
            </span>
          </div>
          {task.description && <p className="mt-2 text-sm font-medium text-slate-500">{task.description}</p>}
          <p className="mt-2 text-xs font-semibold text-slate-400">
            Due {formatDate(task.dueAt)} / Assigned to {task.assignedToUser?.fullName ?? "Unassigned"} / Created by {task.createdBy}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {task.status === "PENDING" && (
            <button
              onClick={() => onStatus(task.id, "IN_PROGRESS")}
              disabled={busy}
              className="h-9 rounded-xl bg-blue-50 px-3 text-xs font-bold text-blue-700 disabled:opacity-50"
            >
              Start
            </button>
          )}
          {task.status !== "DONE" && task.status !== "CANCELLED" && (
            <button
              onClick={() => onStatus(task.id, "DONE")}
              disabled={busy}
              className="h-9 rounded-xl bg-emerald-50 px-3 text-xs font-bold text-emerald-700 disabled:opacity-50"
            >
              Mark done
            </button>
          )}
          {canManage && task.status !== "CANCELLED" && (
            <button
              onClick={() => onStatus(task.id, "CANCELLED")}
              disabled={busy}
              className="h-9 rounded-xl bg-rose-50 px-3 text-xs font-bold text-rose-700 disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          {canManage && (
            <button
              onClick={() => onDelete(task.id)}
              disabled={busy}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-400 disabled:opacity-50"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
