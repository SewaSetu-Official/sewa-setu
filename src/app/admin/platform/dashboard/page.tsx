"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Building2, Users, CalendarDays, TrendingUp,
  Clock, AlertCircle, RefreshCw, ChevronRight,
} from "lucide-react";
import Link from "next/link";

type Stats = {
  hospitals: { total: number; active: number; pendingVerification: number };
  users: { total: number };
  bookings: { total: number; thisMonth: number };
  memberships: { pending: number };
  revenue: { total: number; thisMonth: number };
  recentBookings: {
    id: string; status: string; scheduledAt: string; createdAt: string;
    hospital: string | null; patient: string | null; amountPaid: number | null;
  }[];
};

const STATUS_CONFIG: Record<string, { bg: string; color: string; dot: string }> = {
  REQUESTED:  { bg: "rgba(245,158,11,.12)",  color: "#b45309", dot: "#f59e0b" },
  CONFIRMED:  { bg: "rgba(59,130,246,.12)",  color: "#1d4ed8", dot: "#3b82f6" },
  COMPLETED:  { bg: "rgba(16,185,129,.12)",  color: "#065f46", dot: "#10b981" },
  CANCELLED:  { bg: "rgba(239,68,68,.1)",    color: "#991b1b", dot: "#ef4444" },
};

function formatMoney(cents: number) {
  return `€${Math.round(cents / 100).toLocaleString()}`;
}

export default function PlatformDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/platform/stats");
      if (!res.ok) throw new Error("Failed");
      setStats(await res.json());
    } catch {
      setError("Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return (
    <div className="space-y-6 max-w-5xl">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-[#0f1e38]">Platform Overview</h1>
          <p className="text-sm text-gray-400 mt-0.5">All hospitals · All bookings · Full access</p>
        </div>
        <button onClick={fetchStats}
          className="flex items-center gap-2 px-3 h-9 rounded-xl text-xs font-semibold transition-all"
          style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.1)", color: "#6b7a96" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#c8a96e"; e.currentTarget.style.color = "#c8a96e"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(15,30,56,.1)"; e.currentTarget.style.color = "#6b7a96"; }}>
          <RefreshCw size={13} /> Refresh
        </button>
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
      ) : !stats ? null : (
        <div className="space-y-5">

          {/* KPI grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Hospitals",       value: stats.hospitals.total,              sub: `${stats.hospitals.active} active`,             icon: <Building2 size={18} className="text-[#c8a96e]" />,    alert: stats.hospitals.pendingVerification > 0, alertText: `${stats.hospitals.pendingVerification} pending verification` },
              { label: "Users",           value: stats.users.total.toLocaleString(), sub: "registered accounts",                          icon: <Users size={18} className="text-[#c8a96e]" />,        alert: false, alertText: "" },
              { label: "Bookings",        value: stats.bookings.total.toLocaleString(), sub: `${stats.bookings.thisMonth} this month`,      icon: <CalendarDays size={18} className="text-[#c8a96e]" />, alert: stats.memberships.pending > 0, alertText: `${stats.memberships.pending} access requests pending` },
              { label: "All-time Revenue",value: formatMoney(stats.revenue.total),   sub: `${formatMoney(stats.revenue.thisMonth)} this month`, icon: <TrendingUp size={18} className="text-[#c8a96e]" />,  alert: false, alertText: "" },
            ].map((card) => (
              <div key={card.label} className="bg-white rounded-2xl p-4 border"
                style={{ borderColor: card.alert ? "rgba(245,158,11,.3)" : "rgba(15,30,56,.07)" }}>
                <div className="flex items-start justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{card.label}</p>
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center"
                    style={{ background: card.alert ? "rgba(245,158,11,.1)" : "#f7f4ef" }}>
                    {card.icon}
                  </div>
                </div>
                <p className="text-2xl font-extrabold text-[#0f1e38]">{card.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{card.alert ? card.alertText : card.sub}</p>
              </div>
            ))}
          </div>

          {/* Alerts */}
          <div className="grid lg:grid-cols-2 gap-3">
            {stats.memberships.pending > 0 && (
              <Link href="/admin/platform/users?filter=pending"
                className="flex items-center justify-between p-4 rounded-2xl transition-all hover:shadow-sm"
                style={{ background: "rgba(245,158,11,.08)", border: "1.5px solid rgba(245,158,11,.25)" }}>
                <div className="flex items-center gap-3">
                  <Clock size={16} className="text-amber-500 flex-shrink-0" />
                  <p className="text-sm font-semibold text-[#0f1e38]">
                    {stats.memberships.pending} access request{stats.memberships.pending !== 1 ? "s" : ""} waiting
                  </p>
                </div>
                <ChevronRight size={14} className="text-amber-500" />
              </Link>
            )}
            {stats.hospitals.pendingVerification > 0 && (
              <Link href="/admin/platform/hospitals"
                className="flex items-center justify-between p-4 rounded-2xl transition-all hover:shadow-sm"
                style={{ background: "rgba(59,130,246,.06)", border: "1.5px solid rgba(59,130,246,.2)" }}>
                <div className="flex items-center gap-3">
                  <Building2 size={16} className="text-blue-500 flex-shrink-0" />
                  <p className="text-sm font-semibold text-[#0f1e38]">
                    {stats.hospitals.pendingVerification} hospital{stats.hospitals.pendingVerification !== 1 ? "s" : ""} pending verification
                  </p>
                </div>
                <ChevronRight size={14} className="text-blue-500" />
              </Link>
            )}
          </div>

          {/* Recent bookings */}
          {stats.recentBookings.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-[#0f1e38]">Recent Bookings</p>
                <Link href="/admin/platform/hospitals"
                  className="text-xs font-semibold text-[#c8a96e] flex items-center gap-1 hover:text-[#a88b50]">
                  All hospitals <ChevronRight size={12} />
                </Link>
              </div>
              <div className="space-y-2">
                {stats.recentBookings.map((b) => {
                  const st = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.CONFIRMED;
                  return (
                    <div key={b.id} className="bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-4">
                      <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                        style={{ background: st.bg, color: st.color }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.dot }} />
                        {b.status.charAt(0) + b.status.slice(1).toLowerCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#0f1e38] truncate">
                          {b.patient ?? "—"} · {b.hospital ?? "—"}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(b.scheduledAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      {b.amountPaid != null && (
                        <p className="text-xs font-bold text-[#0f1e38] flex-shrink-0">
                          {formatMoney(b.amountPaid)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
