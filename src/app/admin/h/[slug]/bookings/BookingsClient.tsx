"use client";

import { useEffect, useState, useCallback, useRef, Fragment } from "react";
import {
  CalendarDays,
  Search,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  Package,
  Phone,
  User,
  AlertCircle,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Circle,
  ChevronDown,
  SlidersHorizontal,
} from "lucide-react";

type Booking = {
  id: string;
  status: string;
  scheduledAt: string;
  createdAt: string;
  slotTime: string | null;
  mode: string;
  amountPaid: number | null;
  currency: string;
  notes: string | null;
  cancellationReason: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  checkedInAt: string | null;
  cancelledAt: string | null;
  refundedAt: string | null;
  stripeRefundId: string | null;
  patient: { fullName: string; phone: string | null; gender: string | null; disability: string | null } | null;
  doctor: { fullName: string } | null;
  package: { title: string } | null;
};

type BookingsResponse = {
  role: string;
  doctorName: string | null;
  bookings: Booking[];
  total: number;
  page: number;
  hasMore: boolean;
};

const STATUS_TABS = [
  { value: "all",       label: "All",       icon: Circle,       dotColor: "#94a3b8" },
  { value: "requested", label: "Pending",   icon: Clock,        dotColor: "#f59e0b" },
  { value: "confirmed", label: "Confirmed", icon: CheckCircle2, dotColor: "#3b82f6" },
  { value: "completed", label: "Completed", icon: CheckCircle2, dotColor: "#10b981" },
  { value: "cancelled", label: "Cancelled", icon: XCircle,      dotColor: "#ef4444" },
];

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; dot: string; border: string }> = {
  REQUESTED: { label: "Pending",   bg: "#fef3c7", color: "#92620a", dot: "#f59e0b", border: "#fcd34d" },
  CONFIRMED: { label: "Confirmed", bg: "#dbeafe", color: "#1e40af", dot: "#3b82f6", border: "#93c5fd" },
  COMPLETED: { label: "Completed", bg: "#d1fae5", color: "#065f46", dot: "#10b981", border: "#6ee7b7" },
  CANCELLED: { label: "Cancelled", bg: "#fee2e2", color: "#991b1b", dot: "#ef4444", border: "#fca5a5" },
};

const ACTIVE_TAB_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  all:       { bg: "#1a3059",  color: "#c8a96e", border: "transparent" },
  requested: { bg: "#fef3c7",  color: "#92620a", border: "#fcd34d" },
  confirmed: { bg: "#dbeafe",  color: "#1e40af", border: "#93c5fd" },
  completed: { bg: "#d1fae5",  color: "#065f46", border: "#6ee7b7" },
  cancelled: { bg: "#fee2e2",  color: "#991b1b", border: "#fca5a5" },
};

