"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Building2, Search, RefreshCw, AlertCircle,
  BadgeCheck, ToggleLeft, ToggleRight, ChevronLeft, ChevronRight,
  ShieldCheck, UserCheck, XCircle,
} from "lucide-react";

type Hospital = {
  id: string; name: string; slug: string; type: string;
  verified: boolean; verifiedAt: string | null;
  isActive: boolean; suspendedAt: string | null; suspensionReason: string | null;
  location: string | null;
  bookingCount: number; doctorCount: number; staffCount: number;
  supportAssignments: { id: string; userId: string; fullName: string; email: string }[];
  owners: OwnerRequest[];
  pendingOwnerRequests: OwnerRequest[];
  readiness: { completed: number; total: number; items: { label: string; complete: boolean }[] };
};

type OwnerRequest = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  status: string;
  createdAt: string;
};

export default function PlatformHospitalsPage() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [scope, setScope] = useState<"platform" | "assigned">("platform");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchHospitals = useCallback(async (q = search, p = page) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (q) params.set("search", q);
      const res = await fetch(`/api/admin/platform/hospitals?${params}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setHospitals(data.hospitals); setTotal(data.total); setHasMore(data.hasMore);
      setCanManage(!!data.canManage);
      setScope(data.scope ?? "platform");
    } catch { setError("Failed to load hospitals."); }
    finally { setLoading(false); }
  }, [search, page]);

  useEffect(() => { fetchHospitals(search, page); }, [search, page]); // eslint-disable-line

  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => { setSearch(val); setPage(1); }, 350);
  };

  const updateHospital = async (
    hospital: Hospital,
    payload: { verified?: boolean; isActive?: boolean; suspensionReason?: string },
    loadingKey: string,
  ) => {
    setActionLoading(hospital.id + loadingKey);
    try {
      const res = await fetch("/api/admin/platform/hospitals", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hospitalId: hospital.id, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setHospitals((prev) => prev.map((h) => (
        h.id === hospital.id ? { ...h, ...data.hospital } : h
      )));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update hospital.");
    }
    finally { setActionLoading(null); }
  };

  const handleVerification = async (hospital: Hospital) => {
    await updateHospital(hospital, { verified: !hospital.verified }, "verified");
  };

  const handleActivation = async (hospital: Hospital) => {
    if (hospital.isActive) {
      const reason = window.prompt("Suspension reason");
      if (!reason?.trim()) return;
      await updateHospital(hospital, { isActive: false, suspensionReason: reason }, "active");
      return;
    }

    if (!window.confirm("Reactivate this hospital?")) return;
    await updateHospital(hospital, { isActive: true }, "active");
  };

  const handleOwnerRequest = async (hospital: Hospital, request: OwnerRequest, ownerStatus: "APPROVED" | "REJECTED") => {
    const rejectedReason = ownerStatus === "REJECTED" ? window.prompt("Reason for rejecting this owner request?") : "";
    if (ownerStatus === "REJECTED" && !rejectedReason?.trim()) return;
    setActionLoading(request.id + ownerStatus);
    setError("");
    try {
      const res = await fetch("/api/admin/platform/hospitals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospitalId: hospital.id,
          ownerMembershipId: request.id,
          ownerStatus,
          rejectedReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setHospitals((prev) => prev.map((h) => {
        if (h.id !== hospital.id) return h;
        const pendingOwnerRequests = h.pendingOwnerRequests.filter((owner) => owner.id !== request.id);
        const owners = ownerStatus === "APPROVED"
          ? [...h.owners, { ...request, status: "APPROVED" }]
          : h.owners;
        return {
          ...h,
          owners,
          pendingOwnerRequests,
          readiness: {
            ...h.readiness,
            items: h.readiness.items.map((item) => item.label === "Owner" ? { ...item, complete: owners.length > 0 } : item),
            completed: h.readiness.items.filter((item) => item.label === "Owner" ? owners.length > 0 : item.complete).length,
          },
        };
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update owner request.");
    } finally {
      setActionLoading(null);
    }
  };

  const trustStats = {
    pendingOwners: hospitals.reduce((sum, hospital) => sum + hospital.pendingOwnerRequests.length, 0),
    unverified: hospitals.filter((hospital) => !hospital.verified).length,
    suspended: hospitals.filter((hospital) => !hospital.isActive).length,
  };

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[#0f1e38]">Hospitals</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {total} hospital{total !== 1 ? "s" : ""} {scope === "assigned" ? "assigned to you" : "on the platform"}
          </p>
        </div>
        <button onClick={() => fetchHospitals()}
          className="flex items-center gap-2 px-3 h-9 rounded-xl text-xs font-semibold transition-all"
          style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.1)", color: "#6b7a96" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#c8a96e"; e.currentTarget.style.color = "#c8a96e"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(15,30,56,.1)"; e.currentTarget.style.color = "#6b7a96"; }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4" style={{ background: "linear-gradient(135deg,#0f1e38,#192d52)" }}>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "rgba(200,169,110,.14)", color: "#c8a96e" }}>
              <ShieldCheck size={19} />
            </div>
            <div>
              <p className="text-base font-extrabold text-white">Platform Trust Operations</p>
              <p className="mt-1 max-w-2xl text-xs font-semibold text-white/55">
                Approve owner authority, verify hospital readiness, and control activation from one governed surface.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <TrustStat label="Owner requests" value={trustStats.pendingOwners} />
            <TrustStat label="Unverified" value={trustStats.unverified} />
            <TrustStat label="Suspended" value={trustStats.suspended} />
          </div>
        </div>
      </section>

      <div className="flex items-center gap-2 h-10 rounded-xl px-3 bg-white border border-gray-100 max-w-sm">
        <Search size={13} className="text-gray-400" />
        <input value={searchInput} onChange={(e) => handleSearchInput(e.target.value)}
          placeholder="Search hospitals..."
          className="flex-1 text-sm outline-none bg-transparent text-[#0f1e38] placeholder-gray-400" />
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
      ) : hospitals.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <Building2 size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">No hospitals found</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="hidden lg:grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.3fr)] gap-3 px-4 py-3"
            style={{ background: "#f7f4ef" }}>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Hospital</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Metrics</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Status</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Owners</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 text-right">Actions</p>
          </div>

          <div className="divide-y divide-gray-100">
            {hospitals.map((h) => (
              <div key={h.id} className="p-4" style={{ opacity: h.isActive ? 1 : 0.7 }}>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.3fr)] items-start">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(200,169,110,.1)" }}>
                      <Building2 size={16} className="text-[#c8a96e]" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-[#0f1e38] leading-tight break-words">{h.name}</p>
                      <p className="text-[11px] text-gray-400 break-all">/{h.slug}</p>
                      <p className="text-xs text-gray-500 mt-0.5 break-words">{h.location ?? h.type}</p>
                      <p className={`text-[11px] mt-1 break-words ${h.supportAssignments.length ? "text-gray-400" : "font-bold text-amber-700"}`}>
                        Support: {h.supportAssignments.length ? h.supportAssignments.map((assignment) => assignment.fullName).join(", ") : "No support assigned"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 lg:pt-1">
                    <div className="text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Bookings</p>
                      <p className="text-lg font-extrabold text-[#0f1e38] mt-0.5">{h.bookingCount}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Doctors</p>
                      <p className="text-lg font-extrabold text-[#0f1e38] mt-0.5">{h.doctorCount}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Staff</p>
                      <p className="text-lg font-extrabold text-[#0f1e38] mt-0.5">{h.staffCount}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 lg:pt-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: h.verified ? "#10b981" : "#3b82f6" }} />
                      <span className="text-xs font-semibold" style={{ color: h.verified ? "#059669" : "#2563eb" }}>
                        {h.verified ? "Verified" : "Unverified"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: h.isActive ? "#10b981" : "#ef4444" }} />
                      <span className="text-xs font-semibold" style={{ color: h.isActive ? "#059669" : "#dc2626" }}>
                        {h.isActive ? "Active" : h.suspendedAt ? "Suspended" : "Inactive"}
                      </span>
                    </div>
                    {!h.isActive && h.suspensionReason && (
                      <p className="text-[11px] text-gray-400 leading-snug break-words">
                        {h.suspensionReason}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 lg:pt-1">
                    <div className="rounded-xl px-3 py-2" style={{ background: "#f7f4ef" }}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Readiness</p>
                        <p className="text-xs font-extrabold text-[#0f1e38]">{h.readiness.completed}/{h.readiness.total}</p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {h.readiness.items.map((item) => (
                          <span
                            key={item.label}
                            className="h-2 w-2 rounded-full"
                            title={item.label}
                            style={{ background: item.complete ? "#10b981" : "#f59e0b" }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      {h.owners.slice(0, 2).map((owner) => (
                        <p key={owner.id} className="truncate text-xs font-semibold text-[#0f1e38]">
                          {owner.fullName}
                        </p>
                      ))}
                      {h.owners.length === 0 && (
                        <p className="text-xs font-semibold text-amber-700">No approved owner</p>
                      )}
                      {h.pendingOwnerRequests.length > 0 && (
                        <p className="text-[11px] font-bold text-amber-700">
                          {h.pendingOwnerRequests.length} owner request{h.pendingOwnerRequests.length === 1 ? "" : "s"}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap lg:justify-end">
                    {canManage ? (
                      <>
                        {h.pendingOwnerRequests.map((request) => (
                          <div key={request.id} className="flex w-full flex-wrap justify-end gap-1.5 rounded-xl bg-amber-50 p-2">
                            <p className="w-full truncate text-right text-[11px] font-bold text-amber-900">{request.fullName}</p>
                            <button
                              onClick={() => handleOwnerRequest(h, request, "APPROVED")}
                              disabled={actionLoading === request.id + "APPROVED"}
                              className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-bold disabled:opacity-50"
                              style={{ background: "rgba(16,185,129,.12)", color: "#047857" }}
                            >
                              <UserCheck size={11} /> Approve
                            </button>
                            <button
                              onClick={() => handleOwnerRequest(h, request, "REJECTED")}
                              disabled={actionLoading === request.id + "REJECTED"}
                              className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-bold disabled:opacity-50"
                              style={{ background: "rgba(239,68,68,.1)", color: "#dc2626" }}
                            >
                              <XCircle size={11} /> Reject
                            </button>
                          </div>
                        ))}
                        <button onClick={() => handleVerification(h)} disabled={actionLoading === h.id + "verified"}
                          className="flex items-center gap-1 h-8 px-2.5 rounded-xl text-xs font-semibold disabled:opacity-50"
                          style={{ background: h.verified ? "rgba(245,158,11,.08)" : "rgba(99,102,241,.08)", color: h.verified ? "#b45309" : "#4338ca" }}>
                          <BadgeCheck size={12} />
                          {actionLoading === h.id + "verified" ? "..." : h.verified ? "Unverify" : "Verify"}
                        </button>
                        <button onClick={() => handleActivation(h)} disabled={actionLoading === h.id + "active"}
                          className="flex items-center gap-1 h-8 px-2.5 rounded-xl text-xs font-semibold disabled:opacity-50"
                          style={{ background: h.isActive ? "rgba(239,68,68,.06)" : "rgba(16,185,129,.08)", color: h.isActive ? "#dc2626" : "#059669" }}>
                          {h.isActive ? <ToggleLeft size={13} /> : <ToggleRight size={13} />}
                          {actionLoading === h.id + "active" ? "..." : h.isActive ? "Suspend" : "Reactivate"}
                        </button>
                      </>
                    ) : (
                      <span className="text-xs font-semibold text-gray-400">Read-only support scope</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
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
            <span className="h-8 px-3 flex items-center text-xs font-semibold text-[#0f1e38]"
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

function TrustStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-24 rounded-xl px-3 py-2 text-right" style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.1)" }}>
      <p className="text-lg font-extrabold text-[#c8a96e]">{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">{label}</p>
    </div>
  );
}
