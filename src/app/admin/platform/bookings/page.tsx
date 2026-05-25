"use client";

import { useEffect, useState, useCallback, useRef, Fragment } from "react";
import {
  CalendarDays,
  Search,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Building2,
  User,
  Stethoscope,
  Wifi,
  MapPin,
  Clock3,
} from "lucide-react";
import { formatMoneyCents } from "@/lib/money";

type Hospital = { id: string; name: string };
type PlatformScope = "platform" | "assigned";
type Booking = {
  id: string;
  status: string;
  mode: string;
  scheduledAt: string;
  slotTime: string | null;
  amountPaid: number | null;
  currency: string;
  createdAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  refunded: boolean;
  hospital: { id: string; name: string; slug: string } | null;
  doctor: string | null;
  package: string | null;
};

const STATUS_CONFIG: Record<
  string,
  { bg: string; color: string; dot: string; label: string }
> = {
  DRAFT: {
    bg: "rgba(107,114,128,.1)",
    color: "#374151",
    dot: "#9ca3af",
    label: "Draft",
  },
  REQUESTED: {
    bg: "rgba(245,158,11,.12)",
    color: "#b45309",
    dot: "#f59e0b",
    label: "Requested",
  },
  CONFIRMED: {
    bg: "rgba(99,102,241,.12)",
    color: "#4338ca",
    dot: "#6366f1",
    label: "Confirmed",
  },
  COMPLETED: {
    bg: "rgba(16,185,129,.12)",
    color: "#065f46",
    dot: "#10b981",
    label: "Completed",
  },
  CANCELLED: {
    bg: "rgba(239,68,68,.1)",
    color: "#991b1b",
    dot: "#ef4444",
    label: "Cancelled",
  },
};

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "REQUESTED", label: "Requested" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

