"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  BarChart3,
  Package,
  Phone,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  User,
  Users,
} from "lucide-react";

type Appointment = {
  id: string;
  status: string;
  scheduledAt: string;
  slotTime: string | null;
  mode: string;
  amountPaid: number | null;
  currency: string;
  notes: string | null;
  cancellationReason: string | null;
  checkedInAt: string | null;
  patient: { fullName: string; phone: string | null; gender: string | null; disability: string | null } | null;
  doctor: { fullName: string } | null;
  package: { title: string } | null;
};

type Stats = {
  role: string;
  doctorName: string | null;
  hospital: {
    name: string | null;
    verified: boolean;
    isActive: boolean;
    emergencyAvailable: boolean;
  };
  today: { total: number; pending: number; completed: number; cancelled: number; revenue: number };
  month: { revenue: number; bookings: number };
  totalBookings: number;
  pendingConfirmations: number;
  operations: {
    activeDoctors: number;
    activePackages: number;
    pendingTeamRequests: number;
    teamMembers: number;
  };
  todayAppointments: Appointment[];
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  REQUESTED: { label: "Needs confirmation", bg: "#fff7ed", color: "#c2410c", border: "rgba(194,65,12,.28)" },
  CONFIRMED: { label: "Confirmed", bg: "#eff6ff", color: "#1d4ed8", border: "rgba(29,78,216,.2)" },
  COMPLETED: { label: "Completed", bg: "#ecfdf5", color: "#047857", border: "rgba(4,120,87,.2)" },
  CANCELLED: { label: "Cancelled", bg: "#fff1f2", color: "#be123c", border: "rgba(190,18,60,.2)" },
};

function formatSlotTime(t: string | null) {
  if (!t) return "No time";
  const start = t.split("-")[0].trim();
  const [hour = 0, minute = 0] = start.split(":").map(Number);
  const ampm = hour < 12 ? "AM" : "PM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${String(minute).padStart(2, "0")} ${ampm}`;
}

function formatMoney(cents: number | null, currency = "eur") {
  if (cents == null) return "";
  const symbol = currency.toLowerCase() === "eur" ? "€" : `${currency.toUpperCase()} `;
  return `${symbol}${Math.round(cents / 100).toLocaleString()}`;
}

function appointmentTimeValue(appt: Appointment) {
  const scheduled = new Date(appt.scheduledAt);
  if (appt.slotTime) {
    const [hour = 0, minute = 0] = appt.slotTime.split("-")[0].trim().split(":").map(Number);
    scheduled.setHours(hour, minute, 0, 0);
  }
  return scheduled.getTime();
}

function todayLabel() {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function modeLabel(mode: string) {
  return mode === "ONLINE" ? "Online" : "In person";
}

type SummaryTone = "blue" | "amber" | "green" | "slate";

function SummaryTile({ label, value, tone }: { label: string; value: number | string; tone: SummaryTone }) {
  const colors = {
    blue: { bg: "#eff6ff", color: "#1d4ed8" },
    amber: { bg: "#fff7ed", color: "#c2410c" },
    green: { bg: "#ecfdf5", color: "#047857" },
    slate: { bg: "#f8fafc", color: "#334155" },
  }[tone];

  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-extrabold" style={{ color: colors.color }}>
        {value}
      </p>
    </div>
  );
}

