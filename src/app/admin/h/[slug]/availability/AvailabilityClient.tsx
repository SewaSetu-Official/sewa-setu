"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarPlus,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Power,
  RefreshCw,
  Search,
  Save,
  X,
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

type WeeklySlot = {
  id: string;
  dayOfWeek: number;
  dayLabel: string;
  mode: string;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  isActive: boolean;
};

type DoctorGroup = {
  doctorId: string;
  doctorName: string;
  specialty: string | null;
  department: { id: string; name: string; sortOrder: number } | null;
  slots: WeeklySlot[];
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

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  return hour * 60 + minute;
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
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
  canManage,
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
  const [doctorName, setDoctorName] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => formatDate(getToday()));
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [viewMode, setViewMode] = useState<"single" | "all">("single");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [slotFilter, setSlotFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [slotActionLoading, setSlotActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [scheduleForm, setScheduleForm] = useState({
    doctorId: "",
    dayOfWeek: "1",
    mode: "PHYSICAL",
    startTime: "09:00",
    endTime: "13:00",
    slotDurationMinutes: "30",
  });
  const isDoctorRole = role === "DOCTOR";
  const selectedScheduleDoctor = doctorOptions.find((doctor) => doctor.doctorId === scheduleForm.doctorId);
  const schedulePreview = useMemo(() => {
    const dayLabel = DAY_LABELS[Number(scheduleForm.dayOfWeek)] ?? "Selected day";
    const startMinutes = timeToMinutes(scheduleForm.startTime);
    const endMinutes = timeToMinutes(scheduleForm.endTime);
    const duration = Number(scheduleForm.slotDurationMinutes);

    if (
      startMinutes === null ||
      endMinutes === null ||
      !Number.isInteger(duration) ||
      duration <= 0
    ) {
      return {
        isValid: false,
        dayLabel,
        slotCount: 0,
        summary: "Enter a valid start time, end time, and slot duration.",
        detail: "The preview will update as soon as the timing is valid.",
      };
    }

    if (startMinutes >= endMinutes) {
      return {
        isValid: false,
        dayLabel,
        slotCount: 0,
        summary: "End time must be after start time.",
        detail: `${scheduleForm.startTime} - ${scheduleForm.endTime} cannot generate bookable slots.`,
      };
    }

    const windowMinutes = endMinutes - startMinutes;
    const slotCount = Math.floor(windowMinutes / duration);
    const leftoverMinutes = windowMinutes % duration;

    if (slotCount < 1) {
      return {
        isValid: false,
        dayLabel,
        slotCount: 0,
        summary: `This window is shorter than ${formatDuration(duration)}.`,
        detail: "Make the window longer or reduce the slot duration.",
      };
    }

    return {
      isValid: true,
      dayLabel,
      slotCount,
      summary: `Creates ${slotCount} bookable slot${slotCount === 1 ? "" : "s"} every ${dayLabel}.`,
      detail: leftoverMinutes > 0
        ? `${formatDuration(leftoverMinutes)} at the end will not be bookable because it is shorter than one slot.`
        : `Patients will see ${formatDuration(duration)} appointments from ${scheduleForm.startTime} to ${scheduleForm.endTime}.`,
    };
  }, [scheduleForm.dayOfWeek, scheduleForm.endTime, scheduleForm.slotDurationMinutes, scheduleForm.startTime]);

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
      setDoctorName(typeof data.doctorName === "string" ? data.doctorName : null);
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
    const timeoutId = window.setTimeout(() => {
      void fetchData();
    }, 0);

    return () => window.clearTimeout(timeoutId);
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
    if (!selectedDoctorStillVisible) {
      const timeoutId = window.setTimeout(() => setSelectedDoctorId(""), 0);
      return () => window.clearTimeout(timeoutId);
    }
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
  const closeScheduleModal = () => {
    setScheduleModalOpen(false);
    setEditingSlotId(null);
  };
  const openCreateSchedule = (doctorId?: string) => {
    setEditingSlotId(null);
    setScheduleForm((form) => ({
      ...form,
      doctorId: doctorId || selectedDoctorId || form.doctorId || doctorOptions[0]?.doctorId || "",
    }));
    setScheduleModalOpen(true);
  };
  const openEditSchedule = (doctorId: string, slot: WeeklySlot) => {
    setEditingSlotId(slot.id);
    setScheduleForm({
      doctorId,
      dayOfWeek: String(slot.dayOfWeek),
      mode: slot.mode,
      startTime: slot.startTime,
      endTime: slot.endTime,
      slotDurationMinutes: String(slot.slotDurationMinutes),
    });
    setScheduleModalOpen(true);
  };

  useEffect(() => {
    if (scheduleForm.doctorId || doctorOptions.length === 0) return;
    const timeoutId = window.setTimeout(() => {
      setScheduleForm((form) => ({ ...form, doctorId: doctorOptions[0].doctorId }));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [doctorOptions, scheduleForm.doctorId]);

  const handleSaveSchedule = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingSchedule(true);
    setError("");
    try {
      const isEditing = Boolean(editingSlotId);
      const res = await fetch(`/api/admin/h/${slug}/availability`, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEditing ? { slotId: editingSlotId } : {}),
          ...scheduleForm,
          dayOfWeek: Number(scheduleForm.dayOfWeek),
          slotDurationMinutes: Number(scheduleForm.slotDurationMinutes),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? (isEditing ? "Failed to update schedule." : "Failed to create schedule."));
        return;
      }
      closeScheduleModal();
      setManageModalOpen(false);
      await fetchData();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleToggleSlot = async (slot: WeeklySlot) => {
    setSlotActionLoading(slot.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/h/${slug}/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId: slot.id, isActive: !slot.isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update schedule status.");
        return;
      }
      await fetchData();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSlotActionLoading(null);
    }
  };

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[#0f1e38]">{isDoctorRole ? "My Schedule" : "Doctor Schedules"}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isDoctorRole
              ? doctorName
                ? `${doctorName}'s weekly appointment slots and booked patients.`
                : "Your hospital account is not linked to a doctor profile yet."
              : "Same slot calendar patients see, with receptionist booking context."}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 h-9 rounded-xl text-xs font-semibold transition-all"
          style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.1)", color: "#6b7a96" }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
        {canManage && !isDoctorRole && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setManageModalOpen(true)}
              className="flex items-center gap-2 px-3 h-9 rounded-xl text-xs font-bold transition-all"
              style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.1)", color: "#0f1e38" }}
            >
              <Clock size={13} /> Manage windows
            </button>
            <button
              onClick={() => openCreateSchedule()}
              className="flex items-center gap-2 px-3 h-9 rounded-xl text-xs font-bold transition-all"
              style={{ background: "linear-gradient(135deg,#0f1e38,#1a3059)", color: "#c8a96e" }}
            >
              <CalendarPlus size={13} /> New schedule
            </button>
          </div>
        )}
      </div>

      {!isDoctorRole && (
      <div className="admin-control-panel">
        <div className="admin-control-row">
          <div className="admin-search-control">
            <Search size={14} className="admin-search-icon" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search doctor or patient..."
              className="admin-search-input"
            />
          </div>
          <select
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
            className="admin-select-control min-w-0"
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
            className="admin-select-control min-w-0"
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
            className="admin-select-control"
          >
            <option value="all">All modes</option>
            <option value="PHYSICAL">Physical</option>
            <option value="ONLINE">Online</option>
          </select>
          <select
            value={slotFilter}
            onChange={(event) => setSlotFilter(event.target.value)}
            className="admin-select-control"
          >
            <option value="all">All slots</option>
            <option value="available">Available</option>
            <option value="booked">Booked</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>
      )}

      {scheduleModalOpen && canManage && !isDoctorRole && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close schedule dialog"
            onClick={closeScheduleModal}
            className="absolute inset-0 bg-[#0f1e38]/65"
          />
          <form
            onSubmit={handleSaveSchedule}
            className="relative z-10 w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-white/70 overflow-hidden"
          >
            <div className="flex items-start justify-between gap-4 px-5 py-4" style={{ background: "#142746" }}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(200,169,110,.15)", color: "#d8b975" }}>
                  <CalendarPlus size={18} />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-white">{editingSlotId ? "Edit Schedule Window" : "Create Schedule Window"}</h2>
                  <p className="text-xs text-white/45 mt-0.5">
                    {editingSlotId ? "Adjust this recurring weekly booking window" : "Recurring weekly availability for patient booking"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeScheduleModal}
                className="h-8 w-8 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.7)" }}
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-1.5">Doctor</label>
                <select
                  value={scheduleForm.doctorId}
                  onChange={(event) => setScheduleForm((form) => ({ ...form, doctorId: event.target.value }))}
                  required
                  disabled={Boolean(editingSlotId)}
                  className="w-full h-11 rounded-xl px-3 text-sm font-semibold outline-none border border-gray-100 bg-[#f7f4ef] text-[#0f1e38] disabled:opacity-70"
                >
                  <option value="">Select doctor</option>
                  {doctorOptions.map((doctor) => (
                    <option key={doctor.doctorId} value={doctor.doctorId}>
                      {doctor.doctorName}{doctor.department ? ` - ${doctor.department.name}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-1.5">Day</label>
                  <select
                    value={scheduleForm.dayOfWeek}
                    onChange={(event) => setScheduleForm((form) => ({ ...form, dayOfWeek: event.target.value }))}
                    className="w-full h-11 rounded-xl px-3 text-sm font-semibold outline-none border border-gray-100 bg-white text-[#0f1e38]"
                  >
                    {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, index) => (
                      <option key={day} value={index}>{day}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-1.5">Mode</label>
                  <select
                    value={scheduleForm.mode}
                    onChange={(event) => setScheduleForm((form) => ({ ...form, mode: event.target.value }))}
                    className="w-full h-11 rounded-xl px-3 text-sm font-semibold outline-none border border-gray-100 bg-white text-[#0f1e38]"
                  >
                    <option value="PHYSICAL">Physical</option>
                    <option value="ONLINE">Online</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-1.5">Start</label>
                  <input
                    type="time"
                    value={scheduleForm.startTime}
                    onChange={(event) => setScheduleForm((form) => ({ ...form, startTime: event.target.value }))}
                    className="w-full h-11 rounded-xl px-3 text-sm font-semibold outline-none border border-gray-100 bg-white text-[#0f1e38]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-1.5">End</label>
                  <input
                    type="time"
                    value={scheduleForm.endTime}
                    onChange={(event) => setScheduleForm((form) => ({ ...form, endTime: event.target.value }))}
                    className="w-full h-11 rounded-xl px-3 text-sm font-semibold outline-none border border-gray-100 bg-white text-[#0f1e38]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-1.5">Slots</label>
                  <select
                    value={scheduleForm.slotDurationMinutes}
                    onChange={(event) => setScheduleForm((form) => ({ ...form, slotDurationMinutes: event.target.value }))}
                    className="w-full h-11 rounded-xl px-3 text-sm font-semibold outline-none border border-gray-100 bg-white text-[#0f1e38]"
                  >
                    {[10, 15, 20, 30, 45, 60].map((minutes) => (
                      <option key={minutes} value={minutes}>{minutes} min</option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                className="rounded-2xl border px-4 py-3"
                style={{
                  background: schedulePreview.isValid ? "rgba(16,185,129,.07)" : "rgba(239,68,68,.06)",
                  borderColor: schedulePreview.isValid ? "rgba(16,185,129,.22)" : "rgba(239,68,68,.18)",
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p
                      className="text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: schedulePreview.isValid ? "#047857" : "#dc2626" }}
                    >
                      Preview
                    </p>
                    <p className="mt-1 text-sm font-extrabold text-[#0f1e38]">
                      {schedulePreview.summary}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-gray-500">
                      {selectedScheduleDoctor?.doctorName ?? "Selected doctor"} / {formatMode(scheduleForm.mode)} / {scheduleForm.startTime} - {scheduleForm.endTime}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {schedulePreview.detail}
                    </p>
                  </div>
                  <div
                    className="flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center rounded-2xl"
                    style={{
                      background: schedulePreview.isValid ? "#fff" : "rgba(255,255,255,.7)",
                      border: "1px solid rgba(15,30,56,.08)",
                    }}
                  >
                    <span className="text-xl font-extrabold text-[#0f1e38]">{schedulePreview.slotCount}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">slots</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-[#fcfbf8]">
              <button
                type="button"
                onClick={closeScheduleModal}
                className="h-10 rounded-xl px-4 text-xs font-bold"
                style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.1)", color: "#6b7a96" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingSchedule || !scheduleForm.doctorId || !schedulePreview.isValid}
                className="h-10 rounded-xl px-4 text-xs font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg,#0f1e38,#1a3059)", color: "#c8a96e" }}
              >
                <Save size={13} />
                {savingSchedule ? "Saving" : editingSlotId ? "Save changes" : "Create schedule"}
              </button>
            </div>
          </form>
        </div>
      )}

      {manageModalOpen && canManage && !isDoctorRole && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close recurring schedule manager"
            onClick={() => setManageModalOpen(false)}
            className="absolute inset-0 bg-[#0f1e38]/55"
          />
          <div className="relative z-10 w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-white/70 overflow-hidden">
            <div className="flex items-start justify-between gap-4 px-5 py-4" style={{ background: "#142746" }}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(200,169,110,.15)", color: "#d8b975" }}>
                  <Clock size={18} />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-white">Manage Schedule Windows</h2>
                  <p className="text-xs text-white/45 mt-0.5">Recurring weekly windows that generate the visible calendar slots</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setManageModalOpen(false)}
                className="h-8 w-8 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.7)" }}
              >
                <X size={15} />
              </button>
            </div>

            <div className="max-h-[68vh] overflow-y-auto p-5 space-y-4 bg-[#fcfbf8]">
              {visibleDoctors.every((doctor) => doctor.slots.length === 0) ? (
                <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
                  <Clock size={24} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-gray-400">No recurring windows found</p>
                </div>
              ) : (
                visibleDoctors
                  .filter((doctor) => doctor.slots.length > 0)
                  .map((doctor) => (
                    <div key={doctor.doctorId} className="bg-white rounded-2xl border border-gray-100 p-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                        <div>
                          <p className="text-sm font-extrabold text-[#0f1e38]">{doctor.doctorName}</p>
                          <p className="text-xs font-semibold text-gray-400">
                            {doctor.department?.name ?? "Unassigned department"}{doctor.specialty ? ` - ${doctor.specialty}` : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openCreateSchedule(doctor.doctorId)}
                          className="h-8 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5"
                          style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.1)", color: "#0f1e38" }}
                        >
                          <CalendarPlus size={13} /> Add window
                        </button>
                      </div>

                      <div className="grid gap-2 md:grid-cols-2">
                        {[...doctor.slots]
                          .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
                          .map((slot) => (
                            <div
                              key={slot.id}
                              className="rounded-xl border bg-white px-3 py-3"
                              style={{
                                borderColor: slot.isActive ? "rgba(15,30,56,.09)" : "rgba(239,68,68,.16)",
                                opacity: slot.isActive ? 1 : 0.72,
                              }}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-extrabold text-[#0f1e38]">{slot.dayLabel}</p>
                                    <span
                                      className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                      style={{
                                        background: slot.mode === "ONLINE" ? "rgba(200,169,110,.13)" : "rgba(16,185,129,.1)",
                                        color: slot.mode === "ONLINE" ? "#9a762d" : "#047857",
                                      }}
                                    >
                                      {formatMode(slot.mode)}
                                    </span>
                                    {!slot.isActive && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600">
                                        Inactive
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs font-bold text-gray-500 mt-1">
                                    {slot.startTime} - {slot.endTime} / {slot.slotDurationMinutes} min
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    title="Edit schedule window"
                                    onClick={() => openEditSchedule(doctor.doctorId, slot)}
                                    className="h-8 w-8 rounded-lg inline-flex items-center justify-center"
                                    style={{ background: "#f7f4ef", color: "#0f1e38" }}
                                  >
                                    <Pencil size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    title={slot.isActive ? "Deactivate schedule window" : "Activate schedule window"}
                                    disabled={slotActionLoading === slot.id}
                                    onClick={() => handleToggleSlot(slot)}
                                    className="h-8 w-8 rounded-lg inline-flex items-center justify-center disabled:opacity-50"
                                    style={{
                                      background: slot.isActive ? "rgba(239,68,68,.08)" : "rgba(16,185,129,.1)",
                                      color: slot.isActive ? "#dc2626" : "#047857",
                                    }}
                                  >
                                    <Power size={13} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))
              )}
            </div>
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
          <p className="text-sm font-semibold text-gray-400">
            {isDoctorRole && !doctorName ? "No doctor profile linked" : "No schedules configured"}
          </p>
          {isDoctorRole && !doctorName && (
            <p className="mx-auto mt-2 max-w-md text-xs font-semibold text-gray-300">
              Ask an owner or manager to connect this user account to the correct doctor profile.
            </p>
          )}
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