function fmt(cents: number, currency: string) {
  return formatMoneyCents(cents, currency);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtSlot(booking: Booking) {
  if (booking.slotTime) return booking.slotTime.replace("-", " - ");
  return fmtTime(booking.scheduledAt);
}

function bookingCode(id: string) {
  return id.slice(0, 10).toUpperCase();
}

export default function PlatformBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [scope, setScope] = useState<PlatformScope>("platform");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [hospitalFilter, setHospitalFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchBookings = useCallback(
    async (
      q = search,
      s = statusFilter,
      h = hospitalFilter,
      f = fromDate,
      t = toDate,
      p = page,
    ) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ page: String(p), status: s });
        if (q) params.set("search", q);
        if (h) params.set("hospitalId", h);
        if (f) params.set("from", f);
        if (t) params.set("to", t);
        const res = await fetch(`/api/admin/platform/bookings?${params}`);
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        setBookings(data.bookings);
        setTotal(data.total);
        setHasMore(data.hasMore);
        setScope(data.scope ?? "platform");
        setHospitals(data.hospitals ?? []);
      } catch {
        setError("Failed to load bookings.");
      } finally {
        setLoading(false);
      }
    },
    [search, statusFilter, hospitalFilter, fromDate, toDate, page],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchBookings();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchBookings]);

  const handleSearch = (val: string) => {
    setSearchInput(val);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 350);
  };

  const hasFilters =
    search || statusFilter !== "all" || hospitalFilter || fromDate || toDate;
  return (
    <div className="space-y-5 w-full">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#8a9ab5]">Platform operations</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#0f1e38]">Bookings</h1>
          <p className="mt-1 text-sm font-semibold text-[#8a9ab5]">
            {total.toLocaleString()} booking{total !== 1 ? "s" : ""} across{" "}
            {scope === "assigned" ? "assigned hospitals" : "all hospitals"}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {hasFilters && (
            <button
              onClick={() => {
                setSearch("");
                setSearchInput("");
                setStatusFilter("all");
                setHospitalFilter("");
                setFromDate("");
                setToDate("");
                setPage(1);
              }}
              className="admin-clear-filter"
            >
              Clear filters
            </button>
          )}
          <button
            onClick={() => fetchBookings()}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-extrabold text-[#5f6f8d] transition hover:border-[#c8a96e] hover:text-[#9c7939]"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      <div className="admin-control-panel space-y-3">
        <div className="admin-control-row">
          <div className="admin-search-control">
            <Search size={14} className="admin-search-icon" />
            <input
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search booking ID, hospital, doctor..."
              className="admin-search-input"
            />
          </div>
          <select
            value={hospitalFilter}
            onChange={(e) => {
              setHospitalFilter(e.target.value);
              setPage(1);
            }}
            className="admin-select-control"
          >
            <option value="">{scope === "assigned" ? "Assigned hospitals" : "All hospitals"}</option>
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
            className="admin-date-control"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
            className="admin-date-control"
          />
        </div>

        <div className="admin-filter-row">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => {
                setStatusFilter(f.value);
                setPage(1);
              }}
              className={`admin-filter-pill ${statusFilter === f.value ? "admin-filter-pill-active" : ""}`}
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
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center mx-auto mb-3"
            style={{ background: "rgba(200,169,110,.1)" }}
          >
            <CalendarDays size={20} className="text-[#c8a96e]" />
          </div>
          <p className="text-sm font-semibold text-[#0f1e38]">No bookings found</p>
          <p className="text-xs mt-1" style={{ color: "#8a9ab5" }}>
            Try adjusting your filters
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_14px_40px_rgba(15,30,56,0.05)]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-extrabold text-[#0f1e38]">Booking ledger</h2>
              <p className="text-xs font-semibold text-[#8a9ab5]">Newest platform bookings with payment and care context.</p>
            </div>
            <span className="admin-page-indicator">Page {page}</span>
          </div>
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <colgroup>
                <col className="w-[16%]" />
                <col className="w-[18%]" />
                <col className="w-[27%]" />
                <col className="w-[15%]" />
                <col className="w-[10%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead className="bg-[#f7f4ef]">
                <tr>
                  <th className="text-left px-5 py-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#8a9ab5]">
                    Schedule
                  </th>
                  <th className="text-left px-5 py-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#8a9ab5]">
                    Booking
                  </th>
                  <th className="text-left px-5 py-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#8a9ab5]">
                    Hospital / Doctor
                  </th>
                  <th className="text-left px-5 py-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#8a9ab5]">
                    Status
                  </th>
                  <th className="text-right px-5 py-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#8a9ab5]">
                    Amount
                  </th>
                  <th className="text-right px-5 py-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#8a9ab5]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const st = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.REQUESTED;
                  const isExpanded = expandedId === b.id;

                  return (
                    <Fragment key={b.id}>
                      <tr className="border-b border-[#e5e7eb] hover:bg-[#fcfbf8]">
                        <td className="px-5 py-4 align-top break-words">
                          <p className="text-sm font-extrabold text-[#0f1e38]">
                            {fmtDate(b.scheduledAt)}
                          </p>
                          <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[#f7f4ef] px-2 py-0.5 text-[11px] font-extrabold text-[#5f6f8d]">
                            <Clock3 size={11} />
                            {fmtSlot(b)}
                          </p>
                          <p className="mt-1 text-[10px] font-semibold text-[#b6c1d1]">
                            Booked {fmtDate(b.createdAt)}
                          </p>
                        </td>

                        <td className="px-5 py-4 align-top break-words">
                          <div className="flex items-start gap-2">
                            <div
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f7f4ef]"
                            >
                              <User size={14} className="text-[#6b7a96]" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-extrabold text-[#0f1e38]">
                                Patient restricted
                              </p>
                              <p className="mt-0.5 font-mono text-[11px] font-bold text-[#8a9ab5]">
                                {bookingCode(b.id)}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top break-words">
                          <p className="flex items-center gap-1.5 text-sm font-extrabold text-[#0f1e38]">
                            <Building2 size={13} className="text-[#8a9ab5]" />
                            <span className="max-w-[280px] truncate">{b.hospital?.name ?? "No hospital"}</span>
                          </p>
                          <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[#6b7a96]">
                            <Stethoscope size={12} className="text-[#8a9ab5]" />
                            {b.doctor ?? "No doctor"}
                          </p>
                          <p className="mt-0.5 text-[11px] font-semibold text-[#a2afc4]">
                            {b.package ?? "No package"}
                          </p>
                        </td>

                        <td className="px-5 py-4 align-top break-words">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold"
                            style={{ background: st.bg, color: st.color }}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ background: st.dot }}
                            />
                            {st.label}
                          </span>
                          <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-[#8a9ab5]">
                            {b.mode === "ONLINE" ? (
                              <Wifi size={10} className="text-blue-400" />
                            ) : (
                              <MapPin size={10} className="text-emerald-500" />
                            )}
                            {b.mode === "ONLINE" ? "Online" : "Physical"}
                          </div>
                          {b.refunded && (
                            <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
                              Refunded
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 text-right align-top break-words">
                          <p className="inline-flex items-center justify-end gap-1.5 text-sm font-extrabold text-[#0f1e38]">
                            {b.amountPaid != null ? fmt(b.amountPaid, b.currency) : "-"}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-right align-top break-words">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() =>
                                setExpandedId((prev) => (prev === b.id ? null : b.id))
                              }
                              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-extrabold text-[#0f1e38] transition hover:border-[#c8a96e]"
                            >
                              Details
                              <ChevronDown
                                size={12}
                                className={`inline ml-1 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-[#fcfbf8]">
                          <td colSpan={6} className="px-5 py-4">
                            <div className="grid gap-3 md:grid-cols-4">
                              {[
                                { label: "Booking ID", value: b.id },
                                {
                                  label: "Scheduled",
                                  value:
                                    fmtDate(b.scheduledAt) +
                                    ` ${fmtSlot(b)}`,
                                },
                                { label: "Created", value: fmtDateTime(b.createdAt) },
                                { label: "Patient data", value: "Restricted" },
                                { label: "Doctor", value: b.doctor ?? "-" },
                                { label: "Package", value: b.package ?? "-" },
                                {
                                  label: "Amount",
                                  value:
                                    b.amountPaid != null
                                      ? fmt(b.amountPaid, b.currency)
                                      : "-",
                                },
                                {
                                  label: "Refund",
                                  value: b.refunded ? "Issued" : "Not refunded",
                                },
                              ].map((item) => (
                                <div
                                  key={item.label}
                                  className="rounded-xl border border-slate-100 bg-white p-3"
                                >
                                  <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#8a9ab5]">
                                    {item.label}
                                  </p>
                                  <p className="break-all text-xs font-bold text-[#0f1e38]">
                                    {item.value}
                                  </p>
                                </div>
                              ))}
                            </div>

                            {b.status === "CANCELLED" && (
                              <div
                                className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3"
                              >
                                <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-red-500">
                                  Cancellation reason
                                </p>
                                <p className="text-sm font-semibold text-[#0f1e38]">
                                  {b.cancellationReason ?? "No reason provided"}
                                </p>
                                {b.cancelledAt && (
                                  <p className="mt-1 text-[10px] font-semibold text-[#8a9ab5]">
                                    Cancelled at {fmtDateTime(b.cancelledAt)}
                                  </p>
                                )}
                              </div>
                            )}
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
          <p className="text-xs font-semibold" style={{ color: "#8a9ab5" }}>
            Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, total)} of{" "}
            {total.toLocaleString()}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-9 w-9 rounded-xl flex items-center justify-center disabled:opacity-30"
              style={{
                background: "#fff",
                border: "1.5px solid rgba(15,30,56,.1)",
              }}
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
              style={{
                background: "#fff",
                border: "1.5px solid rgba(15,30,56,.1)",
              }}
            >
              <ChevronRight size={15} className="text-[#0f1e38]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
