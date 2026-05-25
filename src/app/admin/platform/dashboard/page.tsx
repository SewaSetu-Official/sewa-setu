"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  Banknote,
  Building2,
  CalendarDays,
  ChevronRight,
  Clock,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";

type Stats = {
  hospitals: { total: number; active: number; pendingVerification: number };
  users: { total: number };
  bookings: { total: number; thisMonth: number };
  memberships: { pending: number };
  revenue: { total: number; thisMonth: number };
  recentBookings: {
    id: string;
    status: string;
    scheduledAt: string;
    createdAt: string;
    hospital: string | null;
    patient: string | null;
    amountPaid: number | null;
  }[];
  scope: "platform" | "assigned";
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  REQUESTED: { label: "Requested", bg: "#fff7ed", color: "#c2410c", dot: "#f97316" },
  CONFIRMED: { label: "Confirmed", bg: "#eff6ff", color: "#1d4ed8", dot: "#3b82f6" },
  COMPLETED: { label: "Completed", bg: "#ecfdf5", color: "#047857", dot: "#10b981" },
  CANCELLED: { label: "Cancelled", bg: "#fff1f2", color: "#be123c", dot: "#f43f5e" },
};

function formatMoney(cents: number | null | undefined) {
  return `€${Math.round((cents ?? 0) / 100).toLocaleString()}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function todayLabel() {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: React.ReactNode;
  tone?: "neutral" | "warning" | "success" | "blue";
}) {
  const colors = {
    neutral: { bg: "#f7f4ef", text: "#0f1e38", icon: "#c8a96e", border: "rgba(15,30,56,.07)" },
    warning: { bg: "#fff7ed", text: "#9a3412", icon: "#f97316", border: "rgba(249,115,22,.22)" },
    success: { bg: "#ecfdf5", text: "#047857", icon: "#10b981", border: "rgba(16,185,129,.18)" },
    blue: { bg: "#eff6ff", text: "#1d4ed8", icon: "#3b82f6", border: "rgba(59,130,246,.18)" },
  }[tone];

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: colors.border }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8a9ab5]">{label}</p>
          <p className="mt-2 text-2xl font-extrabold text-[#0f1e38]">{value}</p>
          <p className="mt-1 text-xs font-semibold" style={{ color: colors.text }}>{detail}</p>
        </div>
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl" style={{ background: colors.bg, color: colors.icon }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  title,
  detail,
  href,
  tone,
}: {
  title: string;
  detail: string;
  href: string;
  tone: "warning" | "blue" | "success";
}) {
  const colors = {
    warning: { bg: "#fff7ed", border: "rgba(249,115,22,.22)", text: "#c2410c" },
    blue: { bg: "#eff6ff", border: "rgba(59,130,246,.18)", text: "#1d4ed8" },
    success: { bg: "#ecfdf5", border: "rgba(16,185,129,.18)", text: "#047857" },
  }[tone];

  return (
    <Link
      href={href}
      className="group flex min-h-[92px] items-center justify-between gap-4 rounded-2xl border px-4 py-3 no-underline transition-all hover:-translate-y-0.5 hover:shadow-sm"
      style={{ background: colors.bg, borderColor: colors.border }}
    >
      <span>
        <span className="block text-sm font-extrabold text-[#0f1e38]">{title}</span>
        <span className="mt-1 block text-xs font-semibold leading-relaxed" style={{ color: colors.text }}>{detail}</span>
      </span>
      <ChevronRight size={16} className="flex-shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: colors.text }} />
    </Link>
  );
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
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed");
      setStats(json);
    } catch {
      setError("Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchStats();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchStats]);

  const health = useMemo(() => {
    if (!stats) return { activePercent: 0, attention: 0 };
    return {
      activePercent: percent(stats.hospitals.active, stats.hospitals.total),
      attention: stats.memberships.pending + stats.hospitals.pendingVerification,
    };
  }, [stats]);

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c8a96e]">Platform command center</p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#0f1e38]">Dashboard</h1>
          <p className="mt-1 text-sm font-semibold text-[#8a9ab5]">
            {stats?.scope === "assigned" ? "Assigned hospitals / operational visibility" : "All hospitals / all bookings / full platform access"}
          </p>
        </div>
        <button
          onClick={fetchStats}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-100 bg-white px-4 text-sm font-bold text-[#6b7a96] shadow-sm"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-2xl border border-gray-100 bg-white" />
          ))}
        </div>
      ) : !stats ? null : (
        <>
          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#f7f4ef] px-3 py-1 text-xs font-bold text-[#6b7a96]">{todayLabel()}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${health.attention ? "bg-[#fff7ed] text-[#c2410c]" : "bg-emerald-50 text-emerald-700"}`}>
                    {health.attention ? `${health.attention} item${health.attention === 1 ? "" : "s"} need attention` : "No critical queue"}
                  </span>
                </div>
                <h2 className="mt-4 max-w-3xl text-2xl font-extrabold leading-tight text-[#0f1e38]">
                  {stats.scope === "platform"
                    ? "Monitor platform growth, booking health, and support queues from one place."
                    : "Monitor your assigned hospitals and booking activity without wider platform controls."}
                </h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-[#f7f4ef] px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#8a9ab5]">Active hospitals</p>
                    <p className="mt-1 text-xl font-extrabold text-[#0f1e38]">{health.activePercent}%</p>
                  </div>
                  <div className="rounded-2xl bg-[#f7f4ef] px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#8a9ab5]">Month bookings</p>
                    <p className="mt-1 text-xl font-extrabold text-[#0f1e38]">{stats.bookings.thisMonth.toLocaleString()}</p>
                  </div>
                  <div className="rounded-2xl bg-[#f7f4ef] px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#8a9ab5]">Month revenue</p>
                    <p className="mt-1 text-xl font-extrabold text-[#0f1e38]">{formatMoney(stats.revenue.thisMonth)}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-3xl bg-[#0f1e38] p-5 text-white">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Operating brief</p>
                <div className="mt-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-white/70">Hospitals live</span>
                    <span className="text-xl font-extrabold">{stats.hospitals.active}/{stats.hospitals.total}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-[#c8a96e]" style={{ width: `${health.activePercent}%` }} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Link href="/admin/platform/onboarding" className="rounded-2xl bg-white/8 px-3 py-3 text-xs font-bold text-white no-underline">
                      Hospital setup <ArrowUpRight size={13} className="mt-2 text-[#c8a96e]" />
                    </Link>
                    <Link href="/admin/platform/bookings" className="rounded-2xl bg-white/8 px-3 py-3 text-xs font-bold text-white no-underline">
                      Booking desk <ArrowUpRight size={13} className="mt-2 text-[#c8a96e]" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Hospitals"
              value={stats.hospitals.total}
              detail={`${stats.hospitals.active} active / ${stats.hospitals.pendingVerification} pending verification`}
              icon={<Building2 size={18} />}
              tone={stats.hospitals.pendingVerification ? "warning" : "success"}
            />
            <MetricCard
              label="Bookings"
              value={stats.bookings.total.toLocaleString()}
              detail={`${stats.bookings.thisMonth.toLocaleString()} created this month`}
              icon={<CalendarDays size={18} />}
              tone="blue"
            />
            <MetricCard
              label={stats.scope === "platform" ? "Users" : "Support scope"}
              value={stats.scope === "platform" ? stats.users.total.toLocaleString() : stats.hospitals.total}
              detail={stats.scope === "platform" ? "registered accounts" : "assigned hospitals"}
              icon={<Users size={18} />}
            />
            <MetricCard
              label="Revenue"
              value={formatMoney(stats.revenue.total)}
              detail={`${formatMoney(stats.revenue.thisMonth)} this month`}
              icon={<Banknote size={18} />}
              tone="success"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.88fr)_minmax(420px,1.12fr)]">
            <section className="space-y-3">
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-extrabold text-[#0f1e38]">Priority Queue</h2>
                    <p className="mt-0.5 text-xs font-semibold text-[#8a9ab5]">Operational items that should be handled first.</p>
                  </div>
                  <Clock size={16} className="text-[#c8a96e]" />
                </div>
                <div className="space-y-2.5">
                  <ActionCard
                    title={stats.memberships.pending ? "Access requests waiting" : "Access queue clear"}
                    detail={stats.memberships.pending ? `${stats.memberships.pending} user request${stats.memberships.pending === 1 ? "" : "s"} need review.` : "No pending user access requests right now."}
                    href="/admin/platform/users"
                    tone={stats.memberships.pending ? "warning" : "success"}
                  />
                  <ActionCard
                    title={stats.hospitals.pendingVerification ? "Hospitals pending verification" : "Verification queue clear"}
                    detail={stats.hospitals.pendingVerification ? `${stats.hospitals.pendingVerification} hospital${stats.hospitals.pendingVerification === 1 ? "" : "s"} still need verification.` : "Published hospitals are verified."}
                    href="/admin/platform/hospitals"
                    tone={stats.hospitals.pendingVerification ? "blue" : "success"}
                  />
                  <ActionCard
                    title="Hospital setup pipeline"
                    detail="Open onboarding to create records, finish data entry, and launch hospitals."
                    href="/admin/platform/onboarding"
                    tone="blue"
                  />
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
                <div>
                  <h2 className="text-sm font-extrabold text-[#0f1e38]">Recent Bookings</h2>
                  <p className="mt-0.5 text-xs font-semibold text-[#8a9ab5]">Latest platform booking activity.</p>
                </div>
                <Link href="/admin/platform/bookings" className="inline-flex items-center gap-1 text-xs font-bold text-[#c8a96e] no-underline">
                  View all <ChevronRight size={12} />
                </Link>
              </div>
              {stats.recentBookings.length === 0 ? (
                <div className="flex min-h-[260px] items-center justify-center px-5 text-sm font-semibold text-[#8a9ab5]">
                  No bookings yet.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {stats.recentBookings.map((booking) => {
                    const status = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.CONFIRMED;
                    return (
                      <div key={booking.id} className="grid gap-3 px-5 py-4 md:grid-cols-[130px_minmax(0,1fr)_110px] md:items-center">
                        <span className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: status.bg, color: status.color }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.dot }} />
                          {status.label}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#0f1e38]">{booking.hospital ?? "Hospital not linked"}</p>
                          <p className="mt-0.5 text-xs font-semibold text-[#8a9ab5]">
                            Scheduled {formatDate(booking.scheduledAt)} / Created {formatDate(booking.createdAt)}
                          </p>
                        </div>
                        <p className="text-sm font-extrabold text-[#0f1e38] md:text-right">
                          {booking.amountPaid == null ? "-" : formatMoney(booking.amountPaid)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-3">
              <Link href="/admin/platform/revenue" className="flex items-center justify-between rounded-2xl bg-[#f7f4ef] px-4 py-4 text-sm font-extrabold text-[#0f1e38] no-underline">
                Revenue controls <ChevronRight size={14} className="text-[#c8a96e]" />
              </Link>
              <Link href="/admin/platform/support" className="flex items-center justify-between rounded-2xl bg-[#f7f4ef] px-4 py-4 text-sm font-extrabold text-[#0f1e38] no-underline">
                Support assignments <ChevronRight size={14} className="text-[#c8a96e]" />
              </Link>
              <Link href="/admin/platform/audit-logs" className="flex items-center justify-between rounded-2xl bg-[#f7f4ef] px-4 py-4 text-sm font-extrabold text-[#0f1e38] no-underline">
                Audit trail <ShieldCheck size={14} className="text-[#c8a96e]" />
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
