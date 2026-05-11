"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  Search,
} from "lucide-react";

type Occurrence = {
  date: string;
  dayOfWeek: number;
  mode: string;
  startTime: string;
  endTime: string;
  doctorId: string;
  windowId: string;
  bookingId: string | null;
  bookingStatus: string | null;
  patientName: string | null;
  patientPhone: string | null;
};

type ScheduleDate = {
  date: string;
  dayOfWeek: number;
  label: string;
};

type DoctorGroup = {
  doctorId: string;
  doctorName: string;
  specialty: string | null;
  department: { id: string; name: string; sortOrder: number } | null;
  occurrences: Occurrence[];
};

type DepartmentOption = {
  id: string;
  name: string;
  sortOrder: number;
};

type DoctorOption = {
  doctorId: string;
  doctorName: string;
  specialty: string | null;
  department: { id: string; name: string; sortOrder: number } | null;
};

const STATUS_STYLES: Record<string, { label: string; bg: string; border: string; color: string }> = {
  REQUESTED: {
    label: "Requested",
    bg: "rgba(200,169,110,.12)",
    border: "rgba(200,169,110,.45)",
    color: "#9a762d",
  },
  CONFIRMED: {
    label: "Booked",
    bg: "rgba(37,99,235,.09)",
    border: "rgba(37,99,235,.24)",
    color: "#1d4ed8",
  },
  COMPLETED: {
    label: "Completed",
    bg: "rgba(16,185,129,.11)",
    border: "rgba(16,185,129,.28)",
    color: "#047857",
  },
  CANCELLED: {
    label: "Cancelled",
    bg: "rgba(239,68,68,.08)",
    border: "rgba(239,68,68,.24)",
    color: "#dc2626",
  },
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function formatMode(mode: string) {
  return mode === "ONLINE" ? "Online" : "Physical";
}

function isExpired(date: string, startTime: string) {
  const [hour = 0, minute = 0] = startTime.split(":").map(Number);
  const at = new Date(`${date}T00:00:00`);
  at.setHours(hour, minute, 0, 0);
  return at.getTime() <= Date.now();
}

function weekLabel(dates: ScheduleDate[]) {
  if (dates.length === 0) return "Schedule";
  const first = new Date(`${dates[0].date}T00:00:00`);
  const last = new Date(`${dates[dates.length - 1].date}T00:00:00`);
  const sameMonth = first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear();
  const firstLabel = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: sameMonth ? undefined : "short",
  }).format(first);
  const lastLabel = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(last);
  return `${firstLabel} - ${lastLabel}`;
}

function dayName(date: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(new Date(`${date}T00:00:00`));
}

