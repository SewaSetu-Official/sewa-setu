"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Users, Search, RefreshCw, AlertCircle, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Ban } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

type Membership = {
  id: string; role: string; status: string;
  hospitalName: string; hospitalSlug: string;
};

type User = {
  id: string; fullName: string; email: string; phone: string | null;
  role: string; bannedAt: string | null; createdAt: string;
  bookingCount: number; memberships: Membership[];
};

const ROLE_LABELS: Record<string, string> = {
  HOSPITAL_OWNER: "Owner", HOSPITAL_MANAGER: "Manager",
  RECEPTION: "Receptionist", CONTENT_EDITOR: "Content Editor",
};

const STATUS_CONFIG: Record<string, { bg: string; color: string }> = {
  APPROVED: { bg: "rgba(16,185,129,.1)",  color: "#059669" },
  PENDING:  { bg: "rgba(245,158,11,.1)", color: "#b45309" },
  REJECTED: { bg: "rgba(239,68,68,.08)", color: "#dc2626" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function UsersContent() {
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filter, setFilter] = useState(searchParams.get("filter") ?? "all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUsers = useCallback(async (q = search, f = filter, p = page) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(p), filter: f });
      if (q) params.set("search", q);
      const res = await fetch(`/api/admin/platform/users?${params}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setUsers(data.users);
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch {
      setError("Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [search, filter, page]); // eslint-disable-line

  useEffect(() => { fetchUsers(search, filter, page); }, [search, filter, page]); // eslint-disable-line

  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => { setSearch(val); setPage(1); }, 350);
  };

  const handleMembership = async (membershipId: string, action: "APPROVE_MEMBERSHIP" | "REJECT_MEMBERSHIP") => {
    setActionLoading(membershipId + action);
    try {
      const res = await fetch("/api/admin/platform/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, membershipId }),
      });
      if (!res.ok) throw new Error("Failed");
      await fetchUsers(search, filter, page);
    } catch {
      setError("Action failed.");
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
      if (!res.ok) throw new Error("Failed");
      await fetchUsers(search, filter, page);
    } catch {
      setError("Action failed.");
    } finally {
      setActionLoading(null);
    }
  };

  const FILTERS = [
    { value: "all",     label: "All Users" },
    { value: "pending", label: "Pending Requests" },
    { value: "banned",  label: "Banned" },
  ];

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[#0f1e38]">Users</h1>
          <p className="text-sm text-gray-400 mt-0.5">{total} user{total !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => fetchUsers()}
          className="flex items-center gap-2 px-3 h-9 rounded-xl text-xs font-semibold transition-all"
          style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.1)", color: "#6b7a96" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#c8a96e"; e.currentTarget.style.color = "#c8a96e"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(15,30,56,.1)"; e.currentTarget.style.color = "#6b7a96"; }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 h-9 rounded-xl px-3 bg-white border border-gray-100 flex-1 min-w-48">
          <Search size={13} className="text-gray-400" />
          <input value={searchInput} onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Search by name or email..."
            className="flex-1 text-sm outline-none bg-transparent text-[#0f1e38] placeholder-gray-400" />
        </div>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button key={f.value} onClick={() => { setFilter(f.value); setPage(1); }}
              className="h-9 px-3 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: filter === f.value ? "#0f1e38" : "#fff",
                color: filter === f.value ? "#c8a96e" : "#6b7a96",
                border: filter === f.value ? "none" : "1.5px solid rgba(15,30,56,.1)",
              }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl text-sm font-semibold text-red-600 flex items-center gap-2"
          style={{ background: "#fef2f2", border: "1px solid rgba(220,38,38,.2)" }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-solid border-[#c8a96e] border-r-transparent" />
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <Users size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No users found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <div key={user.id} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3"
              style={{ opacity: user.bannedAt ? 0.65 : 1 }}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold"
                    style={{ background: "rgba(200,169,110,.12)", color: "#c8a96e" }}>
                    {user.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-[#0f1e38] text-sm">{user.fullName}</p>
                      {user.bannedAt && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: "rgba(239,68,68,.08)", color: "#dc2626" }}>Banned</span>
                      )}
                      {user.role === "PLATFORM_ADMIN" && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: "rgba(200,169,110,.15)", color: "#a88b50" }}>Admin</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{user.email}</p>
                    <p className="text-[10px] text-gray-300">
                      Joined {formatDate(user.createdAt)} · {user.bookingCount} booking{user.bookingCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleBan(user.id, !!user.bannedAt)}
                  disabled={actionLoading === user.id + "ban" || user.role === "PLATFORM_ADMIN"}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold disabled:opacity-30 transition-all"
                  style={{
                    background: user.bannedAt ? "rgba(16,185,129,.08)" : "rgba(239,68,68,.06)",
                    color: user.bannedAt ? "#059669" : "#dc2626",
                  }}>
                  <Ban size={12} />
                  {actionLoading === user.id + "ban" ? "..." : user.bannedAt ? "Unban" : "Ban"}
                </button>
              </div>

              {/* Memberships */}
              {user.memberships.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-gray-50">
                  {user.memberships.map((m) => {
                    const st = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.PENDING;
                    const busy = actionLoading?.startsWith(m.id);
                    return (
                      <div key={m.id} className="flex items-center gap-3 flex-wrap">
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#0f1e38] truncate">{m.hospitalName}</span>
                          <span className="text-xs text-gray-400">·</span>
                          <span className="text-xs text-gray-400">{ROLE_LABELS[m.role] ?? m.role}</span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: st.bg, color: st.color }}>
                            {m.status.charAt(0) + m.status.slice(1).toLowerCase()}
                          </span>
                        </div>
                        {m.status === "PENDING" && (
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => handleMembership(m.id, "APPROVE_MEMBERSHIP")}
                              disabled={!!busy}
                              className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-bold disabled:opacity-50"
                              style={{ background: "rgba(16,185,129,.1)", color: "#059669" }}>
                              <CheckCircle2 size={11} />
                              {actionLoading === m.id + "APPROVE_MEMBERSHIP" ? "..." : "Approve"}
                            </button>
                            <button
                              onClick={() => handleMembership(m.id, "REJECT_MEMBERSHIP")}
                              disabled={!!busy}
                              className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-bold disabled:opacity-50"
                              style={{ background: "rgba(239,68,68,.08)", color: "#dc2626" }}>
                              <XCircle size={11} />
                              {actionLoading === m.id + "REJECT_MEMBERSHIP" ? "..." : "Reject"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex items-center justify-between py-2">
          <p className="text-xs text-gray-400">Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="h-8 w-8 rounded-xl flex items-center justify-center disabled:opacity-30"
              style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.1)" }}>
              <ChevronLeft size={14} className="text-[#0f1e38]" />
            </button>
            <span className="h-8 px-3 flex items-center text-xs font-semibold"
              style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.1)", borderRadius: 12 }}>{page}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={!hasMore}
              className="h-8 w-8 rounded-xl flex items-center justify-center disabled:opacity-30"
              style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.1)" }}>
              <ChevronRight size={14} className="text-[#0f1e38]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlatformUsersPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-48"><div className="h-8 w-8 animate-spin rounded-full border-2 border-solid border-[#c8a96e] border-r-transparent" /></div>}>
      <UsersContent />
    </Suspense>
  );
}