function formatSlotTime(t: string) {
  const start = t.split("-")[0].trim();
  const [h, m = 0] = start.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatMoney(cents: number, currency: string) {
  const sym = currency.toLowerCase() === "eur" ? "€" : `${currency.toUpperCase()} `;
  return `${sym}${Math.round(cents / 100).toLocaleString()}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function PatientInitials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`
    : parts[0].slice(0, 2);
  return (
    <div style={{
      width: 34, height: 34, borderRadius: "50%",
      background: "linear-gradient(135deg, #1a3059 0%, #0f1e38 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      <span style={{ color: "#c8a96e", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em" }}>
        {initials.toUpperCase()}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.CONFIRMED;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: cfg.bg, color: cfg.color,
      fontSize: 10.5, fontWeight: 600, letterSpacing: "0.03em",
      padding: "3px 9px", borderRadius: 20,
      border: `0.5px solid ${cfg.border}`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}



export default function BookingsClient({ slug }: { slug: string }) {
  const [data, setData] = useState<BookingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(() => {
    if (typeof window === "undefined") return "all";
    return new URLSearchParams(window.location.search).get("status") ?? "all";
  });
  const [date, setDate] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchBookings = useCallback(async (s = status, d = date, q = search, p = page) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ status: s, page: String(p) });
      if (d) params.set("date", d);
      if (q) params.set("search", q);
      const res = await fetch(`/api/admin/h/${slug}/bookings?${params}`);
      if (!res.ok) throw new Error("Failed");
      setData(await res.json());
    } catch {
      setError("Failed to load bookings. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [slug, status, date, search, page]);

  useEffect(() => { fetchBookings(); }, [status, date, search, page]); // eslint-disable-line

  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => { setSearch(val); setPage(1); }, 350);
  };

  const handleStatusTab = (s: string) => { setStatus(s); setPage(1); };
  const handleDate = (d: string) => { setDate(d); setPage(1); };

  const handleAction = async (bookingId: string, action: string, reason?: string) => {
    setActionLoading(bookingId + action);
    setError("");
    try {
      const res = await fetch(`/api/admin/h/${slug}/bookings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, action, reason }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Action failed"); return; }
      if (action === "CANCEL" && d.refundError) setError(`Booking cancelled but refund failed: ${d.refundError}`);
      setCancelTarget(null);
      setCancelReason("");
      await fetchBookings();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const hasFilters = date || search;
  const isDoctor = data?.role === "DOCTOR";
  const headerSummary = data
    ? `${data.total.toLocaleString()} booking${data.total !== 1 ? "s" : ""}${isDoctor && data.doctorName ? ` for ${data.doctorName}` : ""}`
    : "Loading...";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#0f1e38", letterSpacing: "-0.02em", margin: 0 }}>
            {isDoctor ? "My Bookings" : "Bookings"}
          </h1>
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 3, fontWeight: 400 }}>
            {data ? `${data.total.toLocaleString()} booking${data.total !== 1 ? "s" : ""}` : "Loading…"}
          </p>
        </div>
        <button
          onClick={() => fetchBookings()}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "0 12px", height: 32, borderRadius: 8,
            background: "#fff", border: "0.5px solid rgba(15,30,56,.15)",
            color: "#6b7a96", fontSize: 12, fontWeight: 500, cursor: "pointer",
            transition: "all .15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "#c8a96e"; e.currentTarget.style.color = "#a88b50"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(15,30,56,.15)"; e.currentTarget.style.color = "#6b7a96"; }}
        >
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {/* ── Toolbar — single row ── */}
      <div style={{
        background: "#fff", borderRadius: 12,
        border: "0.5px solid rgba(15,30,56,.08)",
        padding: "8px 10px",
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
      }}>
        {/* Status tabs */}
        <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
          {STATUS_TABS.map((tab) => {
            const active = status === tab.value;
            const activeStyle = ACTIVE_TAB_STYLE[tab.value];
            return (
              <button
                key={tab.value}
                onClick={() => handleStatusTab(tab.value)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "0 11px", height: 30, borderRadius: 7,
                  background: active ? activeStyle.bg : "transparent",
                  color: active ? activeStyle.color : "#6b7a96",
                  border: active ? `0.5px solid ${activeStyle.border}` : "0.5px solid transparent",
                  fontSize: 12, fontWeight: active ? 600 : 400, cursor: "pointer",
                  transition: "all .12s", letterSpacing: "0.01em", whiteSpace: "nowrap",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#f4f3f0"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: active ? tab.dotColor : "#d1d5db", flexShrink: 0,
                }} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: "rgba(15,30,56,.08)", flexShrink: 0 }} />

        {/* Search */}
        <div style={{
          flex: 1, minWidth: 180,
          display: "flex", alignItems: "center", gap: 7,
          height: 30, borderRadius: 7, padding: "0 10px",
          background: "#f4f3f0", border: "0.5px solid rgba(15,30,56,.1)",
        }}>
          <Search size={12} style={{ color: "#9ca3af", flexShrink: 0 }} />
          <input
            value={searchInput}
            onChange={e => handleSearchInput(e.target.value)}
            placeholder="Search patient or booking ID…"
            style={{
              flex: 1, fontSize: 12.5, outline: "none",
              background: "transparent", color: "#0f1e38", border: "none",
              fontFamily: "inherit",
            }}
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(""); setSearch(""); setPage(1); }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#9ca3af", display: "flex" }}>
              <XCircle size={12} />
            </button>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: "rgba(15,30,56,.08)", flexShrink: 0 }} />

        {/* Date */}
        <div style={{
          display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
          height: 30, borderRadius: 7, padding: "0 10px",
          background: "#f4f3f0", border: "0.5px solid rgba(15,30,56,.1)",
        }}>
          <CalendarDays size={12} style={{ color: "#9ca3af", flexShrink: 0 }} />
          <input
            type="date"
            value={date}
            onChange={e => handleDate(e.target.value)}
            style={{ fontSize: 12.5, outline: "none", background: "transparent", color: "#0f1e38", border: "none", fontFamily: "inherit" }}
          />
          {date && (
            <button onClick={() => handleDate("")}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#9ca3af", display: "flex" }}>
              <XCircle size={12} />
            </button>
          )}
        </div>

        {hasFilters && (
          <>
            <div style={{ width: 1, height: 20, background: "rgba(15,30,56,.08)", flexShrink: 0 }} />
            <button
              onClick={() => { setDate(""); setSearch(""); setSearchInput(""); setPage(1); }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                height: 30, padding: "0 10px", borderRadius: 7,
                background: "#fff0f0", border: "0.5px solid #fca5a5",
                color: "#dc2626", fontSize: 12, fontWeight: 500, cursor: "pointer", flexShrink: 0,
              }}
            >
              <SlidersHorizontal size={11} /> Clear
            </button>
          </>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{
          display: "flex", alignItems: "center", gap: 9,
          padding: "10px 14px", borderRadius: 10,
          background: "#fff0f0", border: "0.5px solid #fca5a5",
          color: "#dc2626", fontSize: 12.5, fontWeight: 500,
        }}>
          <AlertCircle size={13} style={{ flexShrink: 0 }} /> {error}
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 240 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            border: "2px solid #c8a96e", borderTopColor: "transparent",
            animation: "spin 0.65s linear infinite",
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : !data || data.bookings.length === 0 ? (
        <div style={{
          background: "#fff", borderRadius: 14,
          border: "0.5px solid rgba(15,30,56,.08)",
          padding: "60px 24px", textAlign: "center",
        }}>
          <CalendarDays size={30} style={{ color: "#e5e7eb", margin: "0 auto 10px" }} />
          <p style={{ fontSize: 13.5, fontWeight: 500, color: "#9ca3af", margin: "0 0 3px" }}>No bookings found</p>
          <p style={{ fontSize: 12, color: "#d1d5db", margin: 0 }}>Try adjusting your filters</p>
        </div>
      ) : (
        <div style={{
          background: "#fff", borderRadius: 14,
          border: "0.5px solid rgba(15,30,56,.08)",
          overflow: "hidden",
        }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 960, borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "#f8f7f5", borderBottom: "0.5px solid rgba(15,30,56,.07)" }}>
                  {["Appointment", "Patient", "Care", "Status", "Payment", "Actions"].map((h, i) => (
                    <th key={h} style={{
                      padding: "10px 18px",
                      textAlign: i >= 4 ? "right" : "left",
                      fontSize: 10, fontWeight: 500, letterSpacing: "0.1em",
                      textTransform: "uppercase", color: "#a0aec0",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.bookings.map((booking) => {
                  const isActioning = !!actionLoading?.startsWith(booking.id);
                  const isExpanded = expandedId === booking.id;
                  const isCancelTarget = cancelTarget === booking.id;
                  const patientName = booking.patient?.fullName ?? "Unknown Patient";

                  return (
                    <Fragment key={booking.id}>
                      <tr
                        style={{ borderBottom: "0.5px solid rgba(15,30,56,.05)", transition: "background .1s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#fdfcfa")}
                        onMouseLeave={e => (e.currentTarget.style.background = "")}
                      >
                        {/* Appointment */}
                        <td style={{ padding: "14px 18px", verticalAlign: "top" }}>
                          <p style={{ margin: "0 0 2px", fontWeight: 600, color: "#0f1e38", fontSize: 13 }}>
                            {formatDate(booking.scheduledAt)}
                          </p>
                          <p style={{ margin: "0 0 7px", color: "#6b7280", fontWeight: 400, fontSize: 12 }}>
                            {booking.slotTime ? formatSlotTime(booking.slotTime) : "—"}
                          </p>
                          <span style={{
                            display: "inline-block",
                            fontSize: 10, fontWeight: 500, letterSpacing: "0.03em",
                            padding: "2px 8px", borderRadius: 20,
                            background: booking.mode === "ONLINE" ? "#fef3c7" : "#d1fae5",
                            color: booking.mode === "ONLINE" ? "#92620a" : "#065f46",
                          }}>
                            {booking.mode === "ONLINE" ? "Online" : "In-person"}
                          </span>
                        </td>

                        {/* Patient */}
                        <td style={{ padding: "14px 18px", verticalAlign: "top" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 5 }}>
                            <PatientInitials name={patientName} />
                            <div>
                              <p style={{ margin: 0, fontWeight: 600, color: "#0f1e38", fontSize: 13 }}>{patientName}</p>
                              {booking.patient?.gender && (
                                <p style={{ margin: 0, fontSize: 11, color: "#9ca3af", display: "flex", alignItems: "center", gap: 3, marginTop: 1 }}>
                                  <User size={9} /> {booking.patient.gender}
                                </p>
                              )}
                            </div>
                          </div>
                          {booking.patient?.phone && (
                            <a href={`tel:${booking.patient.phone}`} style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              fontSize: 11, color: "#a88b50", textDecoration: "none",
                              fontWeight: 500,
                            }}>
                              <Phone size={9} /> {booking.patient.phone}
                            </a>
                          )}
                          <p style={{ margin: "5px 0 0", fontSize: 10, color: "#c4c9d4", fontFamily: "monospace" }}>
                            #{booking.id.slice(0, 10)}
                          </p>
                        </td>

                        {/* Care */}
                        <td style={{ padding: "14px 18px", verticalAlign: "top" }}>
                          {booking.doctor ? (
                            <p style={{ margin: "0 0 5px", display: "flex", alignItems: "center", gap: 5, fontWeight: 500, color: "#0f1e38", fontSize: 12.5 }}>
                              <Stethoscope size={11} style={{ color: "#9ca3af", flexShrink: 0 }} /> {booking.doctor.fullName}
                            </p>
                          ) : (
                            <p style={{ margin: "0 0 5px", color: "#d1d5db", fontSize: 12 }}>No doctor assigned</p>
                          )}
                          {booking.package ? (
                            <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#6b7280" }}>
                              <Package size={10} style={{ flexShrink: 0 }} /> {booking.package.title}
                            </p>
                          ) : (
                            <p style={{ margin: 0, fontSize: 11, color: "#d1d5db" }}>No package</p>
                          )}
                        </td>

                        {/* Status */}
                        <td style={{ padding: "14px 18px", verticalAlign: "top" }}>
                          <StatusBadge status={booking.status} />
                          {booking.checkedInAt && (
                            <p style={{ margin: "5px 0 0", fontSize: 11, color: "#059669", fontWeight: 500 }}>
                              ✓ Checked in
                            </p>
                          )}
                        </td>

                        {/* Payment */}
                        <td style={{ padding: "14px 18px", verticalAlign: "top", textAlign: "right" }}>
                          <p style={{ margin: "0 0 4px", fontWeight: 600, color: "#0f1e38", fontSize: 13 }}>
                            {booking.amountPaid != null ? formatMoney(booking.amountPaid, booking.currency) : "—"}
                          </p>
                          {booking.refundedAt && (
                            <span style={{
                              fontSize: 10, fontWeight: 500, color: "#4f46e5",
                              background: "rgba(79,70,229,.09)", padding: "2px 7px", borderRadius: 20,
                            }}>Refunded</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: "14px 18px", verticalAlign: "top" }}>
                          <div style={{ display: "flex", gap: 5, justifyContent: "flex-end", flexWrap: "wrap" }}>
                            {!isDoctor && booking.status === "REQUESTED" && (
                              <ActionBtn
                                onClick={() => handleAction(booking.id, "CONFIRM")}
                                disabled={isActioning || (isDoctor && !booking.checkedInAt)}
                                variant="primary"
                              >
                                {actionLoading === booking.id + "CONFIRM" ? "…" : "Confirm"}
                              </ActionBtn>
                            )}

                            {!isDoctor && booking.status === "CONFIRMED" && (
                              <ActionBtn
                                onClick={() => handleAction(booking.id, "CHECKIN")}
                                disabled={isActioning || !!booking.checkedInAt}
                                variant="success"
                              >
                                {booking.checkedInAt ? "Checked in" : "Check in"}
                              </ActionBtn>
                            )}

                            {booking.status === "CONFIRMED" && (
                              <ActionBtn
                                onClick={() => handleAction(booking.id, "COMPLETE")}
                                disabled={isActioning}
                                variant="success-outline"
                              >
                                {actionLoading === booking.id + "COMPLETE" ? "…" : "Complete"}
                              </ActionBtn>
                            )}

                            {!isDoctor && (booking.status === "REQUESTED" || booking.status === "CONFIRMED") && (
                              <ActionBtn
                                onClick={() => { setCancelTarget(booking.id); setExpandedId(booking.id); }}
                                variant="danger"
                              >
                                Cancel
                              </ActionBtn>
                            )}

                            <button
                              onClick={() => {
                                setExpandedId(prev => prev === booking.id ? null : booking.id);
                                if (expandedId === booking.id) { setCancelTarget(null); setCancelReason(""); }
                              }}
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                height: 28, padding: "0 10px", borderRadius: 7,
                                background: "#fff", border: "0.5px solid rgba(15,30,56,.15)",
                                color: "#374151", fontSize: 12, fontWeight: 500, cursor: "pointer",
                              }}
                            >
                              Details
                              <ChevronDown size={11} style={{ transform: isExpanded ? "rotate(180deg)" : "", transition: "transform .2s" }} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* ── Expanded row ── */}
                      {isExpanded && (
                        <tr style={{ background: "#faf9f7", borderBottom: "0.5px solid rgba(15,30,56,.05)" }}>
                          <td colSpan={6} style={{ padding: "0 18px 18px" }}>
                            <div style={{
                              borderTop: "0.5px dashed rgba(15,30,56,.09)",
                              paddingTop: 16,
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                              gap: 14,
                            }}>
                              {/* Left — Booking details */}
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                {[
                                  { label: "Booking ID", value: booking.id, mono: true },
                                  { label: "Created", value: formatDateTime(booking.createdAt) },
                                  { label: "Confirmed at", value: booking.confirmedAt ? formatDateTime(booking.confirmedAt) : "—" },
                                  { label: "Completed at", value: booking.completedAt ? formatDateTime(booking.completedAt) : "—" },
                                ].map(item => (
                                  <div key={item.label} style={{
                                    background: "#fff", borderRadius: 8,
                                    border: "0.5px solid rgba(15,30,56,.08)",
                                    padding: "9px 12px",
                                  }}>
                                    <p style={{ margin: "0 0 3px", fontSize: 9.5, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "#a0aec0" }}>{item.label}</p>
                                    <p style={{ margin: 0, fontSize: item.mono ? 10.5 : 12, fontWeight: 500, color: "#0f1e38", wordBreak: "break-all", fontFamily: item.mono ? "monospace" : "inherit" }}>{item.value}</p>
                                  </div>
                                ))}
                                <div style={{
                                  gridColumn: "1 / -1", background: "#fff", borderRadius: 8,
                                  border: "0.5px solid rgba(15,30,56,.08)", padding: "9px 12px",
                                }}>
                                  <p style={{ margin: "0 0 4px", fontSize: 9.5, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "#a0aec0" }}>Notes</p>
                                  <p style={{ margin: 0, fontSize: 12.5, color: booking.notes ? "#374151" : "#d1d5db", lineHeight: 1.6 }}>
                                    {booking.notes || "No notes for this booking."}
                                  </p>
                                </div>
                                {(booking.cancellationReason || booking.cancelledAt || booking.refundedAt || booking.stripeRefundId) && (
                                  <div style={{
                                    gridColumn: "1 / -1", background: "#fff5f5", borderRadius: 8,
                                    border: "0.5px solid #fca5a5", padding: "9px 12px",
                                  }}>
                                    <p style={{ margin: "0 0 5px", fontSize: 9.5, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "#ef4444" }}>Cancellation &amp; refund</p>
                                    {booking.cancellationReason && <p style={{ margin: "0 0 3px", fontSize: 12.5, color: "#dc2626" }}>{booking.cancellationReason}</p>}
                                    {booking.cancelledAt && <p style={{ margin: "0 0 2px", fontSize: 11.5, color: "#6b7280" }}>Cancelled {formatDateTime(booking.cancelledAt)}</p>}
                                    {booking.refundedAt && <p style={{ margin: "0 0 2px", fontSize: 11.5, color: "#4f46e5" }}>Refunded {formatDateTime(booking.refundedAt)}</p>}
                                    {booking.stripeRefundId && <p style={{ margin: 0, fontSize: 10.5, color: "#9ca3af", wordBreak: "break-all", fontFamily: "monospace" }}>Refund ID: {booking.stripeRefundId}</p>}
                                  </div>
                                )}
                              </div>

                              {/* Right — Cancel panel */}
                              <div style={{
                                background: isCancelTarget ? "#fff8f8" : "#fff",
                                borderRadius: 10,
                                border: `0.5px solid ${isCancelTarget ? "#fca5a5" : "rgba(15,30,56,.08)"}`,
                                padding: "12px 14px",
                                transition: "all .2s",
                              }}>
                                <p style={{ margin: "0 0 9px", fontSize: 9.5, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: isCancelTarget ? "#ef4444" : "#a0aec0" }}>
                                  Cancellation panel
                                </p>
                                {isCancelTarget ? (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                                    <textarea
                                      value={cancelReason}
                                      onChange={e => setCancelReason(e.target.value)}
                                      placeholder="Provide a reason for cancellation…"
                                      rows={3}
                                      style={{
                                        width: "100%", boxSizing: "border-box",
                                        borderRadius: 8, padding: "9px 11px",
                                        fontSize: 12.5, outline: "none", resize: "none",
                                        background: "#fff", border: "0.5px solid #fca5a5",
                                        color: "#0f1e38", lineHeight: 1.5,
                                        fontFamily: "inherit",
                                      }}
                                    />
                                    <div style={{ display: "flex", gap: 7 }}>
                                      <ActionBtn
                                        onClick={() => handleAction(booking.id, "CANCEL", cancelReason)}
                                        disabled={!cancelReason.trim() || isActioning}
                                        variant="danger-solid"
                                      >
                                        {isActioning ? "…" : "Confirm cancellation"}
                                      </ActionBtn>
                                      <ActionBtn onClick={() => { setCancelTarget(null); setCancelReason(""); }} variant="ghost">
                                        Dismiss
                                      </ActionBtn>
                                    </div>
                                  </div>
                                ) : (
                                  <p style={{ margin: 0, fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>
                                    Click <strong style={{ fontWeight: 500, color: "#6b7280" }}>Cancel</strong> in the Actions column to open this panel.
                                  </p>
                                )}
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

      {/* ── Pagination ── */}
      {data && data.total > 20 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data.total)} of {data.total.toLocaleString()}
          </p>
          <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
            <PageBtn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft size={13} />
            </PageBtn>
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              height: 32, padding: "0 14px", borderRadius: 8,
              background: "#1a3059", color: "#c8a96e",
              fontSize: 12.5, fontWeight: 600,
            }}>
              {page}
            </span>
            <PageBtn onClick={() => setPage(p => p + 1)} disabled={!data.hasMore}>
              <ChevronRight size={13} />
            </PageBtn>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Small reusable button components ── */

type ActionBtnVariant = "primary" | "success" | "success-outline" | "danger" | "danger-solid" | "ghost";

function ActionBtn({ onClick, disabled, variant, children }: {
  onClick?: () => void;
  disabled?: boolean;
  variant: ActionBtnVariant;
  children: React.ReactNode;
}) {
  const styles: Record<ActionBtnVariant, React.CSSProperties> = {
    primary:           { background: "linear-gradient(135deg,#1a3059,#0f1e38)", color: "#c8a96e", border: "none" },
    success:           { background: "#d1fae5", color: "#065f46", border: "0.5px solid #6ee7b7" },
    "success-outline": { background: "#fff",    color: "#065f46", border: "0.5px solid #6ee7b7" },
    danger:            { background: "#fff",    color: "#dc2626", border: "0.5px solid #fca5a5" },
    "danger-solid":    { background: "#dc2626", color: "#fff",    border: "none" },
    ghost:             { background: "#f4f3f0", color: "#6b7a96", border: "0.5px solid rgba(15,30,56,.09)" },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center",
        height: 28, padding: "0 10px", borderRadius: 7,
        fontSize: 12, fontWeight: 500, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1, transition: "opacity .12s",
        whiteSpace: "nowrap",
        ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}

function PageBtn({ onClick, disabled, children }: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 32, height: 32, borderRadius: 8,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "#fff", border: "0.5px solid rgba(15,30,56,.12)", color: "#374151",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.25 : 1, transition: "opacity .12s",
      }}
    >
      {children}
    </button>
  );
}