function OwnerMetric({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-extrabold text-[#0f172a]">{value}</p>
          <p className="mt-0.5 text-xs font-medium text-slate-400">{sub}</p>
        </div>
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "#f7f4ef", color: "#a8874f" }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function AlertItem({ tone, title, body }: { tone: "amber" | "green" | "red"; title: string; body: string }) {
  const color = {
    amber: { bg: "#fff7ed", border: "rgba(194,65,12,.18)", text: "#c2410c" },
    green: { bg: "#ecfdf5", border: "rgba(4,120,87,.16)", text: "#047857" },
    red: { bg: "#fff1f2", border: "rgba(190,18,60,.16)", text: "#be123c" },
  }[tone];

  return (
    <div className="rounded-xl border px-3 py-3" style={{ background: color.bg, borderColor: color.border }}>
      <p className="text-xs font-extrabold" style={{ color: color.text }}>{title}</p>
      <p className="mt-1 text-xs font-medium text-slate-500">{body}</p>
    </div>
  );
}

function AppointmentRow({
  appt,
  actionLoading,
  cancelTarget,
  cancelReason,
  onAction,
  onSetCancel,
  onCancelReasonChange,
  onCancelAbort,
  role,
}: {
  appt: Appointment;
  actionLoading: string | null;
  cancelTarget: string | null;
  cancelReason: string;
  onAction: (id: string, action: string, reason?: string) => void;
  onSetCancel: (id: string) => void;
  onCancelReasonChange: (value: string) => void;
  onCancelAbort: () => void;
  role: string;
}) {
  const status = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.CONFIRMED;
  const isActioning = Boolean(actionLoading?.startsWith(appt.id));
  const isCancelTarget = cancelTarget === appt.id;
  const isTerminal = appt.status === "COMPLETED" || appt.status === "CANCELLED";
  const awaitingDoctor = appt.status === "CONFIRMED" && Boolean(appt.checkedInAt);
  const isDoctor = role === "DOCTOR";

  return (
    <div className="rounded-2xl border bg-white" style={{ borderColor: status.border }}>
      <div className="grid gap-4 px-4 py-4 lg:grid-cols-[88px_minmax(0,1fr)_220px] lg:items-center">
        <div className="rounded-xl bg-[#f8fafc] px-3 py-3 text-center">
          <p className="text-lg font-extrabold text-[#0f172a]">{formatSlotTime(appt.slotTime)}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{modeLabel(appt.mode)}</p>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-extrabold text-[#0f172a]">{appt.patient?.fullName ?? "Unknown patient"}</p>
            <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: status.bg, color: status.color }}>
              {awaitingDoctor ? "Checked in" : status.label}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
            {appt.doctor && (
              <span className="inline-flex items-center gap-1.5">
                <Stethoscope size={13} /> {appt.doctor.fullName}
              </span>
            )}
            {appt.package && (
              <span className="inline-flex items-center gap-1.5">
                <Package size={13} /> {appt.package.title}
              </span>
            )}
            {appt.patient?.phone && (
              <a href={`tel:${appt.patient.phone}`} className="inline-flex items-center gap-1.5 font-bold text-[#0f172a] no-underline">
                <Phone size={13} /> {appt.patient.phone}
              </a>
            )}
            {appt.amountPaid != null && <span className="font-bold text-[#0f172a]">{formatMoney(appt.amountPaid, appt.currency)}</span>}
          </div>
          {appt.cancellationReason && <p className="mt-2 text-xs font-semibold text-rose-700">Reason: {appt.cancellationReason}</p>}
        </div>

        {!isTerminal && !isCancelTarget && (
          <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
            {!isDoctor && appt.status === "REQUESTED" && (
              <button
                onClick={() => onAction(appt.id, "CONFIRM")}
                disabled={isActioning}
                className="h-9 rounded-lg bg-[#142746] px-3 text-xs font-bold text-[#d8b975] disabled:opacity-50"
              >
                Confirm
              </button>
            )}
            {appt.status === "CONFIRMED" && (
              <>
                {!isDoctor && (
                  <button
                    onClick={() => onAction(appt.id, "CHECKIN")}
                    disabled={isActioning || Boolean(appt.checkedInAt)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 disabled:opacity-45"
                  >
                    <User size={13} /> {appt.checkedInAt ? "Checked in" : "Check in"}
                  </button>
                )}
                {appt.checkedInAt && (
                  <button
                    onClick={() => onAction(appt.id, "COMPLETE")}
                    disabled={isActioning}
                    className="h-9 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 disabled:opacity-50"
                  >
                    Complete
                  </button>
                )}
              </>
            )}
            {!isDoctor && (
              <button
                onClick={() => onSetCancel(appt.id)}
                className="h-9 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>

      {isCancelTarget && (
        <div className="border-t border-rose-100 bg-rose-50/50 px-4 py-3">
          <textarea
            value={cancelReason}
            onChange={(event) => onCancelReasonChange(event.target.value)}
            placeholder="Reason for cancellation"
            rows={2}
            className="w-full resize-none rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-[#0f172a] outline-none"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => onAction(appt.id, "CANCEL", cancelReason)}
              disabled={!cancelReason.trim() || isActioning}
              className="h-9 rounded-lg bg-rose-700 px-4 text-xs font-bold text-white disabled:opacity-45"
            >
              Confirm cancellation
            </button>
            <button onClick={onCancelAbort} className="h-9 rounded-lg bg-white px-4 text-xs font-bold text-slate-600">
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CompletedAppointmentRow({ appt }: { appt: Appointment }) {
  const careItem = appt.doctor?.fullName ?? appt.package?.title ?? "Care item";

  return (
    <div className="rounded-xl border border-emerald-100 bg-white px-3 py-3">
      <div className="flex items-start gap-3">
        <div className="w-16 flex-shrink-0 rounded-lg bg-[#f8fafc] px-2 py-2 text-center">
          <p className="text-sm font-extrabold leading-tight text-[#0f172a]">{formatSlotTime(appt.slotTime)}</p>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">{modeLabel(appt.mode)}</p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-extrabold text-[#0f172a]">{appt.patient?.fullName ?? "Unknown patient"}</p>
            <span className="flex-shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
              Completed
            </span>
          </div>
          <p className="mt-1 truncate text-xs font-medium text-slate-500">{careItem}</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            {appt.patient?.phone ? (
              <a href={`tel:${appt.patient.phone}`} className="truncate text-xs font-bold text-[#0f172a] no-underline">
                {appt.patient.phone}
              </a>
            ) : (
              <span className="text-xs text-slate-300">No phone</span>
            )}
            {appt.amountPaid != null && <span className="text-xs font-extrabold text-[#0f172a]">{formatMoney(appt.amountPaid, appt.currency)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  empty,
  children,
}: {
  title: string;
  description: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="mb-3">
        <h2 className="text-sm font-extrabold text-[#0f172a]">{title}</h2>
        <p className="mt-0.5 text-xs font-medium text-slate-400">{description}</p>
      </div>
      {empty ? (
        <div className="flex min-h-[120px] items-center justify-center rounded-xl bg-[#f8fafc] text-sm font-semibold text-slate-300">
          Nothing here right now
        </div>
      ) : (
        <div className="space-y-2.5">{children}</div>
      )}
    </section>
  );
}

export default function DashboardClient({ slug }: { slug: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [error, setError] = useState("");

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/h/${slug}/stats`);
      if (!res.ok) throw new Error("Failed to load");
      setStats(await res.json());
    } catch {
      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchStats();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchStats]);

  const handleAction = async (bookingId: string, action: string, reason?: string) => {
    setActionLoading(bookingId + action);
    setError("");
    try {
      const res = await fetch(`/api/admin/h/${slug}/bookings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, action, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Action failed");
        return;
      }
      if (action === "CANCEL" && data.refundError) {
        setError(`Booking cancelled but refund failed: ${data.refundError}`);
      }
      setCancelTarget(null);
      setCancelReason("");
      await fetchStats();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const sortedAppointments = useMemo(() => {
    const order: Record<string, number> = { REQUESTED: 0, CONFIRMED: 1, COMPLETED: 2, CANCELLED: 3 };
    return [...(stats?.todayAppointments ?? [])].sort((a, b) => {
      const statusDelta = (order[a.status] ?? 9) - (order[b.status] ?? 9);
      return statusDelta !== 0 ? statusDelta : appointmentTimeValue(a) - appointmentTimeValue(b);
    });
  }, [stats]);

  const queues = useMemo(() => {
    const isDoctor = stats?.role === "DOCTOR";
    const needsAction = sortedAppointments.filter((appt) =>
      isDoctor
        ? appt.status === "CONFIRMED" && Boolean(appt.checkedInAt)
        : appt.status === "REQUESTED" || (appt.status === "CONFIRMED" && appt.checkedInAt),
    );
    const upcoming = sortedAppointments.filter((appt) => appt.status === "CONFIRMED" && !appt.checkedInAt);
    const completed = sortedAppointments.filter((appt) => appt.status === "COMPLETED");
    const cancelled = sortedAppointments.filter((appt) => appt.status === "CANCELLED");
    return { needsAction, upcoming, completed, cancelled };
  }, [sortedAppointments, stats?.role]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#c8a96e] border-r-transparent" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm font-semibold text-slate-400">
        <AlertCircle size={18} />
        {error || "No dashboard data available"}
      </div>
    );
  }

  const isDoctor = stats.role === "DOCTOR";
  const isOwner = stats.role === "OWNER";
  const isManager = stats.role === "MANAGER";
  const isBusinessAdmin = isOwner || isManager;
  const summaryTiles: { label: string; value: number | string; tone: SummaryTone }[] = isDoctor
    ? [
        { label: "Checked in", value: queues.needsAction.length, tone: queues.needsAction.length ? "amber" : "slate" },
        { label: "Upcoming", value: queues.upcoming.length, tone: "blue" },
        { label: "Completed", value: stats.today.completed, tone: "green" },
        { label: "Scheduled", value: stats.today.total, tone: "slate" },
      ]
    : isBusinessAdmin
      ? [
          { label: "Month revenue", value: formatMoney(stats.month.revenue, "eur"), tone: "slate" },
          { label: "Month bookings", value: stats.month.bookings, tone: "blue" },
          { label: "Needs action", value: queues.needsAction.length, tone: queues.needsAction.length ? "amber" : "slate" },
          { label: "Today revenue", value: formatMoney(stats.today.revenue, "eur"), tone: "green" },
        ]
    : [
        { label: "Needs action", value: queues.needsAction.length, tone: queues.needsAction.length ? "amber" : "slate" },
        { label: "Upcoming", value: queues.upcoming.length, tone: "blue" },
        { label: "Completed", value: stats.today.completed, tone: "green" },
        { label: "Today revenue", value: formatMoney(stats.today.revenue, "eur"), tone: "slate" },
      ];

  return (
    <div className="w-full max-w-[1180px] space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c8a96e]">
            {isDoctor ? "Doctor workspace" : isOwner ? "Owner command center" : isManager ? "Manager operations" : "Reception desk"}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#0f172a]">
            {isDoctor ? "My Appointments" : isBusinessAdmin ? stats.hospital.name ?? "Hospital Overview" : "Today's Operations"}
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">{todayLabel()}</p>
          {isDoctor && stats.doctorName && (
            <p className="mt-1 text-sm font-bold text-[#0f172a]">{stats.doctorName}</p>
          )}
        </div>
        <button
          onClick={fetchStats}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {summaryTiles.map((tile) => (
          <SummaryTile key={tile.label} label={tile.label} value={tile.value} tone={tile.tone} />
        ))}
      </div>

      {isBusinessAdmin && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <OwnerMetric
            icon={<Stethoscope size={16} />}
            label="Doctors"
            value={stats.operations.activeDoctors}
            sub="Linked to this hospital"
          />
          <OwnerMetric
            icon={<Package size={16} />}
            label="Active Packages"
            value={stats.operations.activePackages}
            sub="Visible service catalog"
          />
          <OwnerMetric
            icon={<Users size={16} />}
            label="Team"
            value={stats.operations.teamMembers}
            sub={`${stats.operations.pendingTeamRequests} pending request${stats.operations.pendingTeamRequests === 1 ? "" : "s"}`}
          />
          <OwnerMetric
            icon={<BarChart3 size={16} />}
            label="All Bookings"
            value={stats.totalBookings}
            sub={`${stats.pendingConfirmations} awaiting confirmation`}
          />
        </div>
      )}

      {isBusinessAdmin && (
        <section className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold text-[#0f172a]">Owner Signals</h2>
              <p className="mt-0.5 text-xs font-medium text-slate-400">
                Quick business and access checks for this hospital.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
                style={{
                  background: stats.hospital.verified ? "#ecfdf5" : "#fff7ed",
                  color: stats.hospital.verified ? "#047857" : "#c2410c",
                }}>
                <BadgeCheck size={12} /> {stats.hospital.verified ? "Verified" : "Verification pending"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
                style={{
                  background: stats.hospital.isActive ? "#ecfdf5" : "#fff1f2",
                  color: stats.hospital.isActive ? "#047857" : "#be123c",
                }}>
                <ShieldCheck size={12} /> {stats.hospital.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <AlertItem
              tone={stats.pendingConfirmations > 0 ? "amber" : "green"}
              title={stats.pendingConfirmations > 0 ? "Confirmations waiting" : "Booking queue clear"}
              body={stats.pendingConfirmations > 0 ? `${stats.pendingConfirmations} booking request${stats.pendingConfirmations === 1 ? "" : "s"} still need confirmation.` : "No unconfirmed booking requests right now."}
            />
            <AlertItem
              tone={stats.operations.pendingTeamRequests > 0 ? "amber" : "green"}
              title={stats.operations.pendingTeamRequests > 0 ? "Team requests pending" : "Team access settled"}
              body={stats.operations.pendingTeamRequests > 0 ? `${stats.operations.pendingTeamRequests} access request${stats.operations.pendingTeamRequests === 1 ? "" : "s"} need review.` : "No pending team access requests."}
            />
            <AlertItem
              tone={stats.hospital.emergencyAvailable ? "green" : "amber"}
              title={stats.hospital.emergencyAvailable ? "Emergency flag enabled" : "Emergency flag off"}
              body={stats.hospital.emergencyAvailable ? "Emergency availability is visible on the listing." : "Emergency availability is not shown on the listing."}
            />
          </div>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.48fr)]">
        <div className="space-y-4">
          <Section
            title="Needs Action"
            description={isDoctor ? "Checked-in patients ready for you to complete after care is finished." : "Confirm new requests, then complete checked-in appointments after care is finished."}
            empty={queues.needsAction.length === 0}
          >
            {queues.needsAction.map((appt) => (
              <AppointmentRow
                key={appt.id}
                appt={appt}
                actionLoading={actionLoading}
                cancelTarget={cancelTarget}
                cancelReason={cancelReason}
                onAction={handleAction}
                onSetCancel={setCancelTarget}
                onCancelReasonChange={setCancelReason}
                onCancelAbort={() => {
                  setCancelTarget(null);
                  setCancelReason("");
                }}
                role={stats.role}
              />
            ))}
          </Section>

          <Section title={isDoctor ? "My Upcoming Patients" : "Upcoming Queue"} description="Confirmed patients who have not checked in yet." empty={queues.upcoming.length === 0}>
            {queues.upcoming.map((appt) => (
              <AppointmentRow
                key={appt.id}
                appt={appt}
                actionLoading={actionLoading}
                cancelTarget={cancelTarget}
                cancelReason={cancelReason}
                onAction={handleAction}
                onSetCancel={setCancelTarget}
                onCancelReasonChange={setCancelReason}
                onCancelAbort={() => {
                  setCancelTarget(null);
                  setCancelReason("");
                }}
                role={stats.role}
              />
            ))}
          </Section>
        </div>

        <Section title="Completed Today" description="Appointments already marked complete." empty={queues.completed.length === 0}>
          <div className="space-y-3">
          {queues.completed.map((appt) => (
            <CompletedAppointmentRow key={appt.id} appt={appt} />
          ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
