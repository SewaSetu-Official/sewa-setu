"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarDays,
  CreditCard,
  Download,
  FileText,
  Percent,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";

const RANGE_OPTIONS = [
  { key: "today", label: "Today" },
  { key: "week", label: "Weekly" },
  { key: "15d", label: "15 days" },
  { key: "month", label: "Monthly" },
  { key: "3m", label: "3 months" },
  { key: "year", label: "Year" },
] as const;

type BusinessData = {
  hospital: {
    name: string;
    slug: string;
    type: string;
    verified: boolean;
    isActive: boolean;
    suspendedAt: string | null;
    suspensionReason: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    emergencyAvailable: boolean;
    location: {
      country: string;
      province: string | null;
      district: string;
      city: string;
      area: string | null;
      addressLine: string | null;
    } | null;
  };
  billing: {
    provider: string;
    status: "connected" | "not_configured";
    totalRevenue: number;
    totalRefunds: number;
    netRevenue: number;
    paidBookings: number;
    monthRevenue: number;
    monthBookings: number;
    refundedBookings: number;
  };
  range: {
    key: string;
    label: string;
    days: number;
    start: string;
    end: string;
  };
  report: {
    bookings: number;
    paidBookings: number;
    cancelledBookings: number;
    refundedBookings: number;
    revenue: number;
    refunds: number;
    netRevenue: number;
    cancellationRate: number;
    refundRate: number;
    statusBreakdown: { status: string; count: number }[];
    daily: { date: string; bookings: number; revenue: number; refunds: number }[];
  };
  operations: {
    pendingRequests: number;
    unconfirmedBookings: number;
    activeDoctors: number;
    activePackages: number;
    activeWindows: number;
  };
  riskSignals: string[];
};

