"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardList,
  Database,
  Edit3,
  FileText,
  ImageIcon,
  Inbox,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";

type OnboardingStatus =
  | "NEW"
  | "MEETING_DONE"
  | "DATA_REQUESTED"
  | "DATA_RECEIVED"
  | "DATA_ENTRY_IN_PROGRESS"
  | "WAITING_FOR_HOSPITAL_CONFIRMATION"
  | "READY_TO_PUBLISH"
  | "PUBLISHED"
  | "NEEDS_UPDATE"
  | "CANCELLED";

type StaffUser = {
  id: string;
  fullName: string;
  email: string;
  role: "PLATFORM_ADMIN" | "PLATFORM_SUPPORT" | "USER";
};

type Inquiry = {
  id: string;
  hospitalName: string;
  type: "HOSPITAL" | "CLINIC" | "LAB";
  contactName: string;
  email: string;
  city: string;
};

type ChecklistItem = {
  id: string;
  title: string;
  description: string | null;
  isRequired: boolean;
  isCompleted: boolean;
  completedAt: string | null;
};

type Note = {
  id: string;
  title: string | null;
  body: string;
  createdAt: string;
  author: { fullName: string };
};

type ImportBatch = {
  id: string;
  type: string;
  status: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
  createdAt: string;
};

type Onboarding = {
  id: string;
  status: OnboardingStatus;
  internalNotes: string | null;
  meetingDate: string | null;
  meetingNotes: string | null;
  hospitalConfirmationNotes: string | null;
  updatedAt: string;
  createdAt: string;
  hospital: {
    id: string;
    slug: string;
    name: string;
    type: "HOSPITAL" | "CLINIC" | "LAB";
    verified: boolean;
    isActive: boolean;
    phone: string | null;
    email: string | null;
    website: string | null;
    openingHours: string | null;
    emergencyAvailable: boolean;
    servicesSummary: string | null;
    departments: { id: string; name: string; overview: string | null; sortOrder: number }[];
    doctors: {
      doctor: {
        id: string;
        fullName: string;
        licenseNumber: string | null;
        experienceYears: number | null;
        feeMin: number | null;
        feeMax: number | null;
        currency: string | null;
        departments: { departmentId: string }[];
      };
      positionTitle: string | null;
    }[];
    availabilitySlots: {
      id: string;
      doctorId: string;
      dayOfWeek: number;
      mode: "ONLINE" | "PHYSICAL";
      startTime: string;
      endTime: string;
      slotDurationMinutes: number;
      doctor: { fullName: string };
    }[];
    packages: { id: string; title: string; description: string | null; price: number | null; currency: string | null }[];
    media: { id: string; url: string; altText: string | null; isPrimary: boolean }[];
    memberships: { id: string; user: { id: string; fullName: string; email: string } }[];
  } | null;
  partnerInquiry: {
    id: string;
    hospitalName: string;
    type: "HOSPITAL" | "CLINIC" | "LAB";
    contactName: string;
    email: string;
    phone: string;
    city: string;
    status: string;
  } | null;
  assignedTo: StaffUser | null;
  createdBy: { fullName: string };
  checklist: ChecklistItem[];
  notes: Note[];
  imports: ImportBatch[];
  _count: { files: number; imports: number; notes: number };
};

type ApiData = {
  onboardings: Onboarding[];
  total: number;
  page: number;
  hasMore: boolean;
  canManage: boolean;
  supportUsers: StaffUser[];
  inquiries: Inquiry[];
  statusCounts: { status: OnboardingStatus; count: number }[];
};

type DataEntryStep = "profile" | "department" | "doctor" | "schedule" | "package" | "media" | "owner";

const STATUSES: { value: OnboardingStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "NEW", label: "New" },
  { value: "MEETING_DONE", label: "Meeting done" },
  { value: "DATA_REQUESTED", label: "Data requested" },
  { value: "DATA_RECEIVED", label: "Data received" },
  { value: "DATA_ENTRY_IN_PROGRESS", label: "Data entry" },
  { value: "WAITING_FOR_HOSPITAL_CONFIRMATION", label: "Waiting confirm" },
  { value: "READY_TO_PUBLISH", label: "Ready" },
  { value: "PUBLISHED", label: "Published" },
  { value: "NEEDS_UPDATE", label: "Needs update" },
  { value: "CANCELLED", label: "Cancelled" },
];

const STATUS_STYLE: Record<OnboardingStatus, { bg: string; color: string; dot: string; label: string }> = {
  NEW: { bg: "rgba(99,102,241,.1)", color: "#4338ca", dot: "#6366f1", label: "New" },
  MEETING_DONE: { bg: "rgba(14,165,233,.1)", color: "#0369a1", dot: "#0ea5e9", label: "Meeting done" },
  DATA_REQUESTED: { bg: "rgba(245,158,11,.12)", color: "#b45309", dot: "#f59e0b", label: "Data requested" },
  DATA_RECEIVED: { bg: "rgba(20,184,166,.1)", color: "#0f766e", dot: "#14b8a6", label: "Data received" },
  DATA_ENTRY_IN_PROGRESS: { bg: "rgba(200,169,110,.16)", color: "#8a6f37", dot: "#c8a96e", label: "Data entry" },
  WAITING_FOR_HOSPITAL_CONFIRMATION: { bg: "rgba(168,85,247,.1)", color: "#7e22ce", dot: "#a855f7", label: "Waiting confirm" },
  READY_TO_PUBLISH: { bg: "rgba(34,197,94,.12)", color: "#15803d", dot: "#22c55e", label: "Ready" },
  PUBLISHED: { bg: "rgba(16,185,129,.12)", color: "#047857", dot: "#10b981", label: "Published" },
  NEEDS_UPDATE: { bg: "rgba(249,115,22,.1)", color: "#c2410c", dot: "#f97316", label: "Needs update" },
  CANCELLED: { bg: "rgba(239,68,68,.08)", color: "#b91c1c", dot: "#ef4444", label: "Cancelled" },
};

const TYPE_LABELS: Record<string, string> = {
  HOSPITAL: "Hospital",
  CLINIC: "Clinic",
  LAB: "Laboratory",
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DATA_STEPS: {
  id: DataEntryStep;
  label: string;
  helper: string;
  match: string;
  icon: React.ReactNode;
}[] = [
  { id: "profile", label: "Profile", helper: "Contact and service basics", match: "Hospital basic info added", icon: <Building2 size={14} /> },
  { id: "department", label: "Departments", helper: "Hospital units and ordering", match: "Departments added", icon: <ClipboardList size={14} /> },
  { id: "doctor", label: "Doctors", helper: "Roster, fees and department", match: "Doctors added", icon: <UserRound size={14} /> },
  { id: "schedule", label: "Schedules", helper: "Weekly consultation windows", match: "Schedules configured", icon: <CalendarDays size={14} /> },
  { id: "package", label: "Packages", helper: "Health packages and prices", match: "Packages configured", icon: <FileText size={14} /> },
  { id: "media", label: "Media", helper: "Logo and public photos", match: "Hospital media added", icon: <ImageIcon size={14} /> },
  { id: "owner", label: "Owner", helper: "Assign the hospital owner only", match: "Owner account linked", icon: <UserRound size={14} /> },
];

function formatDate(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: OnboardingStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: style.bg, color: style.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: style.dot }} />
      {style.label}
    </span>
  );
}

