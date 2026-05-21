"use client";

import { useEffect, useState, useCallback } from "react";
import {
  TrendingUp,
  RefreshCw,
  AlertCircle,
  Building2,
  ReceiptText,
  XCircle,
  RotateCcw,
  CalendarRange,
  Percent,
  Download,
} from "lucide-react";

type Monthly = { label: string; revenue: number; bookings: number };
type HospitalFilter = { id: string; name: string };

type HospitalRow = {
  id: string; name: string; slug: string;
  revenue: number; bookings: number;
  refundedAmount: number; refundedCount: number; cancelledCount: number;
};

type RevenueData = {
  kpis: {
    allTimeRevenue: number; thisMonthRevenue: number;
    totalRefunds: number; refundedCount: number;
    totalBookings: number; cancelledBookings: number; cancellationRate: number;
  };
  monthly: Monthly[];
  hospitals: HospitalRow[];
  filterHospitals: HospitalFilter[];
  scope: "platform" | "assigned";
};

function fmt(cents: number) {
  return `EUR ${Math.round(cents / 100).toLocaleString()}`;
}

function fmtCount(n: number) {
  return n.toLocaleString();
}

export default function PlatformRevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [hospitalFilter, setHospitalFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ status: statusFilter });
      if (hospitalFilter) params.set("hospitalId", hospitalFilter);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const res = await fetch(`/api/admin/platform/revenue?${params}`);
      if (!res.ok) throw new Error("Failed");
      setData(await res.json());
    } catch {
      setError("Failed to load revenue data.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, hospitalFilter, fromDate, toDate]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchData]);

  const maxRevenue = data ? Math.max(...data.monthly.map((m) => m.revenue), 1) : 1;
  const totalHospitalRevenue = data ? data.hospitals.reduce((s, h) => s + h.revenue, 0) || 1 : 1;
  const maxBookings = data ? Math.max(...data.monthly.map((m) => m.bookings), 1) : 1;
  const hasFilters = statusFilter !== "all" || hospitalFilter || fromDate || toDate;

  const exportCsv = () => {
    const params = new URLSearchParams({ type: "revenue", status: statusFilter });
    if (hospitalFilter) params.set("hospitalId", hospitalFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    window.location.href = `/api/admin/platform/exports?${params}`;
  };

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[#0f1e38]">Revenue</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {data?.scope === "assigned" ? "Financial overview for assigned hospitals" : "Platform-wide financial overview"}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv}
            className="flex items-center gap-2 px-3 h-9 rounded-xl text-xs font-semibold transition-all"
            style={{ background: "#0f1e38", color: "#c8a96e" }}>
            <Download size={13} /> Export CSV
          </button>
          <button onClick={fetchData}
            className="flex items-center gap-2 px-3 h-9 rounded-xl text-xs font-semibold transition-all"
            style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.1)", color: "#6b7a96" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#c8a96e"; e.currentTarget.style.color = "#c8a96e"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(15,30,56,.1)"; e.currentTarget.style.color = "#6b7a96"; }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <div className="grid md:grid-cols-[1fr_auto_auto_auto] gap-2.5">
          <select
            value={hospitalFilter}
            onChange={(e) => setHospitalFilter(e.target.value)}
            className="h-10 rounded-xl px-3 text-xs font-semibold outline-none cursor-pointer border border-gray-100 bg-white"
          >
            <option value="">{data?.scope === "assigned" ? "Assigned hospitals" : "All hospitals"}</option>
            {(data?.filterHospitals ?? []).map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-xl px-3 text-xs font-semibold outline-none cursor-pointer border border-gray-100 bg-white"
          >
            <option value="all">Confirmed + completed</option>
            <option value="CONFIRMED">Confirmed only</option>
            <option value="COMPLETED">Completed only</option>
            <option value="refunded">Refunded only</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-10 rounded-xl px-3 text-xs font-semibold outline-none border border-gray-100 bg-white"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-10 rounded-xl px-3 text-xs font-semibold outline-none border border-gray-100 bg-white"
          />
        </div>

        {hasFilters && (
          <button
            onClick={() => {
              setStatusFilter("all");
              setHospitalFilter("");
              setFromDate("");
              setToDate("");
            }}
            className="h-8 px-3 rounded-xl text-xs font-bold"
            style={{
              background: "rgba(239,68,68,.08)",
              color: "#dc2626",
              border: "1.5px solid rgba(239,68,68,.15)",
            }}
          >
            Clear filters
          </button>
        )}
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
      ) : !data ? null : (
        <div className="space-y-5">

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "All-time Revenue",
                value: fmt(data.kpis.allTimeRevenue),
                sub: `${fmtCount(data.kpis.totalBookings)} paid bookings`,
                icon: <TrendingUp size={17} className="text-[#c8a96e]" />,
                iconBg: "#f7f4ef",
              },
              {
                label: "This Month",
                value: fmt(data.kpis.thisMonthRevenue),
                sub: "confirmed + completed",
                icon: <TrendingUp size={17} className="text-blue-400" />,
                iconBg: "rgba(59,130,246,.08)",
              },
              {
                label: "Total Refunded",
                value: fmt(data.kpis.totalRefunds),
                sub: `${data.kpis.refundedCount} booking${data.kpis.refundedCount !== 1 ? "s" : ""}`,
                icon: <RotateCcw size={17} className="text-amber-400" />,
                iconBg: "rgba(245,158,11,.08)",
              },
              {
                label: "Cancellation Rate",
                value: `${data.kpis.cancellationRate}%`,
                sub: `${data.kpis.cancelledBookings} of ${data.kpis.totalBookings} bookings`,
                icon: <XCircle size={17} className="text-red-400" />,
                iconBg: "rgba(239,68,68,.06)",
              },
            ].map((card) => (
              <div key={card.label} className="bg-white rounded-2xl p-4 border border-gray-100">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{card.label}</p>
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: card.iconBg }}>
                    {card.icon}
                  </div>
                </div>
                <p className="text-2xl font-extrabold text-[#0f1e38]">{card.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 inline-flex items-center gap-1.5">
                <CalendarRange size={13} /> Monthly Performance
              </p>
              <p className="text-[10px] text-gray-300">Last 12 months</p>
            </div>

            <div className="w-full">
              <table className="w-full table-fixed text-sm">
                <thead style={{ background: "#f7f4ef" }}>
                  <tr>
                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">Month</th>
                    <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">Revenue</th>
                    <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">Bookings</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">Revenue Trend</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">Volume Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthly.map((m) => {
                    const revenuePct = Math.max(3, Math.round((m.revenue / maxRevenue) * 100));
                    const bookingPct = Math.max(3, Math.round((m.bookings / maxBookings) * 100));
                    return (
                      <tr key={m.label} className="border-t border-gray-100 hover:bg-[#fcfbf8]">
                        <td className="px-4 py-3.5">
                          <p className="text-xs font-bold text-[#0f1e38]">{m.label}</p>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <p className="text-sm font-extrabold text-[#0f1e38]">{fmt(m.revenue)}</p>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <p className="text-xs font-semibold text-[#0f1e38]">{fmtCount(m.bookings)}</p>
                        </td>
                        <td className="px-4 py-3.5 break-words">
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${revenuePct}%`,
                                background: "linear-gradient(90deg,#c8a96e,#a88b50)",
                              }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3.5 break-words">
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${bookingPct}%`,
                                background: "linear-gradient(90deg,#94a3b8,#64748b)",
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Revenue by Hospital</p>
              <p className="text-[10px] text-gray-300">Top 20 by revenue</p>
            </div>

            {data.hospitals.length === 0 ? (
              <div className="p-10 text-center">
                <ReceiptText size={24} className="text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No revenue data yet</p>
              </div>
            ) : (
              <div className="w-full">
                <table className="w-full table-fixed text-sm">
                  <thead style={{ background: "#f7f4ef" }}>
                    <tr>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">Hospital</th>
                      <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">Gross Revenue</th>
                      <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">Refunded</th>
                      <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">Net Revenue</th>
                      <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">Bookings</th>
                      <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.hospitals.map((h) => {
                      const share = Math.round((h.revenue / totalHospitalRevenue) * 100);
                      const netRevenue = Math.max(0, h.revenue - h.refundedAmount);
                      const refundRate = h.revenue > 0 ? Math.round((h.refundedAmount / h.revenue) * 100) : 0;
                      return (
                        <tr key={h.id} className="border-t border-gray-100 hover:bg-[#fcfbf8]">
                          <td className="px-4 py-3.5 break-words">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: "rgba(200,169,110,.1)" }}
                              >
                                <Building2 size={13} className="text-[#c8a96e]" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-[#0f1e38]">{h.name}</p>
                                <p className="text-[11px] text-gray-400">
                                  {h.cancelledCount} cancelled booking{h.cancelledCount !== 1 ? "s" : ""}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <p className="text-sm font-extrabold text-[#0f1e38]">{fmt(h.revenue)}</p>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            {h.refundedCount > 0 ? (
                              <div>
                                <p className="text-xs font-bold text-red-600">-{fmt(h.refundedAmount)}</p>
                                <p className="text-[10px] text-gray-400 inline-flex items-center justify-end gap-1">
                                  <Percent size={10} /> {refundRate}%
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs text-gray-300">-</p>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <p className="text-xs font-bold text-emerald-700">{fmt(netRevenue)}</p>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <p className="text-xs font-semibold text-[#0f1e38]">{fmtCount(h.bookings)}</p>
                          </td>
                          <td className="px-4 py-3.5 text-right break-words">
                            <div className="flex items-center justify-end gap-1.5">
                              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden w-[56px]">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${share}%`,
                                    background: "linear-gradient(90deg,#c8a96e,#a88b50)",
                                  }}
                                />
                              </div>
                              <span className="text-[10px] font-bold text-gray-400">{share}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
