"use client";

import { useEffect, useState, useCallback, useRef, Fragment } from "react";
import {
  Inbox,
  Search,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  MessageSquare,
  CheckCircle2,
  XCircle,
  ChevronDown,
} from "lucide-react";

type Inquiry = {
  id: string; hospitalId: string | null; hospitalName: string; type: "HOSPITAL" | "CLINIC" | "LAB";
  contactName: string; email: string; phone: string; city: string;
  message: string | null; status: "NEW" | "REVIEWED" | "CONTACTED" | "ONBOARDED" | "REJECTED";
  reviewNotes: string | null; reviewedAt: string | null; createdAt: string;
};

const STATUS_CONFIG: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  NEW:       { bg: "rgba(99,102,241,.1)",   color: "#4f46e5", dot: "#6366f1", label: "New" },
  REVIEWED:  { bg: "rgba(245,158,11,.1)",   color: "#b45309", dot: "#f59e0b", label: "Reviewed" },
  CONTACTED: { bg: "rgba(14,165,233,.1)",   color: "#0284c7", dot: "#0ea5e9", label: "Contacted" },
  ONBOARDED: { bg: "rgba(16,185,129,.1)",   color: "#065f46", dot: "#10b981", label: "Onboarded" },
  REJECTED:  { bg: "rgba(239,68,68,.08)",   color: "#991b1b", dot: "#ef4444", label: "Rejected" },
};

const TYPE_LABELS: Record<string, string> = {
  HOSPITAL: "Hospital", CLINIC: "Clinic", LAB: "Laboratory",
};

const NEXT_ACTIONS: Record<string, { status: string; label: string; color: string; bg: string }[]> = {
  NEW:       [{ status: "REVIEWED",  label: "Mark Reviewed",  color: "#b45309", bg: "rgba(245,158,11,.1)"  }, { status: "REJECTED", label: "Reject", color: "#dc2626", bg: "rgba(239,68,68,.07)" }],
  REVIEWED:  [{ status: "CONTACTED", label: "Mark Contacted", color: "#0284c7", bg: "rgba(14,165,233,.1)"  }, { status: "REJECTED", label: "Reject", color: "#dc2626", bg: "rgba(239,68,68,.07)" }],
  CONTACTED: [{ status: "ONBOARDED", label: "Approve + Create", color: "#059669", bg: "rgba(16,185,129,.1)" }, { status: "REJECTED", label: "Reject", color: "#dc2626", bg: "rgba(239,68,68,.07)" }],
  ONBOARDED: [],
  REJECTED:  [{ status: "NEW", label: "Reopen", color: "#4f46e5", bg: "rgba(99,102,241,.1)" }],
};