export default function AvailabilityClient({
  slug,
  role,
}: {
  slug: string;
  canManage: boolean;
  role: string;
}) {
  const [doctors, setDoctors] = useState<DoctorGroup[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [doctorOptions, setDoctorOptions] = useState<DoctorOption[]>([]);
  const [dates, setDates] = useState<ScheduleDate[]>([]);
  const [weekStart, setWeekStart] = useState(() => formatDate(getToday()));
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [viewMode, setViewMode] = useState<"single" | "all">("single");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [slotFilter, setSlotFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isDoctorRole = role === "DOCTOR";

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ start: weekStart });
      if (!isDoctorRole) {
        params.set("departmentId", departmentFilter);
        params.set("viewMode", viewMode);
        if (selectedDoctorId) params.set("doctorId", selectedDoctorId);
      }
      const res = await fetch(`/api/admin/h/${slug}/availability?${params.toString()}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setDoctors(data.doctors ?? []);
      setDates(data.dates ?? []);
      setDepartments(data.departments ?? []);
      setDoctorOptions(data.doctorOptions ?? []);
      if (!isDoctorRole && data.viewMode === "single" && typeof data.selectedDoctorId === "string") {
        setSelectedDoctorId((prev) => (prev === data.selectedDoctorId ? prev : data.selectedDoctorId));
      }
    } catch {
      setError("Failed to load doctor schedules.");
    } finally {
      setLoading(false);
    }
  }, [departmentFilter, isDoctorRole, selectedDoctorId, slug, viewMode, weekStart]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filteredDoctors = useMemo(() => {
    const q = search.trim().toLowerCase();
    return doctors.filter((doctor) => {
      if (viewMode === "single" && selectedDoctorId && doctor.doctorId !== selectedDoctorId) return false;
      if (departmentFilter !== "all" && doctor.department?.id !== departmentFilter) return false;
      if (!q) return true;
      return (
        doctor.doctorName.toLowerCase().includes(q) ||
        (doctor.specialty?.toLowerCase().includes(q) ?? false) ||
        (doctor.department?.name.toLowerCase().includes(q) ?? false) ||
        doctor.occurrences.some((occurrence) => occurrence.patientName?.toLowerCase().includes(q))
      );
    });
  }, [departmentFilter, doctors, search, selectedDoctorId, viewMode]);

  useEffect(() => {
    if (viewMode === "all" || !selectedDoctorId) return;
    const selectedDoctorStillVisible = doctorOptions.some((doctor) => doctor.doctorId === selectedDoctorId);
    if (!selectedDoctorStillVisible) setSelectedDoctorId("");
  }, [doctorOptions, selectedDoctorId, viewMode]);

  const visibleDoctors = filteredDoctors;
  const todayKey = formatDate(getToday());
  const isCurrentWeek = weekStart === todayKey;

  const applyOccurrenceFilters = (occurrences: Occurrence[]) =>
    occurrences.filter((occurrence) => {
      const expired = isExpired(occurrence.date, occurrence.startTime);
      const booked = Boolean(occurrence.bookingId);
      const matchesMode = modeFilter === "all" || occurrence.mode === modeFilter;
      const matchesSlot =
        slotFilter === "all" ||
        (slotFilter === "available" && !booked && !expired) ||
        (slotFilter === "booked" && booked) ||
        (slotFilter === "expired" && !booked && expired);
      return matchesMode && matchesSlot;
    });

  const goToToday = () => setWeekStart(todayKey);
  const goToPreviousWeek = () => setWeekStart(formatDate(addDays(new Date(`${weekStart}T00:00:00`), -7)));
  const goToNextWeek = () => setWeekStart(formatDate(addDays(new Date(`${weekStart}T00:00:00`), 7)));

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[#0f1e38]">{isDoctorRole ? "My Schedule" : "Doctor Schedules"}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isDoctorRole ? "Your weekly appointment slots and booked patients." : "Same slot calendar patients see, with receptionist booking context."}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 h-9 rounded-xl text-xs font-semibold transition-all"
          style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.1)", color: "#6b7a96" }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {!isDoctorRole && (
      <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3">
        <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_190px_240px_140px_140px]">
          <div className="flex items-center gap-2 h-9 rounded-lg px-3 bg-[#f7f4ef] border border-gray-100 min-w-0">
            <Search size={13} className="text-gray-400 flex-shrink-0" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search doctor or patient..."
              className="flex-1 min-w-0 text-sm outline-none bg-transparent text-[#0f1e38] placeholder-gray-400"
            />
          </div>
          <select
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
            className="h-9 rounded-lg px-3 text-xs font-semibold outline-none border border-gray-100 bg-white text-[#0f1e38] min-w-0"
          >
            <option value="all">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
          <select
            value={viewMode === "all" ? "all" : selectedDoctorId || doctorOptions[0]?.doctorId || "all"}
            onChange={(event) => {
              const next = event.target.value;
              if (next === "all") {
                setViewMode("all");
                setSelectedDoctorId("");
                return;
              }
              setViewMode("single");
              setSelectedDoctorId(next);
            }}
            className="h-9 rounded-lg px-3 text-xs font-semibold outline-none border border-gray-100 bg-white text-[#0f1e38] min-w-0"
          >
            <option value="all">All doctors</option>
            {doctorOptions.map((doctor) => (
              <option key={doctor.doctorId} value={doctor.doctorId}>
                {doctor.doctorName}{doctor.department ? ` - ${doctor.department.name}` : ""}
              </option>
            ))}
          </select>
          <select
            value={modeFilter}
            onChange={(event) => setModeFilter(event.target.value)}
            className="h-9 rounded-lg px-3 text-xs font-semibold outline-none border border-gray-100 bg-white text-[#0f1e38]"
          >
            <option value="all">All modes</option>
            <option value="PHYSICAL">Physical</option>
            <option value="ONLINE">Online</option>
          </select>
          <select
            value={slotFilter}
            onChange={(event) => setSlotFilter(event.target.value)}
            className="h-9 rounded-lg px-3 text-xs font-semibold outline-none border border-gray-100 bg-white text-[#0f1e38]"
          >
            <option value="all">All slots</option>
            <option value="available">Available</option>
            <option value="booked">Booked</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>
      )}

      {error && (
        <div className="p-3 rounded-xl text-sm font-semibold text-red-600 flex items-center gap-2" style={{ background: "#fef2f2", border: "1px solid rgba(220,38,38,.2)" }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-solid border-[#c8a96e] border-r-transparent" />
        </div>
      ) : doctors.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <Clock size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-400">No schedules configured</p>
        </div>
      ) : visibleDoctors.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <CalendarDays size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-400">No schedule matches these filters</p>
        </div>
      ) : (
        <div className="space-y-5">
          {visibleDoctors.map((doctor) => (
            <section key={doctor.doctorId} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div
                className="bg-[#142746] px-5 py-3 flex items-center justify-between flex-wrap gap-3 relative"
                style={{ boxShadow: "0 10px 22px rgba(15,30,56,.16)" }}
              >
                <div className="absolute inset-x-0 bottom-0 h-px bg-white/10" />
                <div>
                  <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#c8a96e]">Choose a time slot</p>
                  <h2 className="text-base font-extrabold text-white mt-0.5">{doctor.doctorName}</h2>
                  <p className="text-[11px] text-white/50 mt-0.5">
                    {doctor.department?.name ?? "Unassigned department"}{doctor.specialty ? ` - ${doctor.specialty}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={goToPreviousWeek}
                    disabled={isCurrentWeek}
                    className="h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1 disabled:opacity-40"
                    style={{ background: "rgba(255,255,255,.08)", color: "white", border: "1px solid rgba(255,255,255,.1)" }}
                  >
                    <ChevronLeft size={14} /> Prev
                  </button>
                  <button
                    onClick={goToToday}
                    className="h-8 px-4 rounded-lg text-xs font-bold"
                    style={{ background: "rgba(200,169,110,.14)", color: "#d8b975", border: "1px solid rgba(200,169,110,.35)" }}
                  >
                    {weekLabel(dates)}
                  </button>
                  <button
                    onClick={goToNextWeek}
                    className="h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1"
                    style={{ background: "rgba(255,255,255,.08)", color: "white", border: "1px solid rgba(255,255,255,.1)" }}
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              <div className="grid xl:grid-cols-7 border-b border-gray-100">
                {dates.map((date) => {
                  const occurrences = applyOccurrenceFilters(doctor.occurrences.filter((occurrence) => occurrence.date === date.date));
                  const isToday = date.date === todayKey;
                  return (
                    <div
                      key={`${doctor.doctorId}-${date.date}-head`}
                      className="px-4 py-3 border-r border-gray-100 last:border-r-0"
                      style={{ background: isToday ? "#142746" : "#fff" }}
                    >
                      <div className="flex items-end justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: isToday ? "#c8a96e" : "#9ca3af" }}>
                            {dayName(date.date)}
                          </p>
                          <p className="text-3xl font-extrabold leading-none mt-1" style={{ color: isToday ? "white" : "#0f1e38" }}>
                            {new Date(`${date.date}T00:00:00`).getDate()}
                          </p>
                        </div>
                        <div className="text-right">
                          {isToday && (
                            <span className="inline-flex px-2 py-1 rounded-full text-[10px] font-bold uppercase mb-1" style={{ background: "rgba(200,169,110,.2)", color: "#d8b975" }}>
                              Today
                            </span>
                          )}
                          <p className="text-xs font-semibold" style={{ color: isToday ? "rgba(255,255,255,.5)" : "#a8b1c2" }}>
                            {occurrences.length} slots
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid xl:grid-cols-7 min-h-[380px]">
                {dates.map((date) => {
                  const occurrences = applyOccurrenceFilters(doctor.occurrences.filter((occurrence) => occurrence.date === date.date))
                    .sort((a, b) => a.startTime.localeCompare(b.startTime));
                  const isToday = date.date === todayKey;

                  return (
                    <div
                      key={`${doctor.doctorId}-${date.date}-body`}
                      className="p-3 border-r border-gray-100 last:border-r-0 min-h-[300px]"
                      style={{ background: isToday ? "rgba(200,169,110,.04)" : "#fcfbf8" }}
                    >
                      {occurrences.length === 0 ? (
                        <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-gray-300 text-xs font-semibold">
                          <span className="text-2xl opacity-40">-</span>
                          <span>No slots</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {occurrences.map((occurrence) => {
                            const expired = isExpired(occurrence.date, occurrence.startTime);
                            const booked = Boolean(occurrence.bookingId);
                            const status = occurrence.bookingStatus ? STATUS_STYLES[occurrence.bookingStatus] ?? STATUS_STYLES.CONFIRMED : null;
                            const availableStyle = occurrence.mode === "ONLINE"
                              ? { bg: "#fff", border: "rgba(200,169,110,.22)", color: "#a88b50" }
                              : { bg: "#fff", border: "rgba(16,185,129,.22)", color: "#059669" };

                            return (
                              <div
                                key={`${occurrence.windowId}-${occurrence.date}-${occurrence.startTime}-${occurrence.mode}`}
                                className="w-full rounded-xl border px-3 py-3 shadow-sm"
                                style={{
                                  background: booked ? status?.bg : expired ? "rgba(15,30,56,.03)" : availableStyle.bg,
                                  borderColor: booked ? status?.border : expired ? "rgba(15,30,56,.08)" : availableStyle.border,
                                  opacity: expired && !booked ? 0.5 : 1,
                                }}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-extrabold" style={{ color: booked ? status?.color : expired ? "#9ca3af" : availableStyle.color }}>
                                    {booked ? status?.label : expired ? "Expired" : formatMode(occurrence.mode)}
                                  </p>
                                  {booked && <span className="text-[10px] font-bold text-gray-400">{formatMode(occurrence.mode)}</span>}
                                </div>
                                <p
                                  className="text-base font-extrabold mt-1"
                                  style={{
                                    color: expired && !booked ? "#9ca3af" : "#0f1e38",
                                    textDecoration: expired && !booked ? "line-through" : "none",
                                  }}
                                >
                                  {occurrence.startTime} - {occurrence.endTime}
                                </p>
                                {booked && (
                                  <div className="mt-2 pt-2 border-t border-white/60">
                                    <p className="text-xs font-extrabold text-[#0f1e38] truncate">{occurrence.patientName}</p>
                                    <p className="text-[11px] text-gray-500 truncate">{occurrence.patientPhone ?? "No phone"}</p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