function formatMoney(cents: number) {
  return `EUR ${Math.round(cents / 100).toLocaleString()}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export default function BusinessClient({ slug }: { slug: string }) {
  const [data, setData] = useState<BusinessData | null>(null);
  const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]["key"]>("month");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchBusiness = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/h/${slug}/business?range=${range}`);
      if (!res.ok) throw new Error("Failed");
      setData(await res.json());
    } catch {
      setError("Failed to load owner business controls.");
    } finally {
      setLoading(false);
    }
  }, [slug, range]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchBusiness();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchBusiness]);

  const exportHref = (type: string) => `/api/admin/h/${slug}/exports?type=${type}&range=${range}`;
  const dailyPeak = Math.max(1, ...(data?.report.daily.map((day) => day.revenue) ?? [1]));

  return (
    <div className="w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[#0f1e38]">Owner Business</h1>
          <p className="mt-0.5 text-sm text-gray-400">Billing, legal readiness, exports, and audit signals.</p>
        </div>
        <button
          onClick={fetchBusiness}
          className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-bold"
          style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.1)", color: "#6b7a96" }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl p-3 text-sm font-semibold text-red-600" style={{ background: "#fef2f2", border: "1px solid rgba(220,38,38,.2)" }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-solid border-[#c8a96e] border-r-transparent" />
        </div>
      ) : data && (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Net revenue" value={formatMoney(data.billing.netRevenue)} sub={`${data.billing.paidBookings} paid bookings`} icon={<CreditCard size={16} />} />
            <Metric label="This month" value={formatMoney(data.billing.monthRevenue)} sub={`${data.billing.monthBookings} bookings`} icon={<BarChart3 size={16} />} />
            <Metric label="Refunds" value={formatMoney(data.billing.totalRefunds)} sub={`${data.billing.refundedBookings} refunded bookings`} icon={<FileText size={16} />} />
            <Metric label="Stripe" value={data.billing.status === "connected" ? "Connected" : "Not configured"} sub="Payment provider" icon={<BadgeCheck size={16} />} />
          </div>

          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5" style={{ background: "linear-gradient(135deg,#0f1e38,#192d52)" }}>
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: "rgba(200,169,110,.14)", color: "#c8a96e" }}>
                  <CalendarDays size={20} />
                </div>
                <div>
                  <p className="text-lg font-extrabold text-white">Owner Report</p>
                  <p className="mt-1 max-w-2xl text-sm font-medium text-white/60">Filter the business window, review daily performance, then export the same exact view for bookkeeping or operations review.</p>
                </div>
              </div>
              <div className="rounded-2xl px-4 py-3 text-right" style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.1)" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Selected range</p>
                <p className="text-sm font-extrabold text-[#c8a96e]">{formatDate(data.range.start)} - {formatDate(data.range.end)}</p>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-5 grid gap-2 rounded-2xl p-2 sm:grid-cols-3 xl:grid-cols-6" style={{ background: "#f7f4ef" }}>
                {RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    onClick={() => setRange(option.key)}
                    className="h-12 rounded-xl px-3 text-sm font-extrabold transition"
                    style={{
                      background: range === option.key ? "#0f1e38" : "transparent",
                      color: range === option.key ? "#c8a96e" : "#6b7a96",
                      boxShadow: range === option.key ? "0 10px 24px rgba(15,30,56,.16)" : "none",
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ReportMetric label="Range net" value={formatMoney(data.report.netRevenue)} sub={`${data.report.paidBookings} paid bookings`} icon={<CreditCard size={16} />} />
                <ReportMetric label="Total bookings" value={String(data.report.bookings)} sub={`${data.report.cancelledBookings} cancelled`} icon={<FileText size={16} />} />
                <ReportMetric label="Refunds" value={formatMoney(data.report.refunds)} sub={`${data.report.refundRate}% refund rate`} icon={<Percent size={16} />} />
                <ReportMetric label="Gross revenue" value={formatMoney(data.report.revenue)} sub={`${data.report.cancellationRate}% cancellation rate`} icon={<BarChart3 size={16} />} />
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
                <div className="overflow-x-auto rounded-2xl border border-gray-100">
                  <div className="grid min-w-[760px] grid-cols-[minmax(110px,1fr)_minmax(120px,1.4fr)_90px_110px_100px] bg-[#f7f4ef] px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    <span>Date</span>
                    <span>Revenue trend</span>
                    <span className="text-right">Bookings</span>
                    <span className="text-right">Revenue</span>
                    <span className="text-right">Refunds</span>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {data.report.daily.map((day) => (
                      <div key={day.date} className="grid min-w-[760px] grid-cols-[minmax(110px,1fr)_minmax(120px,1.4fr)_90px_110px_100px] items-center border-t border-gray-100 px-4 py-3 text-sm">
                        <span className="font-extrabold text-[#0f1e38]">{formatDate(day.date)}</span>
                        <div className="h-2 rounded-full bg-gray-100">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${Math.max(4, Math.round((day.revenue / dailyPeak) * 100))}%`,
                              background: "linear-gradient(90deg,#c8a96e,#0f1e38)",
                            }}
                          />
                        </div>
                        <span className="text-right font-bold text-gray-500">{day.bookings}</span>
                        <span className="text-right font-bold text-gray-500">{formatMoney(day.revenue)}</span>
                        <span className="text-right font-bold text-gray-500">{formatMoney(day.refunds)}</span>
                      </div>
                    ))}
                    {data.report.daily.length === 0 && (
                      <div className="px-3 py-10 text-center text-sm font-semibold text-gray-400">No bookings in this range.</div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl p-4" style={{ background: "#f7f4ef" }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Status mix</p>
                    <div className="mt-3 space-y-2">
                      {data.report.statusBreakdown.map((item) => (
                        <div key={item.status} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-xs">
                          <span className="font-bold text-[#0f1e38]">{item.status.replace(/_/g, " ")}</span>
                          <span className="font-extrabold text-[#a8874f]">{item.count}</span>
                        </div>
                      ))}
                      {data.report.statusBreakdown.length === 0 && (
                        <p className="text-xs font-semibold text-gray-400">No status data yet.</p>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <ExportButton href={exportHref("bookings")} label="Export bookings" />
                    <ExportButton href={exportHref("revenue")} label="Export revenue" />
                    <ExportButton href={exportHref("audit")} label="Export audit" />
                  </div>
                  <p className="text-[11px] font-semibold text-gray-400">Exports use the selected range and are audit logged.</p>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-5">
              <section className="rounded-2xl border border-gray-100 bg-white p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "#f7f4ef", color: "#a8874f" }}>
                    <Building2 size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-[#0f1e38]">Legal & Profile Readiness</p>
                    <p className="text-xs text-gray-400">Owner-level view of platform-governed identity.</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Info label="Hospital" value={data.hospital.name} />
                  <Info label="Type" value={data.hospital.type.toLowerCase()} />
                  <Info label="Verification" value={data.hospital.verified ? "Verified" : "Pending verification"} />
                  <Info label="Profile status" value={data.hospital.isActive ? "Active" : "Inactive"} />
                  <Info label="Contact" value={[data.hospital.phone, data.hospital.email].filter(Boolean).join(" / ") || "Missing"} />
                  <Info label="Website" value={data.hospital.website ?? "Missing"} />
                </div>
              </section>
            </div>

            <aside className="space-y-5">
              <section className="rounded-2xl border border-gray-100 bg-white p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "#f7f4ef", color: "#a8874f" }}>
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-[#0f1e38]">Owner Signals</p>
                    <p className="text-xs text-gray-400">Items that may need owner attention.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {data.riskSignals.length > 0 ? data.riskSignals.map((signal) => (
                    <div key={signal} className="rounded-xl px-3 py-2 text-xs font-semibold text-amber-800" style={{ background: "rgba(245,158,11,.1)" }}>
                      {signal}
                    </div>
                  )) : (
                    <div className="rounded-xl px-3 py-2 text-xs font-semibold text-emerald-700" style={{ background: "rgba(16,185,129,.1)" }}>
                      No owner-level risk signals right now.
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-gray-100 bg-white p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "#f7f4ef", color: "#a8874f" }}>
                    <Users size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-[#0f1e38]">Operations</p>
                    <p className="text-xs text-gray-400">Business readiness counts.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Mini label="Doctors" value={data.operations.activeDoctors} />
                  <Mini label="Packages" value={data.operations.activePackages} />
                  <Mini label="Windows" value={data.operations.activeWindows} />
                  <Mini label="Requests" value={data.operations.pendingRequests} />
                </div>
              </section>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
        <div className="flex h-7 w-7 items-center justify-center rounded-xl" style={{ background: "#f7f4ef", color: "#a8874f" }}>{icon}</div>
      </div>
      <p className="text-xl font-extrabold text-[#0f1e38]">{value}</p>
      <p className="mt-0.5 text-xs text-gray-400">{sub}</p>
    </div>
  );
}

function ReportMetric({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "#f7f4ef" }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
        <span className="text-[#a8874f]">{icon}</span>
      </div>
      <p className="text-lg font-extrabold text-[#0f1e38]">{value}</p>
      <p className="text-[11px] font-semibold text-gray-400">{sub}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "#f7f4ef" }}>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="break-words text-sm font-semibold text-[#0f1e38]">{value}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: "#f7f4ef" }}>
      <p className="text-lg font-extrabold text-[#0f1e38]">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  );
}

function ExportButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl text-xs font-bold"
      style={{ background: "linear-gradient(135deg,#0f1e38,#1a3059)", color: "#c8a96e" }}
    >
      <Download size={13} /> {label}
    </a>
  );
}
