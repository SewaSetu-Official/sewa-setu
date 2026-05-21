"use client";

import { useEffect, useState, useCallback } from "react";
import type { HospitalRole } from "@prisma/client";
import { Users, RefreshCw, AlertCircle, Trash2, ChevronDown, ShieldCheck, UserCog, ClipboardCheck, CheckCircle2, Clock3, XCircle } from "lucide-react";
import {
  HOSPITAL_ROLE_LABELS,
  canManageHospitalMember,
  getAssignableHospitalRoles,
} from "@/lib/admin-roles";

type Member = {
  id: string;
  userId: string;
  role: HospitalRole;
  status: string;
  invitedBy: string | null;
  rejectedReason: string | null;
  createdAt: string;
  user: { fullName: string; email: string; memberSince: string };
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  APPROVED: { label: "Approved", bg: "rgba(16,185,129,.1)", color: "#059669" },
  PENDING: { label: "Pending", bg: "rgba(245,158,11,.1)", color: "#b45309" },
  REJECTED: { label: "Rejected", bg: "rgba(239,68,68,.08)", color: "#dc2626" },
};

const ROLE_DESCRIPTIONS: Record<HospitalRole, string> = {
  OWNER: "Business authority, ownership, billing, legal, and high-risk controls",
  MANAGER: "Runs hospital operations, team workflows, schedules, packages, and reports",
  RECEPTIONIST: "Front-desk booking, confirmation, cancellation, reschedule, and check-in work",
  DOCTOR: "Own schedule and assigned patient appointments",
  STAFF: "Limited support access for assigned operational tasks",
};

