"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  ShieldCheck,
  Search,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Building2,
  ArrowRight,
} from "lucide-react";
import { isPlatformStaff } from "@/lib/admin-roles";

type Actor = { id: string; name: string; email: string; role: string };
type Hospital = { id: string; name: string; slug: string };
type LogEntry = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  before: unknown;
  after: unknown;
  createdAt: string;
  actor: Actor;
  hospital: Hospital | null;
};

const FIELD_LABELS: Record<string, string> = {
  status: "Status",
  reason: "Reason",
  stripeRefundId: "Stripe Refund ID",
  bannedAt: "Banned",
  role: "Role",
  isActive: "Active",
  verified: "Verified",
  hidden: "Hidden",
  rejectedReason: "Rejection reason",
  emergencyAvailable: "Emergency available",
  openingHours: "Opening hours",
  phone: "Phone",
  email: "Email",
  website: "Website",
  servicesSummary: "Services summary",
};

function fmtVal(key: string, val: unknown): string {
  if (val === null || val === undefined) return "-";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (key === "bannedAt") {
    return val
      ? `Banned at ${new Date(String(val)).toLocaleString("en-GB")}`
      : "Not banned";
  }
  return String(val);
}

function DiffView({ before, after }: { before: unknown; after: unknown }) {
  const b = (before && typeof before === "object" ? before : {}) as Record<string, unknown>;
  const a = (after && typeof after === "object" ? after : {}) as Record<string, unknown>;

  const changes = [...new Set([...Object.keys(b), ...Object.keys(a)])]
    .map((key) => ({ key, old: b[key], next: a[key] }))
    .filter((c) => JSON.stringify(c.old) !== JSON.stringify(c.next));

  if (!changes.length) {
    return (
      <p className="text-xs italic text-gray-400 px-4 py-3">
        No field changes recorded.
      </p>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{ border: "1px solid rgba(15,30,56,.08)" }}
    >
      <div className="px-4 py-2.5" style={{ background: "#f7f4ef" }}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          Changes
        </p>
      </div>
      <div className="divide-y divide-gray-50 bg-white">
        {changes.map(({ key, old, next }) => {
          const label =
            FIELD_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").trim();
          const hasOld = old !== undefined && old !== null;
          const hasNew = next !== undefined && next !== null;
          return (
            <div key={key} className="flex items-center gap-3 px-4 py-3 flex-wrap">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide w-28 flex-shrink-0">
                {label}
              </span>
              <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                {hasOld && (
                  <span
                    className="text-xs font-medium px-2.5 py-1 rounded-lg"
                    style={{ background: "rgba(239,68,68,.07)", color: "#dc2626" }}
                  >
                    {fmtVal(key, old)}
                  </span>
                )}
                {hasOld && hasNew && (
                  <ArrowRight size={11} className="text-gray-300 flex-shrink-0" />
                )}
                {hasNew && (
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                    style={{ background: "rgba(16,185,129,.08)", color: "#059669" }}
                  >
                    {fmtVal(key, next)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ACTION_CONFIG: Record<string, { bg: string; color: string }> = {
  BOOKING_CONFIRMED: { bg: "rgba(99,102,241,.1)", color: "#4338ca" },
  BOOKING_CANCELLED: { bg: "rgba(239,68,68,.08)", color: "#dc2626" },
  BOOKING_COMPLETED: { bg: "rgba(16,185,129,.1)", color: "#065f46" },
  BOOKING_CHECKIN: { bg: "rgba(16,185,129,.08)", color: "#059669" },
  MEMBER_APPROVED: { bg: "rgba(16,185,129,.1)", color: "#065f46" },
  MEMBER_REJECTED: { bg: "rgba(239,68,68,.08)", color: "#dc2626" },
  MEMBER_REMOVED: { bg: "rgba(239,68,68,.1)", color: "#b91c1c" },
  MEMBER_ROLE_CHANGED: { bg: "rgba(245,158,11,.1)", color: "#b45309" },
  BAN_USER: { bg: "rgba(239,68,68,.1)", color: "#b91c1c" },
  UNBAN_USER: { bg: "rgba(16,185,129,.08)", color: "#059669" },
  HOSPITAL_VERIFIED: { bg: "rgba(200,169,110,.15)", color: "#a88b50" },
  HOSPITAL_UNVERIFIED: { bg: "rgba(245,158,11,.1)", color: "#b45309" },
  HOSPITAL_REACTIVATED: { bg: "rgba(16,185,129,.1)", color: "#065f46" },
  HOSPITAL_SUSPENDED: { bg: "rgba(239,68,68,.08)", color: "#dc2626" },
  HOSPITAL_CREATED_FROM_INQUIRY: { bg: "rgba(16,185,129,.1)", color: "#065f46" },
  HOSPITAL_LINKED_FROM_INQUIRY: { bg: "rgba(14,165,233,.1)", color: "#0284c7" },
  INITIAL_OWNER_ASSIGNED: { bg: "rgba(16,185,129,.1)", color: "#065f46" },
  INQUIRY_ONBOARDED: { bg: "rgba(16,185,129,.1)", color: "#065f46" },
  INQUIRY_TRIAGED: { bg: "rgba(245,158,11,.1)", color: "#b45309" },
  INQUIRY_NOTES_UPDATED: { bg: "rgba(14,165,233,.1)", color: "#0284c7" },
  SUPPORT_ASSIGNED: { bg: "rgba(16,185,129,.1)", color: "#065f46" },
  SUPPORT_UNASSIGNED: { bg: "rgba(239,68,68,.08)", color: "#dc2626" },
  PLATFORM_REVENUE_EXPORTED: { bg: "rgba(200,169,110,.15)", color: "#a88b50" },
  HOSPITAL_ONBOARDING_CREATED: { bg: "rgba(99,102,241,.1)", color: "#4338ca" },
  HOSPITAL_ONBOARDING_UPDATED: { bg: "rgba(245,158,11,.1)", color: "#b45309" },
  HOSPITAL_ONBOARDING_NOTE_ADDED: { bg: "rgba(14,165,233,.1)", color: "#0284c7" },
  HOSPITAL_SHELL_CREATED_FROM_ONBOARDING: { bg: "rgba(16,185,129,.1)", color: "#065f46" },
  HOSPITAL_ONBOARDING_PUBLISHED: { bg: "rgba(16,185,129,.12)", color: "#047857" },
};

function getStyle(action: string) {
  return ACTION_CONFIG[action] ?? { bg: "rgba(107,114,128,.1)", color: "#374151" };
}

function humanize(action: string) {
  return action
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const ENTITY_FILTERS = [
  { value: "all", label: "All" },
  { value: "Booking", label: "Bookings" },
  { value: "HospitalMembership", label: "Memberships" },
  { value: "User", label: "Users" },
  { value: "Hospital", label: "Hospitals" },
  { value: "HospitalPackage", label: "Packages" },
  { value: "Review", label: "Reviews" },
  { value: "AvailabilitySlot", label: "Slots" },
  { value: "SupportAssignment", label: "Support" },
  { value: "HospitalOnboarding", label: "Onboarding" },
  { value: "PlatformRevenue", label: "Revenue" },
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PlatformAuditLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [hospitals, setHospitals] = useState<{ id: string; name: string }[]>([]);
  const [scope, setScope] = useState<"platform" | "assigned">("platform");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [hospitalFilter, setHospitalFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLogs = useCallback(
    async (q = search, e = entityFilter, h = hospitalFilter, p = page) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ page: String(p), entity: e });
        if (q) params.set("search", q);
        if (h) params.set("hospitalId", h);
        const res = await fetch(`/api/admin/platform/audit-logs?${params}`);
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        setLogs(data.logs);
        setTotal(data.total);
        setHasMore(data.hasMore);
        setScope(data.scope ?? "platform");
        setHospitals(data.hospitals ?? []);
      } catch {
        setError("Failed to load audit logs.");
      } finally {
        setLoading(false);
      }
    },
    [search, entityFilter, hospitalFilter, page],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchLogs(search, entityFilter, hospitalFilter, page);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchLogs, search, entityFilter, hospitalFilter, page]);

  const handleSearch = (val: string) => {
    setSearchInput(val);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 350);
  };

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#0f1e38]">Audit Logs</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {total.toLocaleString()} action{total !== 1 ? "s" : ""} recorded
            {scope === "assigned" ? " in assigned support scope" : ""}
          </p>
        </div>
        <button
          onClick={() => fetchLogs()}
          className="flex items-center gap-2 h-9 px-3 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: "#fff",
            border: "1.5px solid rgba(15,30,56,.1)",
            color: "#6b7a96",
          }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <div className="grid md:grid-cols-[1fr_auto] gap-2.5">
          <div className="flex items-center gap-2 h-10 rounded-xl px-3 bg-[#f7f4ef] border border-gray-100">
            <Search size={13} className="text-gray-400 flex-shrink-0" />
            <input
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search actor name or email..."
              className="flex-1 text-sm outline-none bg-transparent text-[#0f1e38] placeholder-gray-400"
            />
          </div>
          <select
            value={hospitalFilter}
            onChange={(e) => {
              setHospitalFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl px-3 text-xs font-semibold outline-none cursor-pointer border border-gray-100 bg-white"
          >
            <option value="">All hospitals</option>
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {ENTITY_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => {
                setEntityFilter(f.value);
                setPage(1);
              }}
              className="h-8 px-3 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: entityFilter === f.value ? "#0f1e38" : "#fff",
                color: entityFilter === f.value ? "#c8a96e" : "#6b7a96",
                border:
                  entityFilter === f.value
                    ? "none"
                    : "1.5px solid rgba(15,30,56,.09)",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          className="p-3 rounded-2xl text-sm font-semibold text-red-600 flex items-center gap-2"
          style={{ background: "#fef2f2", border: "1px solid rgba(220,38,38,.2)" }}
        >
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-56">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-solid border-[#c8a96e] border-r-transparent" />
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center mx-auto mb-3"
            style={{ background: "rgba(200,169,110,.1)" }}
          >
            <ShieldCheck size={20} className="text-[#c8a96e]" />
          </div>
          <p className="text-sm font-semibold text-[#0f1e38]">No audit logs found</p>
          <p className="text-xs mt-1 text-gray-400">Admin actions will appear here</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {logs.map((log) => {
              const style = getStyle(log.action);
              const isExpanded = expandedId === log.id;
              const hasDiff = Boolean(log.before || log.after);
              const isAdmin = isPlatformStaff(log.actor.role);

              return (
                <div
                  key={log.id}
                  className="hover:bg-[#fcfbf8] transition-colors"
                >
                  <div className="flex items-start gap-3.5 px-5 py-4">
                    {/* Avatar */}
                    <div
                      className="h-9 w-9 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white mt-0.5"
                      style={{ background: isAdmin ? "#c8a96e" : "#6366f1" }}
                    >
                      {log.actor.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        {/* Left */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="text-sm font-bold text-[#0f1e38]">
                              {log.actor.name}
                            </span>
                            <span
                              className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0"
                              style={{ background: style.bg, color: style.color }}
                            >
                              {humanize(log.action)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-[11px] text-gray-400">
                              {log.actor.email}
                            </span>
                            <span className="text-gray-200 text-xs select-none">·</span>
                            <span className="text-[11px] text-gray-500 font-medium">
                              {log.entity}
                            </span>
                            <code
                              className="text-[10px] text-gray-400 px-1.5 py-0.5 rounded font-mono"
                              style={{ background: "rgba(15,30,56,.05)" }}
                            >
                              {log.entityId.slice(0, 12)}…
                            </code>
                            {log.hospital ? (
                              <>
                                <span className="text-gray-200 text-xs select-none">·</span>
                                <span className="text-[11px] text-gray-500 flex items-center gap-1">
                                  <Building2 size={10} className="text-gray-400" />
                                  {log.hospital.name}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="text-gray-200 text-xs select-none">·</span>
                                <span
                                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                  style={{
                                    background: "rgba(200,169,110,.12)",
                                    color: "#a88b50",
                                  }}
                                >
                                  Platform
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Right: Time + Expand */}
                        <div className="flex items-center gap-2.5 flex-shrink-0">
                          <div className="text-right hidden sm:block">
                            <p className="text-xs font-semibold text-[#0f1e38]">
                              {timeAgo(log.createdAt)}
                            </p>
                            <p className="text-[11px] text-gray-400">
                              {fmtDateTime(log.createdAt)}
                            </p>
                          </div>
                          {hasDiff && (
                            <button
                              onClick={() =>
                                setExpandedId((prev) =>
                                  prev === log.id ? null : log.id,
                                )
                              }
                              className="h-8 w-8 rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
                              style={{
                                background: isExpanded ? "#0f1e38" : "#f7f4ef",
                                color: isExpanded ? "#c8a96e" : "#6b7a96",
                              }}
                            >
                              <ChevronDown
                                size={14}
                                className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded Diff */}
                      {isExpanded && hasDiff && (
                        <div className="mt-3">
                          <DiffView before={log.before} after={log.after} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {total > 30 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs font-semibold text-[#8a9ab5]">
            Showing {(page - 1) * 30 + 1}–{Math.min(page * 30, total)} of{" "}
            {total.toLocaleString()}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-9 w-9 rounded-xl flex items-center justify-center disabled:opacity-30"
              style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.1)" }}
            >
              <ChevronLeft size={15} className="text-[#0f1e38]" />
            </button>
            <span
              className="h-8 px-3 flex items-center text-xs font-semibold text-[#0f1e38]"
              style={{
                background: "#fff",
                border: "1.5px solid rgba(15,30,56,.1)",
                borderRadius: 12,
              }}
            >
              {page}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className="h-9 w-9 rounded-xl flex items-center justify-center disabled:opacity-30"
              style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.1)" }}
            >
              <ChevronRight size={15} className="text-[#0f1e38]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
