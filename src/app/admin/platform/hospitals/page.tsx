"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Building2, Search, RefreshCw, AlertCircle,
  BadgeCheck, ToggleLeft, ToggleRight, ChevronLeft, ChevronRight,
} from "lucide-react";
import Link from "next/link";

type Hospital = {
  id: string; name: string; slug: string; type: string;
  verified: boolean; isActive: boolean; location: string | null;
  bookingCount: number; doctorCount: number; staffCount: number;
};

export default function PlatformHospitalsPage() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchHospitals = useCallback(async (q = search, p = page) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (q) params.set("search", q);
      const res = await fetch(`/api/admin/platform/hospitals?${params}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setHospitals(data.hospitals);
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch {
      setError("Failed to load hospitals.");
    } finally {
      setLoading(false);
    }
  }, [search, page]); // eslint-disable-line

  useEffect(() => { fetchHospitals(search, page); }, [search, page]); // eslint-disable-line

  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => { setSearch(val); setPage(1); }, 350);
  };

  const handleToggle = async (hospital: Hospital, field: "verified" | "isActive") => {
    setActionLoading(hospital.id + field);
    try {
      const res = await fetch("/api/admin/platform/hospitals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospitalId: hospital.id,
          [field]: !hospital[field],
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setHospitals((prev) =>
        prev.map((h) => h.id === hospital.id ? { ...h, [field]: !hospital[field] } : h)
      );
    } catch {
      setError("Failed to update hospital.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[#0f1e38]">Hospitals</h1>
          <p className="text-sm text-gray-400 mt-0.5">{total} hospital{total !== 1 ? "s" : ""} on the platform</p>
        </div>
        <button onClick={() => fetchHospitals()}
          className="flex items-center gap-2 px-3 h-9 rounded-xl text-xs font-semibold transition-all"
          style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.1)", color: "#6b7a96" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#c8a96e"; e.currentTarget.style.color = "#c8a96e"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(15,30,56,.1)"; e.currentTarget.style.color = "#6b7a96"; }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

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
        <div className="space-y-2">
          {hospitals.map((h) => (
            <div key={h.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 flex-wrap"
              style={{ opacity: h.isActive ? 1 : 0.6 }}>
              <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(200,169,110,.1)" }}>
                <Building2 size={18} className="text-[#c8a96e]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-[#0f1e38] text-sm">{h.name}</p>
                  {h.verified && <BadgeCheck size={14} className="text-[#c8a96e]" />}
                  {!h.isActive && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(239,68,68,.08)", color: "#dc2626" }}>Inactive</span>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  {h.location ?? h.type} · {h.bookingCount} bookings · {h.doctorCount} doctors · {h.staffCount} staff
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                {/* View hospital admin */}
                <Link href={`/admin/h/${h.slug}/dashboard`}
                  className="h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
                  style={{ background: "#f7f4ef", color: "#6b7a96" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(200,169,110,.1)"; e.currentTarget.style.color = "#c8a96e"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#f7f4ef"; e.currentTarget.style.color = "#6b7a96"; }}>
                  View
                </Link>

                {/* Verify toggle */}
                <button
                  onClick={() => handleToggle(h, "verified")}
                  disabled={actionLoading === h.id + "verified"}
                  className="flex items-center gap-1 h-8 px-2.5 rounded-xl text-xs font-semibold disabled:opacity-50"
                  style={{
                    background: h.verified ? "rgba(16,185,129,.08)" : "rgba(59,130,246,.08)",
                    color: h.verified ? "#059669" : "#1d4ed8",
                  }}>
                  <BadgeCheck size={12} />
                  {actionLoading === h.id + "verified" ? "..." : h.verified ? "Verified" : "Verify"}
                </button>

                {/* Active toggle */}
                <button
                  onClick={() => handleToggle(h, "isActive")}
                  disabled={actionLoading === h.id + "isActive"}
                  className="flex items-center gap-1 h-8 px-2.5 rounded-xl text-xs font-semibold disabled:opacity-50"
                  style={{
                    background: h.isActive ? "rgba(239,68,68,.06)" : "rgba(16,185,129,.08)",
                    color: h.isActive ? "#dc2626" : "#059669",
                  }}>
                  {h.isActive ? <ToggleLeft size={13} /> : <ToggleRight size={13} />}
                  {actionLoading === h.id + "isActive" ? "..." : h.isActive ? "Disable" : "Enable"}
                </button>
              </div>
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
            <span className="h-8 px-3 flex items-center text-xs font-semibold text-[#0f1e38]"
              style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.1)", borderRadius: 12 }}>
              {page}
            </span>
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