const FILTERS = [
  { value: "all", label: "All" }, { value: "NEW", label: "New" },
  { value: "REVIEWED", label: "Reviewed" }, { value: "CONTACTED", label: "Contacted" },
  { value: "ONBOARDED", label: "Onboarded" }, { value: "REJECTED", label: "Rejected" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function PlatformInquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [total, setTotal] = useState(0);
  const [canFinalize, setCanFinalize] = useState(false);
  const [scope, setScope] = useState<"platform" | "assigned">("platform");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filter, setFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchInquiries = useCallback(async (q = search, f = filter, p = page) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(p), status: f });
      if (q) params.set("search", q);
      const res = await fetch(`/api/admin/platform/inquiries?${params}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setInquiries(data.inquiries); setTotal(data.total); setHasMore(data.hasMore);
      setCanFinalize(!!data.canFinalize);
      setScope(data.scope ?? "platform");
    } catch { setError("Failed to load inquiries."); }
    finally { setLoading(false); }
  }, [search, filter, page]);

  useEffect(() => { fetchInquiries(search, filter, page); }, [search, filter, page]); // eslint-disable-line

  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => { setSearch(val); setPage(1); }, 350);
  };

  const handleAction = async (id: string, status: string) => {
    if (status === "ONBOARDED" && !window.confirm("Approve setup and create the hospital with a main hospital admin?")) return;
    if (status === "REJECTED" && !window.confirm("Reject this hospital setup inquiry?")) return;

    setActionLoading(id + status);
    try {
      const res = await fetch("/api/admin/platform/inquiries", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, reviewNotes: notesDraft[id] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      await fetchInquiries(search, filter, page);
      setExpandedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    }
    finally { setActionLoading(null); }
  };

  const handleSaveNotes = async (id: string, currentStatus: string) => {
    setActionLoading(id + "notes");
    try {
      const res = await fetch("/api/admin/platform/inquiries", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: currentStatus, reviewNotes: notesDraft[id] ?? "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      await fetchInquiries(search, filter, page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save notes.");
    }
    finally { setActionLoading(null); }
  };

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-[#0f1e38]">Partner Inquiries</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {total} inquir{total !== 1 ? "ies" : "y"} {scope === "assigned" ? "in assigned support scope" : "waiting for hospital setup"}
          </p>
        </div>
        <button
          onClick={() => fetchInquiries()}
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

      <div className="admin-control-panel space-y-3">
        <div className="admin-control-row">
          <div className="admin-search-control">
            <Search size={14} className="admin-search-icon" />
            <input
              value={searchInput}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Search hospital, contact, email, city..."
              className="admin-search-input"
            />
          </div>
          <p className="admin-page-indicator ml-auto">
            Page {page}
          </p>
        </div>

        <div className="admin-filter-row">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => {
                setFilter(f.value);
                setPage(1);
              }}
              className={`admin-filter-pill ${filter === f.value ? "admin-filter-pill-active" : ""}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          className="p-3 rounded-2xl text-sm font-semibold text-red-600 flex items-center gap-2"
          style={{
            background: "#fef2f2",
            border: "1px solid rgba(220,38,38,.2)",
          }}
        >
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-56">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-solid border-[#c8a96e] border-r-transparent" />
        </div>
      ) : inquiries.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center mx-auto mb-3"
            style={{ background: "rgba(200,169,110,.1)" }}
          >
            <Inbox size={20} className="text-[#c8a96e]" />
          </div>
          <p className="text-sm font-semibold text-[#0f1e38]">No inquiries found</p>
          <p className="text-xs mt-1 text-gray-400">New partner applications will appear here</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="w-full">
            <table className="w-full table-fixed text-sm">
              <thead style={{ background: "#f7f4ef" }}>
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">Contact</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">Organization</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">Location</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">Status</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">Submitted</th>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">Actions</th>
                  <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">Details</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.map((inq) => {
                  const st = STATUS_CONFIG[inq.status];
                  const actions = (NEXT_ACTIONS[inq.status] ?? []).filter((action) =>
                    canFinalize || action.status === "REVIEWED" || action.status === "CONTACTED"
                  );
                  const isExpanded = expandedId === inq.id;

                  return (
                    <Fragment key={inq.id}>
                      <tr className="border-t border-gray-100 hover:bg-[#fcfbf8]">
                        <td className="px-4 py-3.5 align-top break-words">
                          <p className="text-xs font-bold text-[#0f1e38]">{inq.contactName}</p>
                          <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                            <Mail size={10} /> {inq.email}
                          </p>
                          <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                            <Phone size={10} /> {inq.phone}
                          </p>
                        </td>

                        <td className="px-4 py-3.5 align-top break-words">
                          <p className="text-xs font-bold text-[#0f1e38]">{inq.hospitalName}</p>
                          <span
                            className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(200,169,110,.12)", color: "#a88b50" }}
                          >
                            {TYPE_LABELS[inq.type] ?? inq.type}
                          </span>
                          {inq.hospitalId && (
                            <p className="text-[11px] font-semibold text-emerald-600 mt-1">
                              Hospital record created
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-3.5 align-top break-words">
                          <p className="text-xs text-[#0f1e38] flex items-center gap-1">
                            <MapPin size={11} className="text-gray-400" /> {inq.city}
                          </p>
                        </td>

                        <td className="px-4 py-3.5 align-top break-words">
                          <span
                            className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full"
                            style={{ background: st.bg, color: st.color }}
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.dot }} />
                            {st.label}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 align-top break-words">
                          <p className="text-xs font-semibold text-[#0f1e38]">{formatDate(inq.createdAt)}</p>
                          <p className="text-[11px] text-gray-400">
                            {inq.reviewedAt ? `Reviewed ${formatDate(inq.reviewedAt)}` : "Not reviewed"}
                          </p>
                        </td>

                        <td className="px-4 py-3.5 align-top break-words">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {actions.length === 0 ? (
                              <span className="text-xs text-gray-400">No actions</span>
                            ) : (
                              actions.map((a) => (
                                <button
                                  key={a.status}
                                  onClick={() => handleAction(inq.id, a.status)}
                                  disabled={!!actionLoading}
                                  className="h-7 px-2.5 rounded-lg text-[11px] font-semibold disabled:opacity-50 transition-all inline-flex items-center gap-1"
                                  style={{ background: a.bg, color: a.color }}
                                >
                                  {a.status === "REJECTED" ? <XCircle size={11} /> : <CheckCircle2 size={11} />}
                                  {actionLoading === inq.id + a.status ? "..." : a.label}
                                </button>
                              ))
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-right align-top break-words">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : inq.id)}
                            className="h-8 px-3 rounded-xl text-xs font-semibold border"
                            style={{
                              borderColor: "rgba(15,30,56,.12)",
                              color: "#0f1e38",
                              background: "#fff",
                            }}
                          >
                            Notes
                            <ChevronDown
                              size={12}
                              className={`inline ml-1 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            />
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="border-t border-gray-100 bg-[#fcfbf8]">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="grid lg:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1">
                                  <MessageSquare size={10} /> Applicant message
                                </p>
                                <p className="text-xs text-[#0f1e38] leading-relaxed">
                                  {inq.message || "No message provided."}
                                </p>
                              </div>

                              <div className="space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                  Internal notes
                                </p>
                                <textarea
                                  value={notesDraft[inq.id] ?? inq.reviewNotes ?? ""}
                                  onChange={(e) =>
                                    setNotesDraft((prev) => ({ ...prev, [inq.id]: e.target.value }))
                                  }
                                  rows={3}
                                  placeholder="Add internal notes..."
                                  className="w-full text-xs rounded-xl px-3 py-2 resize-none outline-none transition-all bg-white border border-gray-200 text-[#0f1e38] placeholder-gray-300"
                                />
                                <button
                                  onClick={() => handleSaveNotes(inq.id, inq.status)}
                                  disabled={actionLoading === inq.id + "notes"}
                                  className="h-8 px-3 rounded-lg text-xs font-semibold disabled:opacity-50 transition-all border border-gray-200 text-[#0f1e38] hover:border-[#c8a96e] hover:text-[#c8a96e] bg-white"
                                >
                                  {actionLoading === inq.id + "notes" ? "Saving..." : "Save notes"}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {total > 20 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs font-semibold text-[#8a9ab5]">
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}
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
