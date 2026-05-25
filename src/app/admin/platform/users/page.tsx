"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HospitalRole, UserRole } from "@prisma/client";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Ban,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Users,
  XCircle,
} from "lucide-react";
import {
  HOSPITAL_ROLE_LABELS,
  PLATFORM_ROLE_LABELS,
  isPlatformAdmin,
  isPlatformStaff,
} from "@/lib/admin-roles";

type Membership = {
  id: string;
  role: HospitalRole;
  status: string;
  hospitalName: string;
  hospitalSlug: string;
};

type SupportAssignment = {
  id: string;
  hospitalId: string;
  hospitalName: string;
  hospitalSlug: string;
};

type SupportHospital = { id: string; name: string };

type User = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: UserRole;
  bannedAt: string | null;
  createdAt: string;
  bookingCount: number;
  memberships: Membership[];
  supportAssignments: SupportAssignment[];
};

type Counts = {
  all: number;
  pending: number;
  banned: number;
};

type RoleCounts = {
  all: number;
  standard: number;
  platformSupport: number;
  platformAdmin: number;
  hospitalAdmin: number;
};

type FilterValue = "all" | "pending" | "banned";
type UserTypeValue = "all" | "standard" | "platform_support" | "platform_admin" | "hospital_admin";
type SortValue = "newest" | "oldest" | "name_asc" | "name_desc" | "role" | "bookings_desc";