function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-[#0f1e38]">{completed}/{total} required</span>
        <span className="text-[11px] font-bold text-[#8a9ab5]">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#edf0f4]">
        <div className="h-full rounded-full bg-[#c8a96e]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function PlatformOnboardingPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [checklistDrafts, setChecklistDrafts] = useState<Record<string, string>>({});
  const [internalDrafts, setInternalDrafts] = useState<Record<string, string>>({});
  const [profileDrafts, setProfileDrafts] = useState<Record<string, {
    phone: string;
    email: string;
    website: string;
    openingHours: string;
    servicesSummary: string;
    emergencyAvailable: boolean;
  }>>({});
  const [departmentDrafts, setDepartmentDrafts] = useState<Record<string, { name: string; overview: string }>>({});
  const [doctorDrafts, setDoctorDrafts] = useState<Record<string, {
    fullName: string;
    departmentId: string;
    positionTitle: string;
    licenseNumber: string;
    experienceYears: string;
    feeMin: string;
    feeMax: string;
  }>>({});
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, {
    doctorId: string;
    dayOfWeek: string;
    mode: "PHYSICAL" | "ONLINE";
    startTime: string;
    endTime: string;
    slotDurationMinutes: string;
  }>>({});
  const [packageDrafts, setPackageDrafts] = useState<Record<string, { title: string; description: string; price: string }>>({});
  const [mediaDrafts, setMediaDrafts] = useState<Record<string, { url: string; altText: string; isPrimary: boolean }>>({});
  const [activeDataSteps, setActiveDataSteps] = useState<Record<string, DataEntryStep>>({});
  const [editTargets, setEditTargets] = useState<Record<string, string | null>>({});
  const [ownerDrafts, setOwnerDrafts] = useState<Record<string, string>>({});
  const [newCase, setNewCase] = useState({ partnerInquiryId: "", assignedToUserId: "", internalNotes: "" });
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOnboardings = useCallback(async (q = search, s = status, p = page) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(p), status: s });
      if (q) params.set("search", q);
      const res = await fetch(`/api/admin/platform/onboarding?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load onboarding cases");
      setData(json);
      setInternalDrafts((prev) => {
        const next = { ...prev };
        for (const item of json.onboardings as Onboarding[]) {
          if (next[item.id] === undefined) next[item.id] = item.internalNotes ?? "";
        }
        return next;
      });
      setProfileDrafts((prev) => {
        const next = { ...prev };
        for (const item of json.onboardings as Onboarding[]) {
          if (!item.hospital || next[item.id] !== undefined) continue;
          next[item.id] = {
            phone: item.hospital.phone ?? "",
            email: item.hospital.email ?? "",
            website: item.hospital.website ?? "",
            openingHours: item.hospital.openingHours ?? "",
            servicesSummary: item.hospital.servicesSummary ?? "",
            emergencyAvailable: item.hospital.emergencyAvailable,
          };
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load onboarding cases.");
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchOnboardings(search, status, page);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchOnboardings, page, search, status]);

  const counts = useMemo(() => {
    const map = new Map<OnboardingStatus, number>();
    for (const item of data?.statusCounts ?? []) map.set(item.status, item.count);
    return map;
  }, [data]);

  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 350);
  };

  const runPatch = async (key: string, body: Record<string, unknown>) => {
    setActionLoading(key);
    setError("");
    try {
      const res = await fetch("/api/admin/platform/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Action failed");
      await fetchOnboardings(search, status, page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActionLoading(null);
    }
  };

  const createCase = async () => {
    if (!newCase.partnerInquiryId) {
      setError("Select a partner inquiry first.");
      return;
    }
    setActionLoading("create-case");
    setError("");
    try {
      const res = await fetch("/api/admin/platform/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerInquiryId: newCase.partnerInquiryId,
          assignedToUserId: newCase.assignedToUserId || null,
          internalNotes: newCase.internalNotes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not create onboarding case");
      setNewCase({ partnerInquiryId: "", assignedToUserId: "", internalNotes: "" });
      await fetchOnboardings(search, status, page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create onboarding case.");
    } finally {
      setActionLoading(null);
    }
  };

  const addDepartment = async (item: Onboarding) => {
    const draft = departmentDrafts[item.id] ?? { name: "", overview: "" };
    const editId = editTargets[`${item.id}:department`];
    await runPatch(`${item.id}-department`, {
      action: editId ? "UPDATE_DEPARTMENT" : "ADD_DEPARTMENT",
      onboardingId: item.id,
      entityId: editId || undefined,
      name: draft.name,
      overview: draft.overview,
    });
    setDepartmentDrafts((prev) => ({ ...prev, [item.id]: { name: "", overview: "" } }));
    setEditTargets((prev) => ({ ...prev, [`${item.id}:department`]: null }));
  };

  const addDoctor = async (item: Onboarding) => {
    const draft = doctorDrafts[item.id] ?? {
      fullName: "",
      departmentId: "",
      positionTitle: "",
      licenseNumber: "",
      experienceYears: "",
      feeMin: "",
      feeMax: "",
    };
    const editId = editTargets[`${item.id}:doctor`];
    await runPatch(`${item.id}-doctor`, {
      action: editId ? "UPDATE_DOCTOR" : "ADD_DOCTOR",
      onboardingId: item.id,
      entityId: editId || undefined,
      fullName: draft.fullName,
      departmentId: draft.departmentId || null,
      positionTitle: draft.positionTitle || null,
      licenseNumber: draft.licenseNumber || null,
      experienceYears: draft.experienceYears ? Number(draft.experienceYears) : null,
      feeMin: draft.feeMin ? Number(draft.feeMin) : null,
      feeMax: draft.feeMax ? Number(draft.feeMax) : null,
      currency: "NPR",
    });
    setDoctorDrafts((prev) => ({
      ...prev,
      [item.id]: { fullName: "", departmentId: "", positionTitle: "", licenseNumber: "", experienceYears: "", feeMin: "", feeMax: "" },
    }));
    setEditTargets((prev) => ({ ...prev, [`${item.id}:doctor`]: null }));
  };

  const addSchedule = async (item: Onboarding) => {
    const draft = scheduleDrafts[item.id] ?? {
      doctorId: "",
      dayOfWeek: "1",
      mode: "PHYSICAL",
      startTime: "09:00",
      endTime: "12:00",
      slotDurationMinutes: "30",
    };
    const editId = editTargets[`${item.id}:schedule`];
    await runPatch(`${item.id}-schedule`, {
      action: editId ? "UPDATE_SCHEDULE" : "ADD_SCHEDULE",
      onboardingId: item.id,
      entityId: editId || undefined,
      doctorId: draft.doctorId,
      dayOfWeek: Number(draft.dayOfWeek),
      mode: draft.mode,
      startTime: draft.startTime,
      endTime: draft.endTime,
      slotDurationMinutes: Number(draft.slotDurationMinutes),
    });
    setEditTargets((prev) => ({ ...prev, [`${item.id}:schedule`]: null }));
  };

  const addPackage = async (item: Onboarding) => {
    const draft = packageDrafts[item.id] ?? { title: "", description: "", price: "" };
    const editId = editTargets[`${item.id}:package`];
    await runPatch(`${item.id}-package`, {
      action: editId ? "UPDATE_PACKAGE" : "ADD_PACKAGE",
      onboardingId: item.id,
      entityId: editId || undefined,
      title: draft.title,
      description: draft.description,
      price: draft.price ? Number(draft.price) : null,
      currency: "NPR",
    });
    setPackageDrafts((prev) => ({ ...prev, [item.id]: { title: "", description: "", price: "" } }));
    setEditTargets((prev) => ({ ...prev, [`${item.id}:package`]: null }));
  };

  const addMedia = async (item: Onboarding) => {
    const draft = mediaDrafts[item.id] ?? { url: "", altText: "", isPrimary: item.hospital?.media.length === 0 };
    const editId = editTargets[`${item.id}:media`];
    await runPatch(`${item.id}-media`, {
      action: editId ? "UPDATE_MEDIA" : "ADD_MEDIA",
      onboardingId: item.id,
      entityId: editId || undefined,
      url: draft.url,
      altText: draft.altText || null,
      isPrimary: draft.isPrimary,
    });
    setMediaDrafts((prev) => ({ ...prev, [item.id]: { url: "", altText: "", isPrimary: false } }));
    setEditTargets((prev) => ({ ...prev, [`${item.id}:media`]: null }));
  };

  const assignOwner = async (item: Onboarding) => {
    await runPatch(`${item.id}-owner`, {
      action: "ASSIGN_OWNER",
      onboardingId: item.id,
      ownerEmail: ownerDrafts[item.id] ?? "",
    });
    setOwnerDrafts((prev) => ({ ...prev, [item.id]: "" }));
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#0f1e38]">Hospital Onboarding</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            {data?.total ?? 0} real hospital setup case{(data?.total ?? 0) === 1 ? "" : "s"}
          </p>
        </div>
        <button
          onClick={() => fetchOnboardings()}
          className="flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition-all"
          style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.1)", color: "#6b7a96" }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Data entry", value: counts.get("DATA_ENTRY_IN_PROGRESS") ?? 0, icon: <Database size={15} /> },
          { label: "Waiting confirm", value: counts.get("WAITING_FOR_HOSPITAL_CONFIRMATION") ?? 0, icon: <CalendarDays size={15} /> },
          { label: "Ready", value: counts.get("READY_TO_PUBLISH") ?? 0, icon: <CheckCircle2 size={15} /> },
          { label: "Published", value: counts.get("PUBLISHED") ?? 0, icon: <Rocket size={15} /> },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{card.label}</p>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f7f4ef] text-[#c8a96e]">
                {card.icon}
              </span>
            </div>
            <p className="mt-2 text-2xl font-extrabold text-[#0f1e38]">{card.value}</p>
          </div>
        ))}
      </div>

      {data?.canManage && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardList size={16} className="text-[#c8a96e]" />
            <p className="text-sm font-extrabold text-[#0f1e38]">Create Onboarding Case</p>
          </div>
          <div className="grid gap-2.5 lg:grid-cols-[1.4fr_1fr_1.4fr_auto]">
            <select
              value={newCase.partnerInquiryId}
              onChange={(e) => setNewCase((prev) => ({ ...prev, partnerInquiryId: e.target.value }))}
              className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold text-[#0f1e38] outline-none"
            >
              <option value="">Select partner inquiry</option>
              {data.inquiries.map((inquiry) => (
                <option key={inquiry.id} value={inquiry.id}>
                  {inquiry.hospitalName} - {inquiry.city}
                </option>
              ))}
            </select>
            <select
              value={newCase.assignedToUserId}
              onChange={(e) => setNewCase((prev) => ({ ...prev, assignedToUserId: e.target.value }))}
              className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold text-[#0f1e38] outline-none"
            >
              <option value="">Unassigned</option>
              {data.supportUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName}
                </option>
              ))}
            </select>
            <input
              value={newCase.internalNotes}
              onChange={(e) => setNewCase((prev) => ({ ...prev, internalNotes: e.target.value }))}
              placeholder="Internal note..."
              className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold text-[#0f1e38] outline-none placeholder:text-gray-400"
            />
            <button
              onClick={createCase}
              disabled={actionLoading === "create-case"}
              className="flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold text-white disabled:opacity-50"
              style={{ background: "#0f1e38" }}
            >
              <Plus size={13} /> {actionLoading === "create-case" ? "Creating..." : "Create"}
            </button>
          </div>
          {data.inquiries.length === 0 && (
            <p className="mt-2 text-xs font-semibold text-gray-400">No unlinked partner inquiries are waiting.</p>
          )}
        </div>
      )}

      <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4">
        <div className="grid gap-2.5 md:grid-cols-[1fr_auto]">
          <div className="flex h-10 items-center gap-2 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3">
            <Search size={13} className="flex-shrink-0 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Search hospital, contact, email, city..."
              className="flex-1 bg-transparent text-sm text-[#0f1e38] outline-none placeholder:text-gray-400"
            />
          </div>
          <p className="flex h-10 items-center rounded-xl bg-[#f7f4ef] px-3 text-xs font-semibold text-[#6b7a96]">
            Page {page}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((item) => (
            <button
              key={item.value}
              onClick={() => {
                setStatus(item.value);
                setPage(1);
              }}
              className="h-8 rounded-xl px-3 text-xs font-semibold transition-all"
              style={{
                background: status === item.value ? "#0f1e38" : "#fff",
                color: status === item.value ? "#c8a96e" : "#6b7a96",
                border: status === item.value ? "none" : "1.5px solid rgba(15,30,56,.09)",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl p-3 text-sm font-semibold text-red-600" style={{ background: "#fef2f2", border: "1px solid rgba(220,38,38,.2)" }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-56 items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-solid border-[#c8a96e] border-r-transparent" />
        </div>
      ) : !data || data.onboardings.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: "rgba(200,169,110,.1)" }}>
            <Inbox size={20} className="text-[#c8a96e]" />
          </div>
          <p className="text-sm font-semibold text-[#0f1e38]">No onboarding cases found</p>
          <p className="mt-1 text-xs text-gray-400">Create one from a partner inquiry when a hospital is ready for setup.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.onboardings.map((item) => {
            const isExpanded = expandedId === item.id;
            const name = item.hospital?.name ?? item.partnerInquiry?.hospitalName ?? "Untitled onboarding";
            const type = item.hospital?.type ?? item.partnerInquiry?.type ?? "HOSPITAL";
            const required = item.checklist.filter((check) => check.isRequired);
            const completed = required.filter((check) => check.isCompleted);
            const canPublish = data.canManage && item.hospital && item.status !== "PUBLISHED";
            const canCreateShell = data.canManage && !item.hospital && item.partnerInquiry;

            return (
              <div key={item.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
                <div className="grid gap-4 p-5 xl:grid-cols-[1.5fr_.8fr_.9fr_.9fr]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={item.status} />
                      <span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: "rgba(200,169,110,.12)", color: "#9a7c3f" }}>
                        {TYPE_LABELS[type]}
                      </span>
                      {item.hospital ? (
                        <span className="rounded-full px-2.5 py-1 text-[10px] font-bold text-emerald-700" style={{ background: "rgba(16,185,129,.1)" }}>
                          Shell linked
                        </span>
                      ) : (
                        <span className="rounded-full px-2.5 py-1 text-[10px] font-bold text-gray-500" style={{ background: "rgba(107,114,128,.09)" }}>
                          No shell
                        </span>
                      )}
                    </div>
                    <h2 className="mt-2 truncate text-lg font-extrabold text-[#0f1e38]">{name}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-gray-400">
                      <span className="flex items-center gap-1"><UserRound size={11} /> {item.partnerInquiry?.contactName ?? item.createdBy.fullName}</span>
                      {item.partnerInquiry?.email && <span>{item.partnerInquiry.email}</span>}
                      {item.partnerInquiry?.city && <span>{item.partnerInquiry.city}</span>}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-bold"
                        style={{ background: isExpanded ? "#0f1e38" : "#f7f4ef", color: isExpanded ? "#c8a96e" : "#0f1e38" }}
                      >
                        <ClipboardList size={12} /> {isExpanded ? "Close workspace" : "Open workspace"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Checklist</p>
                    <ProgressBar completed={completed.length} total={required.length} />
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-[#f7f4ef] px-2 py-2">
                        <p className="text-sm font-extrabold text-[#0f1e38]">{item._count.files}</p>
                        <p className="text-[10px] font-semibold text-gray-400">Files</p>
                      </div>
                      <div className="rounded-xl bg-[#f7f4ef] px-2 py-2">
                        <p className="text-sm font-extrabold text-[#0f1e38]">{item._count.imports}</p>
                        <p className="text-[10px] font-semibold text-gray-400">Imports</p>
                      </div>
                      <div className="rounded-xl bg-[#f7f4ef] px-2 py-2">
                        <p className="text-sm font-extrabold text-[#0f1e38]">{item._count.notes}</p>
                        <p className="text-[10px] font-semibold text-gray-400">Notes</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Owner</p>
                    <div className="rounded-xl bg-[#f7f4ef] p-3">
                      <p className="text-xs font-bold text-[#0f1e38]">{item.assignedTo?.fullName ?? "Unassigned"}</p>
                      <p className="mt-1 truncate text-[11px] text-gray-400">{item.assignedTo?.email ?? "Assign support/admin"}</p>
                    </div>
                    <p className="mt-2 text-[11px] font-semibold text-gray-400">Updated {formatDateTime(item.updatedAt)}</p>
                  </div>

                  <div className="space-y-2">
                    <select
                      value={item.status}
                      onChange={(e) => runPatch(`${item.id}-status`, { action: "UPDATE", onboardingId: item.id, status: e.target.value })}
                      disabled={!!actionLoading}
                      className="h-9 w-full rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-bold text-[#0f1e38] outline-none disabled:opacity-50"
                    >
                      {STATUSES.filter((option) => option.value !== "all").map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    {data.canManage && (
                      <select
                        value={item.assignedTo?.id ?? ""}
                        onChange={(e) => runPatch(`${item.id}-assign`, { action: "UPDATE", onboardingId: item.id, assignedToUserId: e.target.value || null })}
                        disabled={!!actionLoading}
                        className="h-9 w-full rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-bold text-[#0f1e38] outline-none disabled:opacity-50"
                      >
                        <option value="">Unassigned</option>
                        {data.supportUsers.map((user) => (
                          <option key={user.id} value={user.id}>{user.fullName}</option>
                        ))}
                      </select>
                    )}
                    {canCreateShell && (
                      <button
                        onClick={() => runPatch(`${item.id}-shell`, { action: "CREATE_HOSPITAL_SHELL", onboardingId: item.id })}
                        disabled={!!actionLoading}
                        className="flex h-9 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold text-white disabled:opacity-50"
                        style={{ background: "#0f1e38" }}
                      >
                        <Building2 size={13} /> Create shell
                      </button>
                    )}
                    {canPublish && (
                      <button
                        onClick={() => runPatch(`${item.id}-publish`, { action: "PUBLISH", onboardingId: item.id })}
                        disabled={!!actionLoading}
                        className="flex h-9 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold text-white disabled:opacity-50"
                        style={{ background: "#059669" }}
                      >
                        <Rocket size={13} /> Publish
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 bg-[#fcfbf8] p-5">
                    <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
                      <div className="space-y-4">
                        {item.hospital && (() => {
                          const profile = profileDrafts[item.id] ?? {
                            phone: item.hospital.phone ?? "",
                            email: item.hospital.email ?? "",
                            website: item.hospital.website ?? "",
                            openingHours: item.hospital.openingHours ?? "",
                            servicesSummary: item.hospital.servicesSummary ?? "",
                            emergencyAvailable: item.hospital.emergencyAvailable,
                          };
                          const department = departmentDrafts[item.id] ?? { name: "", overview: "" };
                          const doctor = doctorDrafts[item.id] ?? {
                            fullName: "",
                            departmentId: "",
                            positionTitle: "",
                            licenseNumber: "",
                            experienceYears: "",
                            feeMin: "",
                            feeMax: "",
                          };
                          const schedule = scheduleDrafts[item.id] ?? {
                            doctorId: item.hospital.doctors[0]?.doctor.id ?? "",
                            dayOfWeek: "1",
                            mode: "PHYSICAL" as const,
                            startTime: "09:00",
                            endTime: "12:00",
                            slotDurationMinutes: "30",
                          };
                          const packageDraft = packageDrafts[item.id] ?? { title: "", description: "", price: "" };
                          const mediaDraft = mediaDrafts[item.id] ?? { url: "", altText: "", isPrimary: item.hospital.media.length === 0 };
                          const activeStep = activeDataSteps[item.id] ?? "profile";
                          const activeMeta = DATA_STEPS.find((step) => step.id === activeStep) ?? DATA_STEPS[0];

                          return (
                            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
                              <div className="border-b border-gray-100 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-extrabold text-[#0f1e38]">Data Entry</p>
                                    <p className="mt-0.5 text-[11px] font-semibold text-gray-400">One setup step at a time. Saved data goes directly into the live hospital tables.</p>
                                  </div>
                                  <div className="rounded-xl bg-[#f7f4ef] px-3 py-2 text-right">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Current</p>
                                    <p className="text-xs font-extrabold text-[#0f1e38]">{activeMeta.label}</p>
                                  </div>
                                </div>

                                <div className="mt-4 grid gap-2 sm:grid-cols-7">
                                  {DATA_STEPS.map((step) => {
                                    const checklistItem = item.checklist.find((check) => check.title === step.match);
                                    const active = activeStep === step.id;
                                    return (
                                      <button
                                        key={step.id}
                                        onClick={() => setActiveDataSteps((prev) => ({ ...prev, [item.id]: step.id }))}
                                        className="min-h-20 rounded-xl border px-3 py-2 text-left transition-all"
                                        style={{
                                          background: active ? "#0f1e38" : "#f7f4ef",
                                          borderColor: active ? "#0f1e38" : "rgba(15,30,56,.06)",
                                          color: active ? "#fff" : "#0f1e38",
                                        }}
                                      >
                                        <span className="flex items-center justify-between gap-2">
                                          <span className={active ? "text-[#c8a96e]" : "text-[#c8a96e]"}>{step.icon}</span>
                                          {checklistItem?.isCompleted ? <CheckCircle2 size={13} className="text-emerald-500" /> : <Circle size={13} className={active ? "text-white/35" : "text-gray-300"} />}
                                        </span>
                                        <span className="mt-2 block text-xs font-extrabold">{step.label}</span>
                                        <span className={active ? "mt-0.5 block text-[10px] font-semibold text-white/55" : "mt-0.5 block text-[10px] font-semibold text-gray-400"}>{step.helper}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="p-4">
                                {activeStep === "profile" && (
                                  <div className="space-y-3">
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      <input value={profile.phone} onChange={(e) => setProfileDrafts((prev) => ({ ...prev, [item.id]: { ...profile, phone: e.target.value } }))} placeholder="Phone" className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold outline-none focus:border-[#c8a96e]" />
                                      <input value={profile.email} onChange={(e) => setProfileDrafts((prev) => ({ ...prev, [item.id]: { ...profile, email: e.target.value } }))} placeholder="Email" className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold outline-none focus:border-[#c8a96e]" />
                                      <input value={profile.website} onChange={(e) => setProfileDrafts((prev) => ({ ...prev, [item.id]: { ...profile, website: e.target.value } }))} placeholder="Website" className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold outline-none focus:border-[#c8a96e]" />
                                      <input value={profile.openingHours} onChange={(e) => setProfileDrafts((prev) => ({ ...prev, [item.id]: { ...profile, openingHours: e.target.value } }))} placeholder="Opening hours" className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold outline-none focus:border-[#c8a96e]" />
                                    </div>
                                    <textarea value={profile.servicesSummary} onChange={(e) => setProfileDrafts((prev) => ({ ...prev, [item.id]: { ...profile, servicesSummary: e.target.value } }))} placeholder="Services summary" rows={3} className="w-full resize-none rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 py-2 text-xs font-semibold outline-none focus:border-[#c8a96e]" />
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <label className="flex items-center gap-2 text-xs font-bold text-[#0f1e38]">
                                        <input type="checkbox" checked={profile.emergencyAvailable} onChange={(e) => setProfileDrafts((prev) => ({ ...prev, [item.id]: { ...profile, emergencyAvailable: e.target.checked } }))} />
                                        Emergency available
                                      </label>
                                      <button onClick={() => runPatch(`${item.id}-profile`, { action: "SAVE_PROFILE", onboardingId: item.id, ...profile })} className="h-9 rounded-xl px-4 text-xs font-bold text-white" style={{ background: "#0f1e38" }}>Save profile</button>
                                    </div>
                                  </div>
                                )}

                                {activeStep === "department" && (
                                  <div className="space-y-3">
                                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                                      <input value={department.name} onChange={(e) => setDepartmentDrafts((prev) => ({ ...prev, [item.id]: { ...department, name: e.target.value } }))} placeholder="Department name" className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold outline-none focus:border-[#c8a96e]" />
                                      <input value={department.overview} onChange={(e) => setDepartmentDrafts((prev) => ({ ...prev, [item.id]: { ...department, overview: e.target.value } }))} placeholder="Overview" className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold outline-none focus:border-[#c8a96e]" />
                                      <button onClick={() => addDepartment(item)} className="h-10 rounded-xl px-4 text-xs font-bold text-white" style={{ background: "#0f1e38" }}>
                                        {editTargets[`${item.id}:department`] ? "Save" : "Add department"}
                                      </button>
                                    </div>
                                    {editTargets[`${item.id}:department`] && (
                                      <button
                                        onClick={() => {
                                          setEditTargets((prev) => ({ ...prev, [`${item.id}:department`]: null }));
                                          setDepartmentDrafts((prev) => ({ ...prev, [item.id]: { name: "", overview: "" } }));
                                        }}
                                        className="text-xs font-bold text-gray-400"
                                      >
                                        Cancel edit
                                      </button>
                                    )}
                                    <div className="space-y-1.5">
                                      {item.hospital.departments.length === 0 ? <span className="text-xs font-semibold text-gray-400">No departments yet</span> : item.hospital.departments.map((dept) => (
                                        <div key={dept.id} className="flex items-center justify-between gap-2 rounded-xl bg-[#f7f4ef] px-3 py-2">
                                          <span className="text-[11px] font-bold text-[#0f1e38]">{dept.name}</span>
                                          <span className="flex gap-1">
                                            <button
                                              onClick={() => {
                                                setEditTargets((prev) => ({ ...prev, [`${item.id}:department`]: dept.id }));
                                                setDepartmentDrafts((prev) => ({ ...prev, [item.id]: { name: dept.name, overview: dept.overview ?? "" } }));
                                              }}
                                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#0f1e38]"
                                            >
                                              <Edit3 size={12} />
                                            </button>
                                            <button
                                              onClick={() => runPatch(`${dept.id}-delete`, { action: "DELETE_DEPARTMENT", onboardingId: item.id, entityId: dept.id })}
                                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-red-600"
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {activeStep === "doctor" && (
                                  <div className="space-y-3">
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      <input value={doctor.fullName} onChange={(e) => setDoctorDrafts((prev) => ({ ...prev, [item.id]: { ...doctor, fullName: e.target.value } }))} placeholder="Doctor full name" className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold outline-none focus:border-[#c8a96e]" />
                                      <select value={doctor.departmentId} onChange={(e) => setDoctorDrafts((prev) => ({ ...prev, [item.id]: { ...doctor, departmentId: e.target.value } }))} className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold outline-none focus:border-[#c8a96e]">
                                        <option value="">No department</option>
                                        {item.hospital.departments.map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                                      </select>
                                      <input value={doctor.positionTitle} onChange={(e) => setDoctorDrafts((prev) => ({ ...prev, [item.id]: { ...doctor, positionTitle: e.target.value } }))} placeholder="Position title" className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold outline-none focus:border-[#c8a96e]" />
                                      <input value={doctor.licenseNumber} onChange={(e) => setDoctorDrafts((prev) => ({ ...prev, [item.id]: { ...doctor, licenseNumber: e.target.value } }))} placeholder="License number" className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold outline-none focus:border-[#c8a96e]" />
                                      <input value={doctor.experienceYears} onChange={(e) => setDoctorDrafts((prev) => ({ ...prev, [item.id]: { ...doctor, experienceYears: e.target.value } }))} placeholder="Experience years" type="number" className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold outline-none focus:border-[#c8a96e]" />
                                      <div className="grid grid-cols-2 gap-2">
                                        <input value={doctor.feeMin} onChange={(e) => setDoctorDrafts((prev) => ({ ...prev, [item.id]: { ...doctor, feeMin: e.target.value } }))} placeholder="Fee min" type="number" className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold outline-none focus:border-[#c8a96e]" />
                                        <input value={doctor.feeMax} onChange={(e) => setDoctorDrafts((prev) => ({ ...prev, [item.id]: { ...doctor, feeMax: e.target.value } }))} placeholder="Fee max" type="number" className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold outline-none focus:border-[#c8a96e]" />
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <p className="text-xs font-semibold text-gray-400">{item.hospital.doctors.length} doctor{item.hospital.doctors.length === 1 ? "" : "s"} added</p>
                                      <div className="flex gap-2">
                                        {editTargets[`${item.id}:doctor`] && (
                                          <button
                                            onClick={() => {
                                              setEditTargets((prev) => ({ ...prev, [`${item.id}:doctor`]: null }));
                                              setDoctorDrafts((prev) => ({ ...prev, [item.id]: { fullName: "", departmentId: "", positionTitle: "", licenseNumber: "", experienceYears: "", feeMin: "", feeMax: "" } }));
                                            }}
                                            className="h-9 rounded-xl px-3 text-xs font-bold text-[#0f1e38]"
                                            style={{ background: "#f7f4ef" }}
                                          >
                                            Cancel
                                          </button>
                                        )}
                                        <button onClick={() => addDoctor(item)} className="h-9 rounded-xl px-4 text-xs font-bold text-white" style={{ background: "#0f1e38" }}>
                                          {editTargets[`${item.id}:doctor`] ? "Save doctor" : "Add doctor"}
                                        </button>
                                      </div>
                                    </div>
                                    <div className="space-y-1.5">
                                      {item.hospital.doctors.map(({ doctor: doc, positionTitle }) => (
                                        <div key={doc.id} className="flex items-center justify-between gap-2 rounded-xl bg-[#f7f4ef] px-3 py-2">
                                          <div className="min-w-0">
                                            <p className="truncate text-[11px] font-bold text-[#0f1e38]">{doc.fullName}</p>
                                            <p className="text-[10px] font-semibold text-gray-400">{positionTitle || "No position"}{doc.feeMin ? ` - NPR ${doc.feeMin}` : ""}</p>
                                          </div>
                                          <span className="flex gap-1">
                                            <button
                                              onClick={() => {
                                                setEditTargets((prev) => ({ ...prev, [`${item.id}:doctor`]: doc.id }));
                                                setDoctorDrafts((prev) => ({
                                                  ...prev,
                                                  [item.id]: {
                                                    fullName: doc.fullName,
                                                    departmentId: doc.departments[0]?.departmentId ?? "",
                                                    positionTitle: positionTitle ?? "",
                                                    licenseNumber: doc.licenseNumber ?? "",
                                                    experienceYears: doc.experienceYears === null ? "" : String(doc.experienceYears),
                                                    feeMin: doc.feeMin === null ? "" : String(doc.feeMin),
                                                    feeMax: doc.feeMax === null ? "" : String(doc.feeMax),
                                                  },
                                                }));
                                              }}
                                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#0f1e38]"
                                            >
                                              <Edit3 size={12} />
                                            </button>
                                            <button
                                              onClick={() => runPatch(`${doc.id}-delete`, { action: "DELETE_DOCTOR", onboardingId: item.id, entityId: doc.id })}
                                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-red-600"
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {activeStep === "schedule" && (
                                  <div className="space-y-3">
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      <select value={schedule.doctorId} onChange={(e) => setScheduleDrafts((prev) => ({ ...prev, [item.id]: { ...schedule, doctorId: e.target.value } }))} className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold outline-none focus:border-[#c8a96e]">
                                        <option value="">Select doctor</option>
                                        {item.hospital.doctors.map(({ doctor: doc }) => <option key={doc.id} value={doc.id}>{doc.fullName}</option>)}
                                      </select>
                                      <select value={schedule.dayOfWeek} onChange={(e) => setScheduleDrafts((prev) => ({ ...prev, [item.id]: { ...schedule, dayOfWeek: e.target.value } }))} className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold outline-none focus:border-[#c8a96e]">
                                        {DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}
                                      </select>
                                      <select value={schedule.mode} onChange={(e) => setScheduleDrafts((prev) => ({ ...prev, [item.id]: { ...schedule, mode: e.target.value as "PHYSICAL" | "ONLINE" } }))} className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold outline-none focus:border-[#c8a96e]">
                                        <option value="PHYSICAL">Physical</option>
                                        <option value="ONLINE">Online</option>
                                      </select>
                                      <input value={schedule.slotDurationMinutes} onChange={(e) => setScheduleDrafts((prev) => ({ ...prev, [item.id]: { ...schedule, slotDurationMinutes: e.target.value } }))} placeholder="Slot minutes" type="number" className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold outline-none focus:border-[#c8a96e]" />
                                      <input value={schedule.startTime} onChange={(e) => setScheduleDrafts((prev) => ({ ...prev, [item.id]: { ...schedule, startTime: e.target.value } }))} type="time" className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold outline-none focus:border-[#c8a96e]" />
                                      <input value={schedule.endTime} onChange={(e) => setScheduleDrafts((prev) => ({ ...prev, [item.id]: { ...schedule, endTime: e.target.value } }))} type="time" className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold outline-none focus:border-[#c8a96e]" />
                                    </div>
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <p className="text-xs font-semibold text-gray-400">{item.hospital.availabilitySlots.length} active schedule{item.hospital.availabilitySlots.length === 1 ? "" : "s"}</p>
                                      <div className="flex gap-2">
                                        {editTargets[`${item.id}:schedule`] && (
                                          <button
                                            onClick={() => setEditTargets((prev) => ({ ...prev, [`${item.id}:schedule`]: null }))}
                                            className="h-9 rounded-xl px-3 text-xs font-bold text-[#0f1e38]"
                                            style={{ background: "#f7f4ef" }}
                                          >
                                            Cancel
                                          </button>
                                        )}
                                        <button onClick={() => addSchedule(item)} className="h-9 rounded-xl px-4 text-xs font-bold text-white" style={{ background: "#0f1e38" }}>
                                          {editTargets[`${item.id}:schedule`] ? "Save schedule" : "Add schedule"}
                                        </button>
                                      </div>
                                    </div>
                                    <div className="space-y-1.5">
                                      {item.hospital.availabilitySlots.map((slot) => (
                                        <div key={slot.id} className="flex items-center justify-between gap-2 rounded-xl bg-[#f7f4ef] px-3 py-2">
                                          <div className="min-w-0">
                                            <p className="truncate text-[11px] font-bold text-[#0f1e38]">{slot.doctor.fullName}</p>
                                            <p className="text-[10px] font-semibold text-gray-400">{DAYS[slot.dayOfWeek]} - {slot.startTime}-{slot.endTime} - {slot.mode}</p>
                                          </div>
                                          <span className="flex gap-1">
                                            <button
                                              onClick={() => {
                                                setEditTargets((prev) => ({ ...prev, [`${item.id}:schedule`]: slot.id }));
                                                setScheduleDrafts((prev) => ({
                                                  ...prev,
                                                  [item.id]: {
                                                    doctorId: slot.doctorId,
                                                    dayOfWeek: String(slot.dayOfWeek),
                                                    mode: slot.mode,
                                                    startTime: slot.startTime,
                                                    endTime: slot.endTime,
                                                    slotDurationMinutes: String(slot.slotDurationMinutes),
                                                  },
                                                }));
                                              }}
                                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#0f1e38]"
                                            >
                                              <Edit3 size={12} />
                                            </button>
                                            <button
                                              onClick={() => runPatch(`${slot.id}-delete`, { action: "DELETE_SCHEDULE", onboardingId: item.id, entityId: slot.id })}
                                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-red-600"
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {activeStep === "package" && (
                                  <div className="space-y-3">
                                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_120px_auto]">
                                      <input value={packageDraft.title} onChange={(e) => setPackageDrafts((prev) => ({ ...prev, [item.id]: { ...packageDraft, title: e.target.value } }))} placeholder="Package title" className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold outline-none focus:border-[#c8a96e]" />
                                      <input value={packageDraft.description} onChange={(e) => setPackageDrafts((prev) => ({ ...prev, [item.id]: { ...packageDraft, description: e.target.value } }))} placeholder="Description" className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold outline-none focus:border-[#c8a96e]" />
                                      <input value={packageDraft.price} onChange={(e) => setPackageDrafts((prev) => ({ ...prev, [item.id]: { ...packageDraft, price: e.target.value } }))} placeholder="Price" type="number" className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold outline-none focus:border-[#c8a96e]" />
                                      <button onClick={() => addPackage(item)} className="h-10 rounded-xl px-4 text-xs font-bold text-white" style={{ background: "#0f1e38" }}>
                                        {editTargets[`${item.id}:package`] ? "Save" : "Add"}
                                      </button>
                                    </div>
                                    {editTargets[`${item.id}:package`] && (
                                      <button
                                        onClick={() => {
                                          setEditTargets((prev) => ({ ...prev, [`${item.id}:package`]: null }));
                                          setPackageDrafts((prev) => ({ ...prev, [item.id]: { title: "", description: "", price: "" } }));
                                        }}
                                        className="text-xs font-bold text-gray-400"
                                      >
                                        Cancel edit
                                      </button>
                                    )}
                                    <div className="space-y-1.5">
                                      {item.hospital.packages.length === 0 ? (
                                        <p className="text-xs font-semibold text-gray-400">No packages yet</p>
                                      ) : item.hospital.packages.map((pkg) => (
                                        <div key={pkg.id} className="flex items-center justify-between gap-2 rounded-xl bg-[#f7f4ef] px-3 py-2">
                                          <div className="min-w-0">
                                            <p className="truncate text-[11px] font-bold text-[#0f1e38]">{pkg.title}</p>
                                            <p className="text-[10px] font-semibold text-gray-400">{pkg.price === null ? "No price" : `${pkg.currency ?? "NPR"} ${pkg.price}`}</p>
                                          </div>
                                          <span className="flex gap-1">
                                            <button
                                              onClick={() => {
                                                setEditTargets((prev) => ({ ...prev, [`${item.id}:package`]: pkg.id }));
                                                setPackageDrafts((prev) => ({
                                                  ...prev,
                                                  [item.id]: {
                                                    title: pkg.title,
                                                    description: pkg.description ?? "",
                                                    price: pkg.price === null ? "" : String(pkg.price),
                                                  },
                                                }));
                                              }}
                                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#0f1e38]"
                                            >
                                              <Edit3 size={12} />
                                            </button>
                                            <button
                                              onClick={() => runPatch(`${pkg.id}-delete`, { action: "DELETE_PACKAGE", onboardingId: item.id, entityId: pkg.id })}
                                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-red-600"
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {activeStep === "media" && (
                                  <div className="space-y-3">
                                    <div className="grid gap-2 lg:grid-cols-[1.3fr_1fr_auto]">
                                      <input
                                        value={mediaDraft.url}
                                        onChange={(e) => setMediaDrafts((prev) => ({ ...prev, [item.id]: { ...mediaDraft, url: e.target.value } }))}
                                        placeholder="Image URL for logo, front photo, room, lab..."
                                        className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold outline-none focus:border-[#c8a96e]"
                                      />
                                      <input
                                        value={mediaDraft.altText}
                                        onChange={(e) => setMediaDrafts((prev) => ({ ...prev, [item.id]: { ...mediaDraft, altText: e.target.value } }))}
                                        placeholder="Alt text / label"
                                        className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold outline-none focus:border-[#c8a96e]"
                                      />
                                      <button onClick={() => addMedia(item)} className="h-10 rounded-xl px-4 text-xs font-bold text-white" style={{ background: "#0f1e38" }}>
                                        {editTargets[`${item.id}:media`] ? "Save media" : "Add media"}
                                      </button>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <label className="flex items-center gap-2 text-xs font-bold text-[#0f1e38]">
                                        <input
                                          type="checkbox"
                                          checked={mediaDraft.isPrimary}
                                          onChange={(e) => setMediaDrafts((prev) => ({ ...prev, [item.id]: { ...mediaDraft, isPrimary: e.target.checked } }))}
                                        />
                                        Use as primary hospital image
                                      </label>
                                      {editTargets[`${item.id}:media`] && (
                                        <button
                                          onClick={() => {
                                            setEditTargets((prev) => ({ ...prev, [`${item.id}:media`]: null }));
                                            setMediaDrafts((prev) => ({ ...prev, [item.id]: { url: "", altText: "", isPrimary: false } }));
                                          }}
                                          className="text-xs font-bold text-gray-400"
                                        >
                                          Cancel edit
                                        </button>
                                      )}
                                    </div>
                                    {item.hospital.media.length === 0 ? (
                                      <p className="rounded-xl bg-[#f7f4ef] px-3 py-3 text-xs font-semibold text-gray-400">No media yet. Add a logo or public hospital photo here.</p>
                                    ) : (
                                      <div className="grid gap-2 sm:grid-cols-2">
                                        {item.hospital.media.map((media) => (
                                          <div key={media.id} className="flex gap-3 rounded-xl bg-[#f7f4ef] p-2">
                                            <div
                                              aria-label={media.altText ?? "Hospital media"}
                                              className="h-16 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-white bg-cover bg-center"
                                              style={{ backgroundImage: `url("${media.url}")` }}
                                            />
                                            <div className="min-w-0 flex-1">
                                              <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                  <p className="truncate text-[11px] font-bold text-[#0f1e38]">{media.altText || "Hospital media"}</p>
                                                  <p className="truncate text-[10px] font-semibold text-gray-400">{media.url}</p>
                                                </div>
                                                {media.isPrimary && (
                                                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-700">Primary</span>
                                                )}
                                              </div>
                                              <div className="mt-2 flex gap-1">
                                                <button
                                                  onClick={() => {
                                                    setEditTargets((prev) => ({ ...prev, [`${item.id}:media`]: media.id }));
                                                    setMediaDrafts((prev) => ({
                                                      ...prev,
                                                      [item.id]: {
                                                        url: media.url,
                                                        altText: media.altText ?? "",
                                                        isPrimary: media.isPrimary,
                                                      },
                                                    }));
                                                  }}
                                                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#0f1e38]"
                                                >
                                                  <Edit3 size={12} />
                                                </button>
                                                <button
                                                  onClick={() => runPatch(`${media.id}-delete`, { action: "DELETE_MEDIA", onboardingId: item.id, entityId: media.id })}
                                                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-red-600"
                                                >
                                                  <Trash2 size={12} />
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {activeStep === "owner" && (
                                  <div className="space-y-3">
                                    <div className="rounded-xl bg-[#f7f4ef] px-3 py-3">
                                      <p className="text-xs font-extrabold text-[#0f1e38]">Assign hospital owner</p>
                                      <p className="mt-1 text-[11px] font-semibold text-gray-400">Only the OWNER role is assigned here. Managers, receptionists, doctors, and staff are handled later by the hospital admin.</p>
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                                      <input
                                        value={ownerDrafts[item.id] ?? ""}
                                        onChange={(e) => setOwnerDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                        placeholder="Existing user email"
                                        className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold outline-none focus:border-[#c8a96e]"
                                      />
                                      <button onClick={() => assignOwner(item)} className="h-10 rounded-xl px-4 text-xs font-bold text-white" style={{ background: "#0f1e38" }}>
                                        Assign owner
                                      </button>
                                    </div>
                                    <div className="space-y-1.5">
                                      {item.hospital.memberships.length === 0 ? (
                                        <p className="text-xs font-semibold text-gray-400">No approved owner assigned yet</p>
                                      ) : item.hospital.memberships.map((membership) => (
                                        <div key={membership.id} className="rounded-xl bg-[#f7f4ef] px-3 py-2">
                                          <p className="text-[11px] font-bold text-[#0f1e38]">{membership.user.fullName}</p>
                                          <p className="text-[10px] font-semibold text-gray-400">{membership.user.email}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        <div className="rounded-2xl border border-gray-100 bg-white p-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-sm font-extrabold text-[#0f1e38]">Checklist</p>
                            <p className="text-[11px] font-bold text-gray-400">{completed.length}/{required.length}</p>
                          </div>
                          <div className="space-y-2">
                            {item.checklist.map((check) => (
                              <button
                                key={check.id}
                                onClick={() => runPatch(`${check.id}-toggle`, { action: "SET_CHECKLIST", onboardingId: item.id, itemId: check.id, isCompleted: !check.isCompleted })}
                                className="flex w-full items-start gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2.5 text-left transition-colors hover:bg-[#f7f4ef]"
                              >
                                {check.isCompleted ? <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-emerald-600" /> : <Circle size={16} className="mt-0.5 flex-shrink-0 text-gray-300" />}
                                <span className="min-w-0 flex-1">
                                  <span className="block text-xs font-bold text-[#0f1e38]">{check.title}</span>
                                  <span className="mt-0.5 block text-[10px] font-semibold text-gray-400">
                                    {check.isRequired ? "Required" : "Optional"} {check.completedAt ? `- done ${formatDate(check.completedAt)}` : ""}
                                  </span>
                                </span>
                              </button>
                            ))}
                          </div>
                          <div className="mt-3 flex gap-2">
                            <input
                              value={checklistDrafts[item.id] ?? ""}
                              onChange={(e) => setChecklistDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              placeholder="Add checklist item..."
                              className="h-9 flex-1 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold text-[#0f1e38] outline-none placeholder:text-gray-400"
                            />
                            <button
                              onClick={() => {
                                void runPatch(`${item.id}-add-check`, {
                                  action: "ADD_CHECKLIST",
                                  onboardingId: item.id,
                                  title: checklistDrafts[item.id] ?? "",
                                  isRequired: true,
                                });
                                setChecklistDrafts((prev) => ({ ...prev, [item.id]: "" }));
                              }}
                              className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-white"
                              style={{ background: "#0f1e38" }}
                            >
                              <Plus size={12} /> Add
                            </button>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-gray-100 bg-white p-4">
                          <p className="mb-3 text-sm font-extrabold text-[#0f1e38]">Internal Notes</p>
                          <textarea
                            value={internalDrafts[item.id] ?? item.internalNotes ?? ""}
                            onChange={(e) => setInternalDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            rows={4}
                            className="w-full resize-none rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 py-2 text-xs font-semibold text-[#0f1e38] outline-none placeholder:text-gray-400"
                            placeholder="Internal setup notes..."
                          />
                          <button
                            onClick={() => runPatch(`${item.id}-internal`, { action: "UPDATE", onboardingId: item.id, internalNotes: internalDrafts[item.id] ?? "" })}
                            className="mt-2 h-8 rounded-xl px-3 text-xs font-bold"
                            style={{ background: "#f7f4ef", color: "#0f1e38" }}
                          >
                            Save notes
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-2xl border border-gray-100 bg-white p-4">
                          <p className="mb-3 text-sm font-extrabold text-[#0f1e38]">Activity Notes</p>
                          <div className="space-y-2">
                            {item.notes.length === 0 ? (
                              <p className="rounded-xl bg-[#f7f4ef] px-3 py-3 text-xs font-semibold text-gray-400">No notes yet.</p>
                            ) : (
                              item.notes.map((note) => (
                                <div key={note.id} className="rounded-xl bg-[#f7f4ef] px-3 py-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-xs font-bold text-[#0f1e38]">{note.title || "Note"}</p>
                                    <p className="text-[10px] font-semibold text-gray-400">{formatDateTime(note.createdAt)}</p>
                                  </div>
                                  <p className="mt-1 text-xs leading-relaxed text-[#3b4a63]">{note.body}</p>
                                  <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">{note.author.fullName}</p>
                                </div>
                              ))
                            )}
                          </div>
                          <div className="mt-3 space-y-2">
                            <textarea
                              value={noteDrafts[item.id] ?? ""}
                              onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              rows={3}
                              placeholder="Add a call note, missing info, or hospital instruction..."
                              className="w-full resize-none rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 py-2 text-xs font-semibold text-[#0f1e38] outline-none placeholder:text-gray-400"
                            />
                            <button
                              onClick={() => {
                                void runPatch(`${item.id}-note`, { action: "ADD_NOTE", onboardingId: item.id, body: noteDrafts[item.id] ?? "" });
                                setNoteDrafts((prev) => ({ ...prev, [item.id]: "" }));
                              }}
                              className="flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-white"
                              style={{ background: "#0f1e38" }}
                            >
                              <FileText size={12} /> Add note
                            </button>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-gray-100 bg-white p-4">
                          <p className="mb-3 text-sm font-extrabold text-[#0f1e38]">Import Batches</p>
                          {item.imports.length === 0 ? (
                            <p className="rounded-xl bg-[#f7f4ef] px-3 py-3 text-xs font-semibold text-gray-400">No import batches yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {item.imports.map((batch) => (
                                <div key={batch.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#f7f4ef] px-3 py-2.5">
                                  <div>
                                    <p className="text-xs font-bold text-[#0f1e38]">{batch.type}</p>
                                    <p className="text-[10px] font-semibold text-gray-400">{batch.status} - {formatDate(batch.createdAt)}</p>
                                  </div>
                                  <p className="text-[11px] font-bold text-[#6b7a96]">
                                    {batch.successRows}/{batch.totalRows} ok
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {data && data.total > 20 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs font-semibold text-[#8a9ab5]">
            Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, data.total)} of {data.total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-9 w-9 items-center justify-center rounded-xl disabled:opacity-30"
              style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.1)" }}
            >
              <ChevronLeft size={15} className="text-[#0f1e38]" />
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!data.hasMore}
              className="flex h-9 w-9 items-center justify-center rounded-xl disabled:opacity-30"
              style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.1)" }}
            >
              <ChevronRight size={15} className="text-[#0f1e38]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