const ROLE_ORDER: HospitalRole[] = ["OWNER", "MANAGER", "RECEPTIONIST", "DOCTOR", "STAFF"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function TeamClient({
  slug,
  actorRole,
  actorUserId,
}: {
  slug: string;
  actorRole: HospitalRole;
  actorUserId: string;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/h/${slug}/team`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setMembers(data.members);
    } catch {
      setError("Failed to load team.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchMembers();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchMembers]);

  const handleRoleChange = async (memberId: string, role: HospitalRole) => {
    setActionLoading(memberId + "role");
    setError("");
    try {
      const res = await fetch(`/api/admin/h/${slug}/team`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      await fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusChange = async (memberId: string, status: "APPROVED" | "REJECTED") => {
    const rejectedReason = status === "REJECTED" ? window.prompt("Reason for rejection? This stays in the membership record.") ?? "" : "";
    setActionLoading(memberId + "status");
    setError("");
    try {
      const res = await fetch(`/api/admin/h/${slug}/team`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, status, rejectedReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      await fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm("Remove this team member?")) return;
    setActionLoading(memberId + "remove");
    setError("");
    try {
      const res = await fetch(`/api/admin/h/${slug}/team?memberId=${memberId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      await fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member.");
    } finally {
      setActionLoading(null);
    }
  };

  const approved = members.filter((member) => member.status === "APPROVED");
  const pending = members.filter((member) => member.status === "PENDING");
  const rejected = members.filter((member) => member.status === "REJECTED");
  const owners = approved.filter((member) => member.role === "OWNER").length;
  const managers = approved.filter((member) => member.role === "MANAGER").length;
  const operators = approved.filter((member) => ["RECEPTIONIST", "DOCTOR", "STAFF"].includes(member.role)).length;
  const canManageAuthority = actorRole === "OWNER";
  const roleCounts = ROLE_ORDER.map((roleName) => ({
    role: roleName,
    approved: approved.filter((member) => member.role === roleName).length,
    pending: pending.filter((member) => member.role === roleName).length,
  }));

  return (
    <div className="space-y-6 w-full max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[#0f1e38]">Team Permissions</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Approve access, assign roles, and protect owner authority.
          </p>
        </div>
        <button
          onClick={fetchMembers}
          className="flex items-center gap-2 px-3 h-9 rounded-xl text-xs font-semibold transition-all"
          style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.1)", color: "#6b7a96" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#c8a96e";
            e.currentTarget.style.color = "#c8a96e";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(15,30,56,.1)";
            e.currentTarget.style.color = "#6b7a96";
          }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4" style={{ background: "linear-gradient(135deg,#0f1e38,#192d52)" }}>
          <div>
            <p className="text-sm font-extrabold text-white">Hospital Access Control</p>
            <p className="mt-1 max-w-2xl text-xs font-semibold text-white/55">
              Owners can approve and manage managers, receptionists, doctors, and staff. Managers stay limited to operational roles.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <HeaderStat icon={<CheckCircle2 size={13} />} label="Active" value={approved.length} />
            <HeaderStat icon={<Clock3 size={13} />} label="Pending" value={pending.length} />
            <HeaderStat icon={<ShieldCheck size={13} />} label="Owners" value={owners} />
          </div>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-5">
          {roleCounts.map((item) => (
            <div key={item.role} className="rounded-2xl p-3" style={{ background: "#f7f4ef" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{HOSPITAL_ROLE_LABELS[item.role]}</p>
              <p className="mt-1 text-xl font-extrabold text-[#0f1e38]">{item.approved}</p>
              <p className="text-[11px] font-semibold text-gray-400">{item.pending} pending</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <AuthorityCard
          icon={<ShieldCheck size={16} />}
          title="Authority"
          value={`${owners} owner${owners === 1 ? "" : "s"}`}
          note={canManageAuthority ? "You can assign owners and managers." : "Owner and manager authority is owner-only."}
          tone={canManageAuthority ? "gold" : "slate"}
        />
        <AuthorityCard
          icon={<UserCog size={16} />}
          title="Management"
          value={`${managers} manager${managers === 1 ? "" : "s"}`}
          note="Managers run day-to-day operations."
          tone="blue"
        />
        <AuthorityCard
          icon={<ClipboardCheck size={16} />}
          title="Operations"
          value={`${operators} operator${operators === 1 ? "" : "s"}`}
          note="Reception, doctors, and limited staff."
          tone="green"
        />
      </div>

      {!canManageAuthority && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
          <p className="text-sm font-bold text-[#0f1e38]">Manager access is operational</p>
          <p className="mt-1 text-xs font-medium text-amber-800">
            You can approve and manage receptionists, doctors, and staff. Owner and manager role changes require an owner.
          </p>
        </div>
      )}

      {error && (
        <div
          className="p-3 rounded-xl text-sm font-semibold text-red-600 flex items-center gap-2"
          style={{ background: "#fef2f2", border: "1px solid rgba(220,38,38,.2)" }}
        >
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-solid border-[#c8a96e] border-r-transparent" />
        </div>
      ) : members.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <Users size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-400">No team members yet</p>
          <p className="text-xs text-gray-300 mt-1">Staff can request access from /admin/request-access</p>
        </div>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-600">
                    Pending Requests ({pending.length})
                  </p>
                  <p className="mt-1 text-xs font-semibold text-amber-800">Review the requested role before approving access.</p>
                </div>
                <Clock3 size={18} className="text-amber-500" />
              </div>
              <div className="space-y-2">
                {pending.map((member) => (
                  <MemberRow
                    key={member.id}
                    actorRole={actorRole}
                    actorUserId={actorUserId}
                    member={member}
                    actionLoading={actionLoading}
                    onRoleChange={handleRoleChange}
                    onStatusChange={handleStatusChange}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </div>
          )}

          {approved.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                Active Members ({approved.length})
              </p>
              <div className="space-y-2">
                {approved.map((member) => (
                  <MemberRow
                    key={member.id}
                    actorRole={actorRole}
                    actorUserId={actorUserId}
                    member={member}
                    actionLoading={actionLoading}
                    onRoleChange={handleRoleChange}
                    onStatusChange={handleStatusChange}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </div>
          )}

          {rejected.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                Rejected ({rejected.length})
              </p>
              <div className="space-y-2">
                {rejected.map((member) => (
                  <MemberRow
                    key={member.id}
                    actorRole={actorRole}
                    actorUserId={actorUserId}
                    member={member}
                    actionLoading={actionLoading}
                    onRoleChange={handleRoleChange}
                    onStatusChange={handleStatusChange}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AuthorityCard({
  icon,
  title,
  value,
  note,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  note: string;
  tone: "gold" | "blue" | "green" | "slate";
}) {
  const colors = {
    gold: { bg: "rgba(200,169,110,.12)", color: "#9b7637" },
    blue: { bg: "rgba(59,130,246,.08)", color: "#1d4ed8" },
    green: { bg: "rgba(16,185,129,.08)", color: "#047857" },
    slate: { bg: "rgba(15,30,56,.06)", color: "#475569" },
  }[tone];

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{title}</p>
          <p className="mt-1 text-xl font-extrabold text-[#0f1e38]">{value}</p>
          <p className="mt-1 text-xs text-gray-400">{note}</p>
        </div>
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: colors.bg, color: colors.color }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function HeaderStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="min-w-20 rounded-xl px-3 py-2 text-right" style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.1)" }}>
      <div className="flex items-center justify-end gap-1 text-[#c8a96e]">{icon}<span className="text-lg font-extrabold">{value}</span></div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{label}</p>
    </div>
  );
}

function MemberRow({
  actorRole,
  actorUserId,
  member,
  actionLoading,
  onRoleChange,
  onStatusChange,
  onRemove,
}: {
  actorRole: HospitalRole;
  actorUserId: string;
  member: Member;
  actionLoading: string | null;
  onRoleChange: (id: string, role: HospitalRole) => void;
  onStatusChange: (id: string, status: "APPROVED" | "REJECTED") => void;
  onRemove: (id: string) => void;
}) {
  const status = STATUS_CONFIG[member.status] ?? STATUS_CONFIG.PENDING;
  const busy = actionLoading?.startsWith(member.id);
  const canManageTarget = canManageHospitalMember(actorRole, member.role);
  const canEdit = canManageTarget && member.userId !== actorUserId;
  const assignableRoles = getAssignableHospitalRoles(actorRole);
  const visibleRoles = Array.from(new Set<HospitalRole>([member.role, ...assignableRoles]));
  const canChangeRole = canEdit && assignableRoles.includes(member.role);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 flex-wrap">
      <div
        className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold"
        style={{ background: "rgba(200,169,110,.12)", color: "#c8a96e" }}
      >
        {member.user.fullName.charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-bold text-[#0f1e38] text-sm">{member.user.fullName}</p>
        <p className="text-xs text-gray-400">{member.user.email}</p>
        <p className="text-[10px] text-gray-300 mt-0.5">
          Joined {formatDate(member.createdAt)}
          {member.invitedBy ? " | Invited" : " | Self-requested"}
        </p>
        <p className="text-[11px] text-gray-400 mt-1">{ROLE_DESCRIPTIONS[member.role]}</p>
      </div>

      <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: status.bg, color: status.color }}>
        {status.label}
      </span>

      <div className="relative flex-shrink-0">
        <select
          value={member.role}
          onChange={(e) => onRoleChange(member.id, e.target.value as HospitalRole)}
          disabled={!canChangeRole || !!busy}
          className="h-8 rounded-xl pl-3 pr-7 text-xs font-semibold appearance-none outline-none disabled:opacity-50"
          style={{ background: "#f7f4ef", border: "1.5px solid rgba(15,30,56,.1)", color: "#0f1e38" }}
        >
          {visibleRoles.map((role) => (
            <option key={role} value={role}>
              {HOSPITAL_ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>

      {member.status === "PENDING" && canEdit && (
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => onStatusChange(member.id, "APPROVED")}
            disabled={!!busy}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-bold disabled:opacity-50"
            style={{ background: "rgba(16,185,129,.1)", color: "#059669" }}
          >
            {actionLoading === member.id + "status" ? "..." : <><CheckCircle2 size={13} /> Approve</>}
          </button>
          <button
            onClick={() => onStatusChange(member.id, "REJECTED")}
            disabled={!!busy}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-bold disabled:opacity-50"
            style={{ background: "rgba(239,68,68,.08)", color: "#dc2626" }}
          >
            <XCircle size={13} /> Reject
          </button>
        </div>
      )}

      {canEdit && (
        <button
          onClick={() => onRemove(member.id)}
          disabled={!!busy}
          className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-50 transition-all"
          style={{ background: "transparent", color: "#d1d5db" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(239,68,68,.08)";
            e.currentTarget.style.color = "#dc2626";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#d1d5db";
          }}
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}