const DEFAULT_COUNTS: Counts = { all: 0, pending: 0, banned: 0 };
const DEFAULT_ROLE_COUNTS: RoleCounts = { all: 0, standard: 0, platformSupport: 0, platformAdmin: 0, hospitalAdmin: 0 };

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  APPROVED: { label: "Approved", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
  PENDING: { label: "Pending", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-100" },
  REJECTED: { label: "Rejected", bg: "bg-red-50", text: "text-red-700", border: "border-red-100" },
};

const FILTERS: Array<{ value: FilterValue; label: string; countKey: keyof Counts }> = [
  { value: "all", label: "All users", countKey: "all" },
  { value: "pending", label: "Pending access", countKey: "pending" },
  { value: "banned", label: "Banned", countKey: "banned" },
];

const USER_TYPE_OPTIONS: Array<{ value: UserTypeValue; label: string; countKey: keyof RoleCounts }> = [
  { value: "all", label: "All roles", countKey: "all" },
  { value: "standard", label: "Normal users", countKey: "standard" },
  { value: "platform_support", label: "Platform support", countKey: "platformSupport" },
  { value: "platform_admin", label: "Platform admins", countKey: "platformAdmin" },
  { value: "hospital_admin", label: "Hospital admins", countKey: "hospitalAdmin" },
];

const SORT_OPTIONS: Array<{ value: SortValue; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name_asc", label: "Name A-Z" },
  { value: "name_desc", label: "Name Z-A" },
  { value: "role", label: "Platform role" },
  { value: "bookings_desc", label: "Most bookings" },
];

const PLATFORM_ROLE_OPTIONS: UserRole[] = ["USER", "PLATFORM_SUPPORT", "PLATFORM_ADMIN"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function getInitialFilter(value: string | null): FilterValue {
  return value === "pending" || value === "banned" ? value : "all";
}

function getInitialUserType(value: string | null): UserTypeValue {
  return value === "standard" || value === "platform_support" || value === "platform_admin" || value === "hospital_admin" ? value : "all";
}

function getInitialSort(value: string | null): SortValue {
  return value === "oldest" || value === "name_asc" || value === "name_desc" || value === "role" || value === "bookings_desc" ? value : "newest";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

function StatusPill({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  return (
    <span className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] font-extrabold ${config.bg} ${config.text} ${config.border}`}>
      {config.label}
    </span>
  );
}

function RolePill({ role }: { role: HospitalRole }) {
  return (
    <span className="inline-flex h-6 items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-bold text-slate-600">
      {HOSPITAL_ROLE_LABELS[role] ?? role}
    </span>
  );
}

function UsersContent() {
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [supportHospitals, setSupportHospitals] = useState<SupportHospital[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Counts>(DEFAULT_COUNTS);
  const [roleCounts, setRoleCounts] = useState<RoleCounts>(DEFAULT_ROLE_COUNTS);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filter, setFilter] = useState<FilterValue>(getInitialFilter(searchParams.get("filter")));
  const [userType, setUserType] = useState<UserTypeValue>(getInitialUserType(searchParams.get("userType")));
  const [sort, setSort] = useState<SortValue>(getInitialSort(searchParams.get("sort")));
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUsers = useCallback(async (q = search, f = filter, p = page, type = userType, sortBy = sort) => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ page: String(p), filter: f, userType: type, sort: sortBy });
      if (q) params.set("search", q);

      const res = await fetch(`/api/admin/platform/users?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load users.");

      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
      setCounts(data.counts ?? DEFAULT_COUNTS);
      setRoleCounts(data.roleCounts ?? DEFAULT_ROLE_COUNTS);
      setHasMore(Boolean(data.hasMore));
      setSupportHospitals(data.supportAssignableHospitals ?? []);
      setCurrentUserId(data.currentUserId ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [search, filter, page, userType, sort]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchUsers(search, filter, page, userType, sort);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchUsers, search, filter, page, userType, sort]);

  useEffect(() => {
    return () => {
      if (searchRef.current) clearTimeout(searchRef.current);
    };
  }, []);

  const visiblePendingRequests = useMemo(
    () => users.reduce((sum, user) => sum + user.memberships.filter((membership) => membership.status === "PENDING").length, 0),
    [users],
  );

  const handleSearch = (val: string) => {
    setSearchInput(val);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      setSearch(val.trim());
      setPage(1);
    }, 300);
  };

  const handleMembership = async (membershipId: string, action: "APPROVE_MEMBERSHIP" | "REJECT_MEMBERSHIP") => {
    setActionLoading(membershipId + action);
    try {
      const res = await fetch("/api/admin/platform/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, membershipId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed.");
      await fetchUsers(search, filter, page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleBan = async (userId: string, banned: boolean) => {
    if (!confirm(banned ? "Unban this user?" : "Ban this user? They will lose all access.")) return;
    setActionLoading(userId + "ban");
    try {
      const res = await fetch("/api/admin/platform/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: banned ? "UNBAN_USER" : "BAN_USER", userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed.");
      await fetchUsers(search, filter, page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePlatformRoleChange = async (userId: string, role: UserRole) => {
    if (!confirm(`Change this user's platform role to ${PLATFORM_ROLE_LABELS[role]}?`)) return;
    setActionLoading(userId + "role");
    try {
      const res = await fetch("/api/admin/platform/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UPDATE_PLATFORM_ROLE", userId, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update platform role.");
      await fetchUsers(search, filter, page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update platform role.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssignSupport = async (userId: string, hospitalId: string) => {
    if (!hospitalId) return;
    setActionLoading(userId + "assign");
    try {
      const res = await fetch("/api/admin/platform/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ASSIGN_SUPPORT", userId, hospitalId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to assign support hospital.");
      await fetchUsers(search, filter, page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign support hospital.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnassignSupport = async (assignmentId: string) => {
    if (!confirm("Remove this support assignment?")) return;
    setActionLoading(assignmentId + "unassign");
    try {
      const res = await fetch("/api/admin/platform/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UNASSIGN_SUPPORT", assignmentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to remove support assignment.");
      await fetchUsers(search, filter, page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove support assignment.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="w-full max-w-none space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#8a9ab5]">Access control</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#0f1e38]">User Directory</h1>
          <p className="mt-1 text-sm font-semibold text-[#8a9ab5]">
            Review platform roles, hospital access, support scope, and account restrictions.
          </p>
        </div>
        <button
          onClick={() => fetchUsers()}
          className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-[#5f6f8d] shadow-sm transition hover:border-[#c8a96e] hover:text-[#9c7939] focus:outline-none focus:ring-2 focus:ring-[#c8a96e]/30"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      <div className="admin-control-panel">
        <div className="admin-control-row">
          <div className="admin-search-control">
            <Search size={14} className="admin-search-icon" />
            <input
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="admin-search-input"
            />
          </div>

          <div className="admin-control-row-nowrap">
            {FILTERS.map((item) => {
              const active = filter === item.value;
              return (
                <button
                  key={item.value}
                  onClick={() => {
                    setFilter(item.value);
                    setPage(1);
                  }}
                  className={`admin-filter-pill ${active ? "admin-filter-pill-active" : ""}`}
                >
                  {item.label}
                  <span className="admin-filter-count">{counts[item.countKey]}</span>
                </button>
              );
            })}
          </div>

          <select
            value={userType}
            onChange={(event) => {
              setUserType(event.target.value as UserTypeValue);
              setPage(1);
            }}
            className="admin-select-control min-w-[178px]"
            aria-label="Filter by user type"
          >
            {USER_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} ({roleCounts[option.countKey]})
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as SortValue);
              setPage(1);
            }}
            className="admin-select-control min-w-[150px]"
            aria-label="Sort users"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <div className="admin-page-indicator ml-auto hidden xl:inline-flex">
            Page {page}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-extrabold text-red-700">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-72 items-center justify-center rounded-[24px] border border-slate-100 bg-white">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-solid border-[#c8a96e] border-r-transparent" />
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-[24px] border border-slate-100 bg-white p-14 text-center shadow-[0_18px_50px_rgba(15,30,56,0.05)]">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fbf8f0] text-[#c8a96e]">
            <Users size={24} />
          </div>
          <p className="text-base font-extrabold text-[#0f1e38]">No users found</p>
          <p className="mt-1 text-sm font-semibold text-[#8a9ab5]">Try another search term or filter.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-[0_18px_50px_rgba(15,30,56,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-base font-extrabold text-[#0f1e38]">User access table</h2>
              <p className="text-xs font-semibold text-[#8a9ab5]">
                Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, total)} of {total}
                {visiblePendingRequests > 0 ? `, ${visiblePendingRequests} pending request${visiblePendingRequests === 1 ? "" : "s"} on this page` : ""}
              </p>
            </div>
            {total > 20 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white transition hover:border-[#c8a96e] disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} className="text-[#0f1e38]" />
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!hasMore}
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white transition hover:border-[#c8a96e] disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Next page"
                >
                  <ChevronRight size={16} className="text-[#0f1e38]" />
                </button>
              </div>
            )}
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[1220px] border-collapse text-sm">
              <thead className="bg-[#f7f4ef]">
                <tr>
                  <th className="w-[30%] px-6 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#8a9ab5]">User</th>
                  <th className="w-[22%] px-5 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#8a9ab5]">Platform role</th>
                  <th className="w-[12%] px-5 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#8a9ab5]">Joined</th>
                  <th className="w-[27%] px-5 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#8a9ab5]">Hospital access</th>
                  <th className="w-[9%] px-6 py-3 text-right text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#8a9ab5]">Account</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => {
                  const cannotBan = user.id === currentUserId || isPlatformAdmin(user.role);
                  return (
                    <tr key={user.id} className="align-top transition hover:bg-[#fbfaf7]" style={{ opacity: user.bannedAt ? 0.68 : 1 }}>
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-extrabold text-white ${
                              isPlatformStaff(user.role) ? "bg-[#c8a96e]" : "bg-[#6366f1]"
                            }`}
                          >
                            {initials(user.fullName)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="max-w-[260px] truncate text-base font-extrabold text-[#0f1e38]">{user.fullName}</p>
                              {user.bannedAt && (
                                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-extrabold text-red-700">Banned</span>
                              )}
                            </div>
                            <p className="mt-0.5 max-w-[310px] truncate text-xs font-semibold text-[#7890b2]">{user.email}</p>
                            <p className="mt-1 text-[11px] font-bold text-[#b1bfd2]">
                              {user.bookingCount} booking{user.bookingCount !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="space-y-3">
                          <select
                            value={user.role}
                            disabled={actionLoading === user.id + "role"}
                            onChange={(e) => handlePlatformRoleChange(user.id, e.target.value as UserRole)}
                            className={`h-10 w-full max-w-[260px] cursor-pointer rounded-xl border px-3 text-sm font-extrabold outline-none transition focus:ring-2 focus:ring-[#c8a96e]/30 disabled:cursor-not-allowed disabled:opacity-50 ${
                              isPlatformStaff(user.role)
                                ? "border-[#efe2c6] bg-[#fbf8f0] text-[#9c7939]"
                                : "border-slate-200 bg-white text-[#5f6f8d]"
                            }`}
                          >
                            {PLATFORM_ROLE_OPTIONS.map((role) => (
                              <option key={role} value={role}>{PLATFORM_ROLE_LABELS[role]}</option>
                            ))}
                          </select>

                          {user.role === "PLATFORM_SUPPORT" && (
                            <div className="space-y-2">
                              {user.supportAssignments.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {user.supportAssignments.map((assignment) => (
                                    <span
                                      key={assignment.id}
                                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-2.5 pr-1 text-[11px] font-extrabold text-[#5f6f8d]"
                                    >
                                      {assignment.hospitalName}
                                      <button
                                        onClick={() => handleUnassignSupport(assignment.id)}
                                        disabled={actionLoading === assignment.id + "unassign"}
                                        className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                                        aria-label={`Remove ${assignment.hospitalName} support assignment`}
                                      >
                                        <XCircle size={12} />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                              <select
                                value=""
                                disabled={actionLoading === user.id + "assign"}
                                onChange={(e) => handleAssignSupport(user.id, e.target.value)}
                                className="h-9 w-full max-w-[260px] cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-xs font-extrabold text-[#5f6f8d] outline-none focus:ring-2 focus:ring-[#c8a96e]/30 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <option value="">{user.supportAssignments.length ? "Assign another hospital..." : "Assign support hospital..."}</option>
                                {supportHospitals
                                  .filter((hospital) => !user.supportAssignments.some((assignment) => assignment.hospitalId === hospital.id))
                                  .map((hospital) => (
                                    <option key={hospital.id} value={hospital.id}>{hospital.name}</option>
                                  ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="text-sm font-extrabold text-[#0f1e38]">{formatDate(user.createdAt)}</span>
                      </td>

                      <td className="px-5 py-4">
                        {user.memberships.length === 0 ? (
                          <div className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs font-bold text-[#8a9ab5]">
                            <Building2 size={14} />
                            No hospital access
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {user.memberships.map((membership) => {
                              const busy = actionLoading?.startsWith(membership.id);
                              return (
                                <div key={membership.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="max-w-[290px] truncate text-sm font-extrabold text-[#0f1e38]">{membership.hospitalName}</p>
                                      <div className="mt-2 flex flex-wrap gap-1.5">
                                        <RolePill role={membership.role} />
                                        <StatusPill status={membership.status} />
                                      </div>
                                    </div>
                                    {membership.status === "PENDING" && (
                                      <div className="flex shrink-0 items-center gap-1.5">
                                        <button
                                          onClick={() => handleMembership(membership.id, "APPROVE_MEMBERSHIP")}
                                          disabled={!!busy}
                                          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-50 px-2.5 text-[11px] font-extrabold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          <CheckCircle2 size={12} />
                                          {actionLoading === membership.id + "APPROVE_MEMBERSHIP" ? "Saving" : "Approve"}
                                        </button>
                                        <button
                                          onClick={() => handleMembership(membership.id, "REJECT_MEMBERSHIP")}
                                          disabled={!!busy}
                                          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xl bg-red-50 px-2.5 text-[11px] font-extrabold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          <XCircle size={12} />
                                          {actionLoading === membership.id + "REJECT_MEMBERSHIP" ? "Saving" : "Reject"}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleBan(user.id, !!user.bannedAt)}
                          disabled={actionLoading === user.id + "ban" || cannotBan}
                          className={`inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-extrabold transition focus:outline-none focus:ring-2 focus:ring-red-200 disabled:cursor-not-allowed disabled:opacity-30 ${
                            user.bannedAt
                              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "bg-red-50 text-red-700 hover:bg-red-100"
                          }`}
                          title={cannotBan ? "Platform admins and your own account cannot be banned here." : undefined}
                        >
                          <Ban size={13} />
                          {actionLoading === user.id + "ban" ? "Saving" : user.bannedAt ? "Unban" : "Ban"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlatformUsersPage() {
  return (
    <Suspense fallback={<div className="flex h-56 items-center justify-center"><div className="h-9 w-9 animate-spin rounded-full border-2 border-solid border-[#c8a96e] border-r-transparent" /></div>}>
      <UsersContent />
    </Suspense>
  );
}
