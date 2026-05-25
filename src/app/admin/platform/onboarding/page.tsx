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
  Edit3,
  FileText,
  ImagePlus,
  ImageIcon,
  Inbox,
  MapPin,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Trash2,
  Upload,
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
    location: {
      country: string;
      province: string | null;
      district: string;
      city: string;
      area: string | null;
      addressLine: string | null;
      lat: number | null;
      lng: number | null;
    };
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
        media: { id: string; url: string; altText: string | null; isPrimary: boolean }[];
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

type DataEntryStep = "request" | "profile" | "department" | "doctor" | "schedule" | "package" | "media" | "owner" | "review";
type DeleteAction = "DELETE_DEPARTMENT" | "DELETE_DOCTOR" | "DELETE_SCHEDULE" | "DELETE_PACKAGE" | "DELETE_MEDIA";
type HospitalLocation = NonNullable<Onboarding["hospital"]>["location"];
type DeleteTarget = {
  key: string;
  title: string;
  description: string;
  action: DeleteAction;
  onboardingId: string;
  entityId: string;
};
type DoctorDraft = {
  fullName: string;
  departmentId: string;
  positionTitle: string;
  licenseNumber: string;
  experienceYears: string;
  feeMin: string;
  feeMax: string;
  photoUrl: string;
};

type ProfileDraft = {
  phone: string;
  email: string;
  website: string;
  openingHours: string;
  servicesSummary: string;
  emergencyAvailable: boolean;
  country: string;
  province: string;
  district: string;
  city: string;
  area: string;
  addressLine: string;
  lat: string;
  lng: string;
};

const STATUSES: { value: OnboardingStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "NEW", label: "New" },
  { value: "MEETING_DONE", label: "Meeting done" },
  { value: "DATA_REQUESTED", label: "Data requested" },
  { value: "DATA_RECEIVED", label: "Data received" },
  { value: "DATA_ENTRY_IN_PROGRESS", label: "Adding details" },
  { value: "WAITING_FOR_HOSPITAL_CONFIRMATION", label: "Waiting for hospital" },
  { value: "READY_TO_PUBLISH", label: "Ready to go live" },
  { value: "PUBLISHED", label: "Live" },
  { value: "NEEDS_UPDATE", label: "Needs update" },
  { value: "CANCELLED", label: "Cancelled" },
];

const STATUS_STYLE: Record<OnboardingStatus, { bg: string; color: string; dot: string; label: string }> = {
  NEW: { bg: "rgba(99,102,241,.1)", color: "#4338ca", dot: "#6366f1", label: "New" },
  MEETING_DONE: { bg: "rgba(14,165,233,.1)", color: "#0369a1", dot: "#0ea5e9", label: "Meeting done" },
  DATA_REQUESTED: { bg: "rgba(245,158,11,.12)", color: "#b45309", dot: "#f59e0b", label: "Data requested" },
  DATA_RECEIVED: { bg: "rgba(20,184,166,.1)", color: "#0f766e", dot: "#14b8a6", label: "Data received" },
  DATA_ENTRY_IN_PROGRESS: { bg: "rgba(200,169,110,.16)", color: "#8a6f37", dot: "#c8a96e", label: "Adding details" },
  WAITING_FOR_HOSPITAL_CONFIRMATION: { bg: "rgba(168,85,247,.1)", color: "#7e22ce", dot: "#a855f7", label: "Waiting for hospital" },
  READY_TO_PUBLISH: { bg: "rgba(34,197,94,.12)", color: "#15803d", dot: "#22c55e", label: "Ready to go live" },
  PUBLISHED: { bg: "rgba(16,185,129,.12)", color: "#047857", dot: "#10b981", label: "Live" },
  NEEDS_UPDATE: { bg: "rgba(249,115,22,.1)", color: "#c2410c", dot: "#f97316", label: "Needs update" },
  CANCELLED: { bg: "rgba(239,68,68,.08)", color: "#b91c1c", dot: "#ef4444", label: "Cancelled" },
};

const TYPE_LABELS: Record<string, string> = {
  HOSPITAL: "Hospital",
  CLINIC: "Clinic",
  LAB: "Laboratory",
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_OPTIONS = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "0", label: "Sunday" },
];

const EMPTY_DOCTOR_DRAFT: DoctorDraft = {
  fullName: "",
  departmentId: "",
  positionTitle: "",
  licenseNumber: "",
  experienceYears: "",
  feeMin: "",
  feeMax: "",
  photoUrl: "",
};

function normalizeDoctorDraft(draft?: Partial<DoctorDraft>): DoctorDraft {
  return { ...EMPTY_DOCTOR_DRAFT, ...draft };
}

const DATA_STEPS: {
  id: DataEntryStep;
  label: string;
  helper: string;
  match?: string;
  icon: React.ReactNode;
}[] = [
  { id: "request", label: "Request details", helper: "Incoming inquiry", icon: <Inbox size={14} /> },
  { id: "profile", label: "Basic details", helper: "Phone, email, hours", match: "Hospital basic info added", icon: <Building2 size={14} /> },
  { id: "department", label: "Services", helper: "Departments patients see", match: "Departments added", icon: <ClipboardList size={14} /> },
  { id: "doctor", label: "Doctors", helper: "Roster, roles, fees", match: "Doctors added", icon: <UserRound size={14} /> },
  { id: "schedule", label: "Availability", helper: "Weekly booking times", match: "Schedules configured", icon: <CalendarDays size={14} /> },
  { id: "package", label: "Health packages", helper: "Names and prices", match: "Packages configured", icon: <FileText size={14} /> },
  { id: "media", label: "Logo & photos", helper: "Public images", match: "Hospital media added", icon: <ImageIcon size={14} /> },
  { id: "owner", label: "Main admin", helper: "First hospital admin", match: "Owner account linked", icon: <UserRound size={14} /> },
  { id: "review", label: "Review & launch", helper: "Final checks", match: "Hospital confirmation received", icon: <CheckCircle2 size={14} /> },
];

const CHECKLIST_LABELS: Record<string, string> = {
  "Hospital basic info added": "Basic hospital details added",
  "Location verified": "Location checked",
  "Departments added": "Services added",
  "Doctors added": "Doctors added",
  "Schedules configured": "Availability added",
  "Packages configured": "Health packages added",
  "Hospital media added": "Logo/photos added",
  "Owner account linked": "Main hospital admin assigned",
  "Hospital confirmation received": "Hospital has confirmed details",
};

function checklistLabel(title: string) {
  return CHECKLIST_LABELS[title] ?? title;
}

function uniqueLocationParts(parts: Array<string | null | undefined>) {
  const seen = new Set<string>();
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => {
      if (!part) return false;
      const key = part.replace(/\s+/g, " ").toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function formatLocationLabel(location: HospitalLocation) {
  const parts = uniqueLocationParts([
    location.addressLine,
    location.area,
    location.city,
    location.district,
    location.province,
    location.country,
  ]);
  return parts.join(", ") || "Location not added";
}

function getSetupSummary(item: Onboarding) {
  if (item.hospital) {
    return {
      name: item.hospital.name,
      type: item.hospital.type,
      contactName: item.partnerInquiry?.contactName ?? item.createdBy.fullName,
      phone: item.hospital.phone ?? "",
      email: item.hospital.email || item.partnerInquiry?.email || "",
      place: formatLocationLabel(item.hospital.location),
    };
  }

  return {
    name: item.partnerInquiry?.hospitalName ?? "Untitled hospital setup",
    type: item.partnerInquiry?.type ?? "HOSPITAL",
    contactName: item.partnerInquiry?.contactName ?? item.createdBy.fullName,
    phone: item.partnerInquiry?.phone ?? "",
    email: item.partnerInquiry?.email ?? "",
    place: item.partnerInquiry?.city ? `${item.partnerInquiry.city}, Nepal` : "",
  };
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

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function formatTimeLabel(value: string) {
  const minutes = timeToMinutes(value);
  if (minutes === null) return value;
  return formatMinutesLabel(minutes);
}

function formatMinutesLabel(minutes: number) {
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function bookingTimeLabels(startTime: string, endTime: string, duration: number) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start === null || end === null || end <= start || duration <= 0) return [];
  const times: string[] = [];
  for (let current = start; current + duration <= end; current += duration) {
    times.push(`${formatMinutesLabel(current)}-${formatMinutesLabel(current + duration)}`);
  }
  return times;
}

function daySortValue(dayOfWeek: number) {
  return (dayOfWeek + 6) % 7;
}

function compactText(value: string | null, maxLength = 90) {
  if (!value) return "No description";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
}

function profileDraftFromHospital(hospital: NonNullable<Onboarding["hospital"]>): ProfileDraft {
  return {
    phone: hospital.phone ?? "",
    email: hospital.email ?? "",
    website: hospital.website ?? "",
    openingHours: hospital.openingHours ?? "",
    servicesSummary: hospital.servicesSummary ?? "",
    emergencyAvailable: hospital.emergencyAvailable,
    country: hospital.location.country ?? "NP",
    province: hospital.location.province ?? "",
    district: hospital.location.district ?? "",
    city: hospital.location.city ?? "",
    area: hospital.location.area ?? "",
    addressLine: hospital.location.addressLine ?? "",
    lat: hospital.location.lat === null ? "" : String(hospital.location.lat),
    lng: hospital.location.lng === null ? "" : String(hospital.location.lng),
  };
}

function normalizeProfileDraft(profile: Partial<ProfileDraft> | undefined, hospital: NonNullable<Onboarding["hospital"]>): ProfileDraft {
  const fallback = profileDraftFromHospital(hospital);
  return {
    ...fallback,
    ...profile,
    phone: profile?.phone ?? fallback.phone,
    email: profile?.email ?? fallback.email,
    website: profile?.website ?? fallback.website,
    openingHours: profile?.openingHours ?? fallback.openingHours,
    servicesSummary: profile?.servicesSummary ?? fallback.servicesSummary,
    emergencyAvailable: profile?.emergencyAvailable ?? fallback.emergencyAvailable,
    country: profile?.country ?? fallback.country,
    province: profile?.province ?? fallback.province,
    district: profile?.district ?? fallback.district,
    city: profile?.city ?? fallback.city,
    area: profile?.area ?? fallback.area,
    addressLine: profile?.addressLine ?? fallback.addressLine,
    lat: profile?.lat ?? fallback.lat,
    lng: profile?.lng ?? fallback.lng,
  };
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
  const [internalDrafts, setInternalDrafts] = useState<Record<string, string>>({});
  const [profileDrafts, setProfileDrafts] = useState<Record<string, ProfileDraft>>({});
  const [departmentDrafts, setDepartmentDrafts] = useState<Record<string, { name: string; overview: string }>>({});
  const [doctorDrafts, setDoctorDrafts] = useState<Record<string, DoctorDraft>>({});
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
  const [newCase, setNewCase] = useState({
    source: "inquiry" as "inquiry" | "direct",
    partnerInquiryId: "",
    assignedToUserId: "",
    internalNotes: "",
    hospitalName: "",
    type: "HOSPITAL" as "HOSPITAL" | "CLINIC" | "LAB",
    contactName: "",
    email: "",
    phone: "",
    city: "",
  });
  const [pendingDelete, setPendingDelete] = useState<DeleteTarget | null>(null);
  const [notesOpen, setNotesOpen] = useState<Record<string, boolean>>({});
  const [showStartSetup, setShowStartSetup] = useState(false);
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});
  const [expandedPackages, setExpandedPackages] = useState<Record<string, boolean>>({});
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tempIdRef = useRef(0);

  const nextTempId = (prefix: string) => {
    tempIdRef.current += 1;
    return `temp-${prefix}-${tempIdRef.current}`;
  };

  const fetchOnboardings = useCallback(async (q = search, s = status, p = page, options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? true;
    if (showLoading) setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(p), status: s });
      if (q) params.set("search", q);
      const res = await fetch(`/api/admin/platform/onboarding?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load hospital setup cases");
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
          next[item.id] = profileDraftFromHospital(item.hospital);
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load hospital setup cases.");
    } finally {
      if (showLoading) setLoading(false);
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
    const optimisticPublish = body.action === "PUBLISH" && typeof body.onboardingId === "string";
    const optimisticPublishId = optimisticPublish ? body.onboardingId : null;
    const previousData = optimisticPublish ? data : null;
    if (optimisticPublishId) {
      setData((prev) => prev ? {
        ...prev,
        onboardings: prev.onboardings.map((item) => item.id === optimisticPublishId ? {
          ...item,
          status: "PUBLISHED",
          hospital: item.hospital ? { ...item.hospital, isActive: true, verified: true } : item.hospital,
        } : item),
      } : prev);
    }
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
      setActionLoading(null);
      void fetchOnboardings(search, status, page, { showLoading: false });
      return true;
    } catch (err) {
      if (previousData) setData(previousData);
      setError(err instanceof Error ? err.message : "Action failed.");
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  const withCompletedChecklist = (item: Onboarding, title: string) => ({
    ...item,
    checklist: item.checklist.map((check) => check.title === title ? {
      ...check,
      isCompleted: true,
      completedAt: check.completedAt ?? new Date().toISOString(),
    } : check),
  });

  const updateOnboarding = (onboardingId: string, updater: (item: Onboarding) => Onboarding) => {
    setData((prev) => prev ? {
      ...prev,
      onboardings: prev.onboardings.map((item) => item.id === onboardingId ? updater(item) : item),
    } : prev);
  };

  const submitOptimisticPatch = (previousData: ApiData | null, key: string, body: Record<string, unknown>) => {
    void runPatch(key, body).then((success) => {
      if (!success && previousData) setData(previousData);
    });
  };

  const uploadOnboardingImage = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/admin/platform/onboarding/uploads", {
      method: "POST",
      body: form,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Image upload failed");
    return json.url as string;
  };

  const uploadDoctorPhoto = async (item: Onboarding, file: File) => {
    setActionLoading(`${item.id}-doctor-photo`);
    setError("");
    try {
      const url = await uploadOnboardingImage(file);
      const draft = normalizeDoctorDraft(doctorDrafts[item.id]);
      setDoctorDrafts((prev) => ({ ...prev, [item.id]: { ...draft, photoUrl: url } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setActionLoading(null);
    }
  };

  const uploadHospitalImage = async (item: Onboarding, file: File) => {
    setActionLoading(`${item.id}-hospital-image`);
    setError("");
    try {
      const url = await uploadOnboardingImage(file);
      const draft = mediaDrafts[item.id] ?? { url: "", altText: "", isPrimary: item.hospital?.media.length === 0 };
      setMediaDrafts((prev) => ({ ...prev, [item.id]: { ...draft, url, isPrimary: draft.isPrimary || item.hospital?.media.length === 0 } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setActionLoading(null);
    }
  };

  const createCase = async () => {
    const isDirect = newCase.source === "direct";
    if (!isDirect && !newCase.partnerInquiryId) {
      setError("Select a partner inquiry first.");
      return;
    }
    if (isDirect && (!newCase.hospitalName.trim() || !newCase.contactName.trim() || !newCase.email.trim() || !newCase.phone.trim() || !newCase.city.trim())) {
      setError("Add hospital name, contact, email, phone, and city for the direct contact.");
      return;
    }
    setActionLoading("create-case");
    setError("");
    try {
      const res = await fetch("/api/admin/platform/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: newCase.source,
          partnerInquiryId: isDirect ? undefined : newCase.partnerInquiryId,
          directContact: isDirect ? {
            hospitalName: newCase.hospitalName,
            type: newCase.type,
            contactName: newCase.contactName,
            email: newCase.email,
            phone: newCase.phone,
            city: newCase.city,
          } : undefined,
          assignedToUserId: newCase.assignedToUserId || null,
          internalNotes: newCase.internalNotes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not create hospital setup case");
      setNewCase({
        source: "inquiry",
        partnerInquiryId: "",
        assignedToUserId: "",
        internalNotes: "",
        hospitalName: "",
        type: "HOSPITAL",
        contactName: "",
        email: "",
        phone: "",
        city: "",
      });
      setShowStartSetup(false);
      await fetchOnboardings(search, status, page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create hospital setup case.");
    } finally {
      setActionLoading(null);
    }
  };

  const addDepartment = async (item: Onboarding) => {
    const draft = departmentDrafts[item.id] ?? { name: "", overview: "" };
    const editId = editTargets[`${item.id}:department`];
    if (!draft.name.trim()) {
      setError("Add a service name first.");
      return;
    }
    const previousData = data;
    const optimisticDepartment = {
      id: editId || nextTempId("department"),
      name: draft.name.trim(),
      overview: draft.overview.trim() || null,
      sortOrder: item.hospital?.departments.length ?? 0,
    };
    updateOnboarding(item.id, (entry) => {
      if (!entry.hospital) return entry;
      const departments = editId
        ? entry.hospital.departments.map((dept) => dept.id === editId ? optimisticDepartment : dept)
        : [...entry.hospital.departments, optimisticDepartment];
      return withCompletedChecklist({ ...entry, hospital: { ...entry.hospital, departments } }, "Departments added");
    });
    submitOptimisticPatch(previousData, `${item.id}-department`, {
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
    const draft = normalizeDoctorDraft(doctorDrafts[item.id]);
    const editId = editTargets[`${item.id}:doctor`];
    if (!draft.fullName.trim()) {
      setError("Add a doctor name first.");
      return;
    }
    const previousData = data;
    const optimisticDoctor = {
      doctor: {
        id: editId || nextTempId("doctor"),
        fullName: draft.fullName.trim(),
        licenseNumber: draft.licenseNumber.trim() || null,
        experienceYears: draft.experienceYears ? Number(draft.experienceYears) : null,
        feeMin: draft.feeMin ? Number(draft.feeMin) : null,
        feeMax: draft.feeMax ? Number(draft.feeMax) : null,
        currency: "EUR",
        media: draft.photoUrl ? [{ id: nextTempId("doctor-media"), url: draft.photoUrl, altText: null, isPrimary: true }] : [],
        departments: draft.departmentId ? [{ departmentId: draft.departmentId }] : [],
      },
      positionTitle: draft.positionTitle.trim() || null,
    };
    updateOnboarding(item.id, (entry) => {
      if (!entry.hospital) return entry;
      const doctors = editId
        ? entry.hospital.doctors.map((doctor) => doctor.doctor.id === editId ? optimisticDoctor : doctor)
        : [...entry.hospital.doctors, optimisticDoctor];
      return withCompletedChecklist({ ...entry, hospital: { ...entry.hospital, doctors } }, "Doctors added");
    });
    submitOptimisticPatch(previousData, `${item.id}-doctor`, {
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
      currency: "EUR",
      photoUrl: draft.photoUrl || null,
    });
    setDoctorDrafts((prev) => ({
      ...prev,
      [item.id]: EMPTY_DOCTOR_DRAFT,
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
    const previousData = data;
    const doctorName = item.hospital?.doctors.find(({ doctor: doc }) => doc.id === draft.doctorId)?.doctor.fullName ?? "Selected doctor";
    const optimisticSlot = {
      id: editId || nextTempId("schedule"),
      doctorId: draft.doctorId,
      dayOfWeek: Number(draft.dayOfWeek),
      mode: draft.mode,
      startTime: draft.startTime,
      endTime: draft.endTime,
      slotDurationMinutes: Number(draft.slotDurationMinutes),
      doctor: { fullName: doctorName },
    };
    updateOnboarding(item.id, (entry) => {
      if (!entry.hospital) return entry;
      const availabilitySlots = editId
        ? entry.hospital.availabilitySlots.map((slot) => slot.id === editId ? optimisticSlot : slot)
        : [...entry.hospital.availabilitySlots, optimisticSlot];
      return withCompletedChecklist({ ...entry, hospital: { ...entry.hospital, availabilitySlots } }, "Schedules configured");
    });

    submitOptimisticPatch(previousData, `${item.id}-schedule`, {
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
    if (!draft.title.trim()) {
      setError("Add a package title first.");
      return;
    }
    const previousData = data;
    const optimisticPackage = {
      id: editId || nextTempId("package"),
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      price: draft.price ? Number(draft.price) : null,
      currency: "EUR",
    };
    updateOnboarding(item.id, (entry) => {
      if (!entry.hospital) return entry;
      const packages = editId
        ? entry.hospital.packages.map((pkg) => pkg.id === editId ? optimisticPackage : pkg)
        : [...entry.hospital.packages, optimisticPackage];
      return withCompletedChecklist({ ...entry, hospital: { ...entry.hospital, packages } }, "Packages configured");
    });
    submitOptimisticPatch(previousData, `${item.id}-package`, {
      action: editId ? "UPDATE_PACKAGE" : "ADD_PACKAGE",
      onboardingId: item.id,
      entityId: editId || undefined,
      title: draft.title,
      description: draft.description,
      price: draft.price ? Number(draft.price) : null,
      currency: "EUR",
    });
    setPackageDrafts((prev) => ({ ...prev, [item.id]: { title: "", description: "", price: "" } }));
    setEditTargets((prev) => ({ ...prev, [`${item.id}:package`]: null }));
  };

  const addMedia = async (item: Onboarding) => {
    const draft = mediaDrafts[item.id] ?? { url: "", altText: "", isPrimary: item.hospital?.media.length === 0 };
    const editId = editTargets[`${item.id}:media`];
    if (!draft.url.trim()) {
      setError("Add an image first.");
      return;
    }
    const previousData = data;
    const optimisticMedia = {
      id: editId || nextTempId("media"),
      url: draft.url.trim(),
      altText: draft.altText.trim() || null,
      isPrimary: draft.isPrimary,
    };
    updateOnboarding(item.id, (entry) => {
      if (!entry.hospital) return entry;
      const media = editId
        ? entry.hospital.media.map((image) => image.id === editId ? optimisticMedia : draft.isPrimary ? { ...image, isPrimary: false } : image)
        : [...(draft.isPrimary ? entry.hospital.media.map((image) => ({ ...image, isPrimary: false })) : entry.hospital.media), optimisticMedia];
      return withCompletedChecklist({ ...entry, hospital: { ...entry.hospital, media } }, "Hospital media added");
    });
    submitOptimisticPatch(previousData, `${item.id}-media`, {
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
    const email = ownerDrafts[item.id]?.trim() ?? "";
    if (!email) {
      setError("Add the main admin email first.");
      return;
    }
    const previousData = data;
    updateOnboarding(item.id, (entry) => {
      if (!entry.hospital) return entry;
      const user = {
        id: nextTempId("owner"),
        fullName: email.split("@")[0] || email,
        email,
      };
      return withCompletedChecklist({
        ...entry,
        hospital: {
          ...entry.hospital,
          memberships: [{ id: nextTempId("membership"), user }],
        },
      }, "Owner account linked");
    });
    submitOptimisticPatch(previousData, `${item.id}-owner`, {
      action: "ASSIGN_OWNER",
      onboardingId: item.id,
      ownerEmail: email,
    });
    setOwnerDrafts((prev) => ({ ...prev, [item.id]: "" }));
  };

  const saveProfile = (item: Onboarding, profile: ProfileDraft) => {
    const previousData = data;
    const parsedLat = profile.lat.trim() ? Number(profile.lat) : NaN;
    const parsedLng = profile.lng.trim() ? Number(profile.lng) : NaN;
    const lat = Number.isFinite(parsedLat) ? parsedLat : null;
    const lng = Number.isFinite(parsedLng) ? parsedLng : null;
    updateOnboarding(item.id, (entry) => {
      if (!entry.hospital) return entry;
      return withCompletedChecklist({
        ...entry,
        hospital: {
          ...entry.hospital,
          phone: profile.phone,
          email: profile.email,
          website: profile.website,
          openingHours: profile.openingHours,
          servicesSummary: profile.servicesSummary,
          emergencyAvailable: profile.emergencyAvailable,
          location: {
            ...entry.hospital.location,
            country: profile.country || "NP",
            province: profile.province || null,
            district: profile.district || profile.city || "Unknown",
            city: profile.city || profile.district || "Unknown",
            area: profile.area || null,
            addressLine: profile.addressLine || null,
            lat,
            lng,
          },
        },
      }, "Hospital basic info added");
    });
    submitOptimisticPatch(previousData, `${item.id}-profile`, {
      action: "SAVE_PROFILE",
      onboardingId: item.id,
      ...profile,
      lat,
      lng,
    });
  };

  const saveInternalNotes = (item: Onboarding) => {
    const previousData = data;
    const internalNotes = internalDrafts[item.id] ?? "";
    updateOnboarding(item.id, (entry) => ({ ...entry, internalNotes }));
    submitOptimisticPatch(previousData, `${item.id}-internal`, { action: "UPDATE", onboardingId: item.id, internalNotes });
  };

  const addNote = (item: Onboarding) => {
    const body = noteDrafts[item.id]?.trim() ?? "";
    if (!body) {
      setError("Add a note first.");
      return;
    }
    const previousData = data;
    const note = {
      id: nextTempId("note"),
      title: null,
      body,
      createdAt: new Date().toISOString(),
      author: { fullName: "You" },
    };
    updateOnboarding(item.id, (entry) => ({
      ...entry,
      notes: [note, ...entry.notes],
      _count: { ...entry._count, notes: entry._count.notes + 1 },
    }));
    setNoteDrafts((prev) => ({ ...prev, [item.id]: "" }));
    submitOptimisticPatch(previousData, `${item.id}-note`, { action: "ADD_NOTE", onboardingId: item.id, body });
  };

  const toggleChecklist = (item: Onboarding, check: ChecklistItem) => {
    const previousData = data;
    const isCompleted = !check.isCompleted;
    updateOnboarding(item.id, (entry) => ({
      ...entry,
      checklist: entry.checklist.map((entryCheck) => entryCheck.id === check.id ? {
        ...entryCheck,
        isCompleted,
        completedAt: isCompleted ? new Date().toISOString() : null,
      } : entryCheck),
    }));
    submitOptimisticPatch(previousData, `${check.id}-toggle`, { action: "SET_CHECKLIST", onboardingId: item.id, itemId: check.id, isCompleted });
  };

  const applyDeleteLocally = (target: DeleteTarget) => {
    updateOnboarding(target.onboardingId, (entry) => {
      if (!entry.hospital) return entry;
      if (target.action === "DELETE_DEPARTMENT") {
        return {
          ...entry,
          hospital: {
            ...entry.hospital,
            departments: entry.hospital.departments.filter((dept) => dept.id !== target.entityId),
          },
        };
      }
      if (target.action === "DELETE_DOCTOR") {
        return {
          ...entry,
          hospital: {
            ...entry.hospital,
            doctors: entry.hospital.doctors.filter(({ doctor }) => doctor.id !== target.entityId),
            availabilitySlots: entry.hospital.availabilitySlots.filter((slot) => slot.doctorId !== target.entityId),
          },
        };
      }
      if (target.action === "DELETE_SCHEDULE") {
        return {
          ...entry,
          hospital: {
            ...entry.hospital,
            availabilitySlots: entry.hospital.availabilitySlots.filter((slot) => slot.id !== target.entityId),
          },
        };
      }
      if (target.action === "DELETE_PACKAGE") {
        return {
          ...entry,
          hospital: {
            ...entry.hospital,
            packages: entry.hospital.packages.filter((pkg) => pkg.id !== target.entityId),
          },
        };
      }
      return {
        ...entry,
        hospital: {
          ...entry.hospital,
          media: entry.hospital.media.filter((media) => media.id !== target.entityId),
        },
      };
    });
  };

  const requestDelete = (target: DeleteTarget) => {
    setPendingDelete(target);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    const previousData = data;
    setPendingDelete(null);
    applyDeleteLocally(target);
    void runPatch(target.key, {
      action: target.action,
      onboardingId: target.onboardingId,
      entityId: target.entityId,
    }).then((success) => {
      if (!success && previousData) setData(previousData);
    });
  };

  const renderSetupStep = (item: Onboarding) => {
    const activeStep = activeDataSteps[item.id] ?? "request";

    if (activeStep === "request") {
      const inquiryRows = [
        ["Hospital", item.partnerInquiry?.hospitalName ?? item.hospital?.name ?? "Not added"],
        ["Type", TYPE_LABELS[item.partnerInquiry?.type ?? item.hospital?.type ?? "HOSPITAL"]],
        ["Contact person", item.partnerInquiry?.contactName ?? item.createdBy.fullName],
        ["Phone", item.partnerInquiry?.phone ?? item.hospital?.phone ?? "Not added"],
        ["Email", item.partnerInquiry?.email ?? item.hospital?.email ?? "Not added"],
        ["City", item.partnerInquiry?.city ?? item.hospital?.location.city ?? "Not added"],
        ["Request status", item.partnerInquiry?.status ?? item.status],
        ["Hospital record", item.hospital ? "Created and linked" : "Not created yet"],
      ];

      return (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-[#0f1e38]">Request details</h2>
              <p className="mt-1 text-sm font-semibold text-[#8a9ab5]">
                Start from the information the hospital sent, then continue into editable setup details.
              </p>
            </div>
            {item.hospital ? (
              <span className="inline-flex h-9 items-center gap-2 rounded-xl bg-emerald-50 px-3 text-xs font-bold text-emerald-700">
                <CheckCircle2 size={13} /> Data record ready
              </span>
            ) : null}
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-4">
            <div className="grid gap-3 md:grid-cols-2">
              {inquiryRows.map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-[#f7f4ef] px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#8a9ab5]">{label}</p>
                  <p className="mt-1 break-words text-sm font-extrabold text-[#0f1e38]">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-[#eadfca] bg-[#fffaf0] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-[#0f1e38]">
                  {item.hospital ? "Next: confirm public hospital details" : "Create the editable hospital record"}
                </p>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-[#8a9ab5]">
                  {item.hospital
                    ? "The basic details form is where you clean up phone, address, map location, hours, and public summary."
                    : "This copies the incoming request into a real hospital setup record so the rest of the flow can be completed."}
                </p>
              </div>
              {item.hospital ? (
                <button
                  onClick={() => setActiveDataSteps((prev) => ({ ...prev, [item.id]: "profile" }))}
                  className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold text-white"
                  style={{ background: "#0f1e38" }}
                >
                  Open basic details <ChevronRight size={14} />
                </button>
              ) : data?.canManage && item.partnerInquiry ? (
                <button
                  onClick={() => runPatch(`${item.id}-shell`, { action: "CREATE_HOSPITAL_SHELL", onboardingId: item.id })}
                  disabled={!!actionLoading}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold text-white disabled:opacity-50"
                  style={{ background: "#0f1e38" }}
                >
                  <Building2 size={13} /> Create hospital record
                </button>
              ) : null}
            </div>
          </div>
        </div>
      );
    }

    if (!item.hospital) {
      return (
        <div className="rounded-2xl border border-dashed border-[#d9c79e] bg-[#fffaf0] p-8 text-center">
          <Building2 size={28} className="mx-auto text-[#c8a96e]" />
          <h2 className="mt-3 text-lg font-extrabold text-[#0f1e38]">Create the hospital record first</h2>
          <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-relaxed text-[#6b7a96]">
            The setup steps will unlock after the platform creates the hospital profile from the partner inquiry.
          </p>
          {data?.canManage && item.partnerInquiry && (
            <button
              onClick={() => runPatch(`${item.id}-shell`, { action: "CREATE_HOSPITAL_SHELL", onboardingId: item.id })}
              disabled={!!actionLoading}
              className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold text-white disabled:opacity-50"
              style={{ background: "#0f1e38" }}
            >
              <Building2 size={13} /> Create hospital record
            </button>
          )}
        </div>
      );
    }

    const profile = normalizeProfileDraft(profileDrafts[item.id], item.hospital);
    const department = departmentDrafts[item.id] ?? { name: "", overview: "" };
    const doctor = normalizeDoctorDraft(doctorDrafts[item.id]);
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
    if (activeStep === "profile") {
      return (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-extrabold text-[#0f1e38]">Basic Details</h2>
            <p className="mt-1 text-sm font-semibold text-[#8a9ab5]">Public contact, hours, and services summary.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={profile.phone} onChange={(e) => setProfileDrafts((prev) => ({ ...prev, [item.id]: { ...profile, phone: e.target.value } }))} placeholder="Phone" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]" />
            <input value={profile.email} onChange={(e) => setProfileDrafts((prev) => ({ ...prev, [item.id]: { ...profile, email: e.target.value } }))} placeholder="Email" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]" />
            <input value={profile.website} onChange={(e) => setProfileDrafts((prev) => ({ ...prev, [item.id]: { ...profile, website: e.target.value } }))} placeholder="Website" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]" />
            <input value={profile.openingHours} onChange={(e) => setProfileDrafts((prev) => ({ ...prev, [item.id]: { ...profile, openingHours: e.target.value } }))} placeholder="Opening hours" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]" />
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <MapPin size={15} className="text-[#c8a96e]" />
              <div>
                <p className="text-sm font-extrabold text-[#0f1e38]">Location for map</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={profile.addressLine} onChange={(e) => setProfileDrafts((prev) => ({ ...prev, [item.id]: { ...profile, addressLine: e.target.value } }))} placeholder="Street address / building" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]" />
              <input value={profile.area} onChange={(e) => setProfileDrafts((prev) => ({ ...prev, [item.id]: { ...profile, area: e.target.value } }))} placeholder="Area / locality" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]" />
              <input value={profile.city} onChange={(e) => setProfileDrafts((prev) => ({ ...prev, [item.id]: { ...profile, city: e.target.value } }))} placeholder="City" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]" />
              <input value={profile.district} onChange={(e) => setProfileDrafts((prev) => ({ ...prev, [item.id]: { ...profile, district: e.target.value } }))} placeholder="District" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]" />
              <input value={profile.province} onChange={(e) => setProfileDrafts((prev) => ({ ...prev, [item.id]: { ...profile, province: e.target.value } }))} placeholder="Province" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]" />
              <input value={profile.country} onChange={(e) => setProfileDrafts((prev) => ({ ...prev, [item.id]: { ...profile, country: e.target.value } }))} placeholder="Country code, e.g. NP" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]" />
              <input value={profile.lat} onChange={(e) => setProfileDrafts((prev) => ({ ...prev, [item.id]: { ...profile, lat: e.target.value } }))} placeholder="Latitude optional" inputMode="decimal" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]" />
              <input value={profile.lng} onChange={(e) => setProfileDrafts((prev) => ({ ...prev, [item.id]: { ...profile, lng: e.target.value } }))} placeholder="Longitude optional" inputMode="decimal" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]" />
            </div>
          </div>
          <textarea value={profile.servicesSummary} onChange={(e) => setProfileDrafts((prev) => ({ ...prev, [item.id]: { ...profile, servicesSummary: e.target.value } }))} placeholder="Short services summary patients will understand" rows={4} className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-[#c8a96e]" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-bold text-[#0f1e38]">
              <input type="checkbox" checked={profile.emergencyAvailable} onChange={(e) => setProfileDrafts((prev) => ({ ...prev, [item.id]: { ...profile, emergencyAvailable: e.target.checked } }))} />
              Emergency service available
            </label>
            <button onClick={() => saveProfile(item, profile)} className="h-10 rounded-xl px-5 text-xs font-bold text-white" style={{ background: "#0f1e38" }}>Save details</button>
          </div>
        </div>
      );
    }

    if (activeStep === "department") {
      return (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-extrabold text-[#0f1e38]">Services</h2>
            <p className="mt-1 text-sm font-semibold text-[#8a9ab5]">Add the departments or service lines patients can browse.</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
            <input value={department.name} onChange={(e) => setDepartmentDrafts((prev) => ({ ...prev, [item.id]: { ...department, name: e.target.value } }))} placeholder="Service or department name" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]" />
            <input value={department.overview} onChange={(e) => setDepartmentDrafts((prev) => ({ ...prev, [item.id]: { ...department, overview: e.target.value } }))} placeholder="Short patient-friendly description" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]" />
            <button onClick={() => addDepartment(item)} className="h-11 rounded-xl px-5 text-xs font-bold text-white" style={{ background: "#0f1e38" }}>
              {editTargets[`${item.id}:department`] ? "Save service" : "Add service"}
            </button>
          </div>
          {editTargets[`${item.id}:department`] && (
            <button onClick={() => {
              setEditTargets((prev) => ({ ...prev, [`${item.id}:department`]: null }));
              setDepartmentDrafts((prev) => ({ ...prev, [item.id]: { name: "", overview: "" } }));
            }} className="text-xs font-bold text-[#8a9ab5]">Cancel edit</button>
          )}
          <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white">
            {item.hospital.departments.length === 0 ? (
              <p className="p-5 text-sm font-semibold text-[#8a9ab5]">No services yet.</p>
            ) : item.hospital.departments.map((dept) => (
              <div key={dept.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-bold text-[#0f1e38]">{dept.name}</p>
                  <p className="mt-1 truncate text-xs font-semibold text-[#8a9ab5]">{dept.overview || "No description"}</p>
                </div>
                <span className="flex gap-1">
                  <button onClick={() => {
                    setEditTargets((prev) => ({ ...prev, [`${item.id}:department`]: dept.id }));
                    setDepartmentDrafts((prev) => ({ ...prev, [item.id]: { name: dept.name, overview: dept.overview ?? "" } }));
                  }} className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f7f4ef] text-[#0f1e38]"><Edit3 size={13} /></button>
                  <button onClick={() => requestDelete({
                    key: `${dept.id}-delete`,
                    action: "DELETE_DEPARTMENT",
                    onboardingId: item.id,
                    entityId: dept.id,
                    title: "Delete service?",
                    description: `${dept.name} will be removed from this hospital setup.`,
                  })} className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600"><Trash2 size={13} /></button>
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeStep === "doctor") {
      return (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-extrabold text-[#0f1e38]">Doctors</h2>
            <p className="mt-1 text-sm font-semibold text-[#8a9ab5]">Create the public doctor roster and consultation fees.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
            <div className="rounded-2xl border border-gray-100 bg-white p-3">
              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-[#f7f4ef]">
                {doctor.photoUrl ? (
                  <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url("${doctor.photoUrl}")` }} />
                ) : (
                  <div className="text-center">
                    <ImagePlus size={26} className="mx-auto text-[#c8a96e]" />
                    <p className="mt-2 text-xs font-bold text-[#8a9ab5]">Doctor photo</p>
                  </div>
                )}
              </div>
              <label className="mt-3 flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl text-xs font-bold text-white" style={{ background: "#0f1e38" }}>
                <Upload size={13} /> Upload photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadDoctorPhoto(item, file);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
              <input
                value={doctor.photoUrl}
                onChange={(e) => setDoctorDrafts((prev) => ({ ...prev, [item.id]: { ...doctor, photoUrl: e.target.value } }))}
                placeholder="or paste image URL"
                className="mt-2 h-9 w-full rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold outline-none focus:border-[#c8a96e]"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <input value={doctor.fullName} onChange={(e) => setDoctorDrafts((prev) => ({ ...prev, [item.id]: { ...doctor, fullName: e.target.value } }))} placeholder="Doctor full name" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]" />
              <select value={doctor.departmentId} onChange={(e) => setDoctorDrafts((prev) => ({ ...prev, [item.id]: { ...doctor, departmentId: e.target.value } }))} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]">
                <option value="">No service selected</option>
                {item.hospital.departments.map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
              </select>
              <input value={doctor.positionTitle} onChange={(e) => setDoctorDrafts((prev) => ({ ...prev, [item.id]: { ...doctor, positionTitle: e.target.value } }))} placeholder="Position title" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]" />
              <input value={doctor.licenseNumber} onChange={(e) => setDoctorDrafts((prev) => ({ ...prev, [item.id]: { ...doctor, licenseNumber: e.target.value } }))} placeholder="License number" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]" />
              <input value={doctor.experienceYears} onChange={(e) => setDoctorDrafts((prev) => ({ ...prev, [item.id]: { ...doctor, experienceYears: e.target.value } }))} placeholder="Experience years" type="number" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]" />
              <div className="grid grid-cols-2 gap-3">
                <input value={doctor.feeMin} onChange={(e) => setDoctorDrafts((prev) => ({ ...prev, [item.id]: { ...doctor, feeMin: e.target.value } }))} placeholder="Fee min" type="number" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]" />
                <input value={doctor.feeMax} onChange={(e) => setDoctorDrafts((prev) => ({ ...prev, [item.id]: { ...doctor, feeMax: e.target.value } }))} placeholder="Fee max" type="number" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {editTargets[`${item.id}:doctor`] && (
              <button onClick={() => {
                setEditTargets((prev) => ({ ...prev, [`${item.id}:doctor`]: null }));
                setDoctorDrafts((prev) => ({ ...prev, [item.id]: { fullName: "", departmentId: "", positionTitle: "", licenseNumber: "", experienceYears: "", feeMin: "", feeMax: "", photoUrl: "" } }));
              }} className="h-10 rounded-xl px-4 text-xs font-bold text-[#0f1e38]" style={{ background: "#f7f4ef" }}>Cancel</button>
            )}
            <button onClick={() => addDoctor(item)} className="h-10 rounded-xl px-5 text-xs font-bold text-white" style={{ background: "#0f1e38" }}>
              {editTargets[`${item.id}:doctor`] ? "Save doctor" : "Add doctor"}
            </button>
          </div>
          <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white">
            {item.hospital.doctors.length === 0 ? (
              <p className="p-5 text-sm font-semibold text-[#8a9ab5]">No doctors yet.</p>
            ) : item.hospital.doctors.map(({ doctor: doc, positionTitle }) => (
              <div key={doc.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-[#f7f4ef]">
                    {doc.media[0]?.url ? (
                      <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url("${doc.media[0].url}")` }} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[#c8a96e]"><UserRound size={16} /></div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[#0f1e38]">{doc.fullName}</p>
                    <p className="mt-1 truncate text-xs font-semibold text-[#8a9ab5]">{positionTitle || "No position"}{doc.feeMin ? ` - EUR ${doc.feeMin}` : ""}</p>
                  </div>
                </div>
                <span className="flex gap-1">
                  <button onClick={() => {
                    setEditTargets((prev) => ({ ...prev, [`${item.id}:doctor`]: doc.id }));
                    setDoctorDrafts((prev) => ({ ...prev, [item.id]: {
                      fullName: doc.fullName,
                      departmentId: doc.departments[0]?.departmentId ?? "",
                      positionTitle: positionTitle ?? "",
                      licenseNumber: doc.licenseNumber ?? "",
                      experienceYears: doc.experienceYears === null ? "" : String(doc.experienceYears),
                      feeMin: doc.feeMin === null ? "" : String(doc.feeMin),
                      feeMax: doc.feeMax === null ? "" : String(doc.feeMax),
                      photoUrl: doc.media[0]?.url ?? "",
                    } }));
                  }} className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f7f4ef] text-[#0f1e38]"><Edit3 size={13} /></button>
                  <button onClick={() => requestDelete({
                    key: `${doc.id}-delete`,
                    action: "DELETE_DOCTOR",
                    onboardingId: item.id,
                    entityId: doc.id,
                    title: "Delete doctor?",
                    description: `${doc.fullName} and their availability windows will be removed from this hospital setup.`,
                  })} className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600"><Trash2 size={13} /></button>
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeStep === "schedule") {
      const startMinutes = timeToMinutes(schedule.startTime);
      const endMinutes = timeToMinutes(schedule.endTime);
      const slotMinutes = Number(schedule.slotDurationMinutes);
      const previewTimes = bookingTimeLabels(schedule.startTime, schedule.endTime, slotMinutes);
      const canSaveSchedule = Boolean(schedule.doctorId) && startMinutes !== null && endMinutes !== null && endMinutes > startMinutes && previewTimes.length > 0;
      const sortedSlots = [...item.hospital.availabilitySlots].sort((a, b) => {
        const dayDiff = daySortValue(a.dayOfWeek) - daySortValue(b.dayOfWeek);
        if (dayDiff !== 0) return dayDiff;
        const timeDiff = a.startTime.localeCompare(b.startTime);
        if (timeDiff !== 0) return timeDiff;
        return a.doctor.fullName.localeCompare(b.doctor.fullName);
      });
      const slotsByDay = DAY_OPTIONS.map((day) => ({
        ...day,
        slots: sortedSlots.filter((slot) => String(slot.dayOfWeek) === day.value),
      })).filter((day) => day.slots.length > 0);
      const applyWindow = (startTime: string, endTime: string) => {
        setScheduleDrafts((prev) => ({ ...prev, [item.id]: { ...schedule, startTime, endTime } }));
      };

      return (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-extrabold text-[#0f1e38]">Availability</h2>
            <p className="mt-1 text-sm font-semibold text-[#8a9ab5]">Set when each doctor is available; the slot length creates the patient booking times inside that window.</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
              <select value={schedule.doctorId} onChange={(e) => setScheduleDrafts((prev) => ({ ...prev, [item.id]: { ...schedule, doctorId: e.target.value } }))} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]">
                <option value="">Select doctor</option>
                {item.hospital.doctors.map(({ doctor: doc }) => <option key={doc.id} value={doc.id}>{doc.fullName}</option>)}
              </select>
              <select value={schedule.dayOfWeek} onChange={(e) => setScheduleDrafts((prev) => ({ ...prev, [item.id]: { ...schedule, dayOfWeek: e.target.value } }))} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]">
                {DAY_OPTIONS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
              </select>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_150px]">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#8a9ab5]">From</span>
                  <input value={schedule.startTime} onChange={(e) => setScheduleDrafts((prev) => ({ ...prev, [item.id]: { ...schedule, startTime: e.target.value } }))} type="time" className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#8a9ab5]">Until</span>
                  <input value={schedule.endTime} onChange={(e) => setScheduleDrafts((prev) => ({ ...prev, [item.id]: { ...schedule, endTime: e.target.value } }))} type="time" className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#8a9ab5]">Visit type</span>
                  <select value={schedule.mode} onChange={(e) => setScheduleDrafts((prev) => ({ ...prev, [item.id]: { ...schedule, mode: e.target.value as "PHYSICAL" | "ONLINE" } }))} className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]">
                    <option value="PHYSICAL">Physical</option>
                    <option value="ONLINE">Online</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#8a9ab5]">Each booking</span>
                  <select value={schedule.slotDurationMinutes} onChange={(e) => setScheduleDrafts((prev) => ({ ...prev, [item.id]: { ...schedule, slotDurationMinutes: e.target.value } }))} className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]">
                    <option value="15">15 min</option>
                    <option value="20">20 min</option>
                    <option value="30">30 min</option>
                    <option value="45">45 min</option>
                    <option value="60">60 min</option>
                  </select>
                </label>
              </div>
              <button disabled={!canSaveSchedule || !!actionLoading} onClick={() => addSchedule(item)} className="self-end h-11 rounded-xl px-5 text-xs font-bold text-white disabled:opacity-45" style={{ background: "#0f1e38" }}>
                {editTargets[`${item.id}:schedule`] ? "Save" : "Add window"}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Morning OPD", start: "09:00", end: "12:00" },
                  { label: "Afternoon", start: "13:00", end: "16:00" },
                  { label: "Evening", start: "17:00", end: "20:00" },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => applyWindow(preset.start, preset.end)}
                    className="rounded-full border border-gray-100 bg-[#f7f4ef] px-3 py-1.5 text-xs font-bold text-[#0f1e38]"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="max-w-xl text-right">
                <p className={`text-xs font-bold ${canSaveSchedule ? "text-[#0f1e38]" : "text-red-500"}`}>
                  {canSaveSchedule ? `Open booking times every ${DAYS[Number(schedule.dayOfWeek)]}` : "Choose a doctor and a valid time window"}
                </p>
                {previewTimes.length > 0 && (
                  <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                    {previewTimes.map((time) => (
                      <span key={time} className="rounded-full bg-[#f7f4ef] px-2.5 py-1 text-[11px] font-bold text-[#0f1e38]">{time}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {editTargets[`${item.id}:schedule`] && (
              <button onClick={() => setEditTargets((prev) => ({ ...prev, [`${item.id}:schedule`]: null }))} className="h-10 rounded-xl px-4 text-xs font-bold text-[#0f1e38]" style={{ background: "#f7f4ef" }}>Cancel</button>
            )}
          </div>
          <div className="space-y-3">
            {slotsByDay.length === 0 ? (
              <p className="p-5 text-sm font-semibold text-[#8a9ab5]">No availability windows yet.</p>
            ) : slotsByDay.map((day) => (
              <div key={day.value} className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
                <div className="border-b border-gray-100 bg-[#f7f4ef] px-4 py-3">
                  <p className="text-sm font-extrabold text-[#0f1e38]">{day.label}</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {day.slots.map((slot) => {
                    const slotTimes = bookingTimeLabels(slot.startTime, slot.endTime, slot.slotDurationMinutes);
              return (
                    <div key={slot.id} className="flex items-start justify-between gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-[#0f1e38]">{slot.doctor.fullName}</p>
                        <p className="mt-1 text-xs font-semibold text-[#8a9ab5]">
                          {formatTimeLabel(slot.startTime)} to {formatTimeLabel(slot.endTime)} - {slot.slotDurationMinutes}-min {slot.mode.toLowerCase()} bookings
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {slotTimes.map((time) => (
                            <span key={time} className="rounded-full border border-gray-100 bg-[#f7f4ef] px-2.5 py-1 text-[11px] font-bold text-[#0f1e38]">{time}</span>
                          ))}
                        </div>
                      </div>
                      <span className="flex gap-1">
                        <button onClick={() => {
                          setEditTargets((prev) => ({ ...prev, [`${item.id}:schedule`]: slot.id }));
                          setScheduleDrafts((prev) => ({ ...prev, [item.id]: {
                            doctorId: slot.doctorId,
                            dayOfWeek: String(slot.dayOfWeek),
                            mode: slot.mode,
                            startTime: slot.startTime,
                            endTime: slot.endTime,
                            slotDurationMinutes: String(slot.slotDurationMinutes),
                          } }));
                        }} className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f7f4ef] text-[#0f1e38]"><Edit3 size={13} /></button>
                        <button onClick={() => requestDelete({
                          key: `${slot.id}-delete`,
                          action: "DELETE_SCHEDULE",
                          onboardingId: item.id,
                          entityId: slot.id,
                          title: "Delete availability window?",
                          description: `${slot.doctor.fullName}'s ${DAYS[slot.dayOfWeek]} ${formatTimeLabel(slot.startTime)} to ${formatTimeLabel(slot.endTime)} booking window will be removed.`,
                        })} className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600"><Trash2 size={13} /></button>
                      </span>
                    </div>
                  );
                })}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeStep === "package") {
      return (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-extrabold text-[#0f1e38]">Health Packages</h2>
            <p className="mt-1 text-sm font-semibold text-[#8a9ab5]">Add package names, descriptions, and patient-facing prices.</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_170px]">
              <input value={packageDraft.title} onChange={(e) => setPackageDrafts((prev) => ({ ...prev, [item.id]: { ...packageDraft, title: e.target.value } }))} placeholder="Package title, e.g. Executive Health Checkup" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]" />
              <div className="flex h-11 items-center rounded-xl border border-gray-200 bg-white px-3 focus-within:border-[#c8a96e]">
                <span className="text-xs font-extrabold text-[#8a9ab5]">EUR</span>
                <input value={packageDraft.price} onChange={(e) => setPackageDrafts((prev) => ({ ...prev, [item.id]: { ...packageDraft, price: e.target.value } }))} placeholder="Price" type="number" className="ml-2 min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" />
              </div>
            </div>
            <textarea
              value={packageDraft.description}
              onChange={(e) => setPackageDrafts((prev) => ({ ...prev, [item.id]: { ...packageDraft, description: e.target.value } }))}
              placeholder="What is included? Add tests, consultation notes, preparation instructions..."
              rows={4}
              className="mt-3 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-[#c8a96e]"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {["Basic Health Package", "Full Body Checkup", "Senior Citizen Package"].map((title) => (
                  <button
                    key={title}
                    onClick={() => setPackageDrafts((prev) => ({ ...prev, [item.id]: { ...packageDraft, title } }))}
                    className="rounded-full border border-gray-100 bg-[#f7f4ef] px-3 py-1.5 text-xs font-bold text-[#0f1e38]"
                  >
                    {title}
                  </button>
                ))}
              </div>
              <button onClick={() => addPackage(item)} className="h-10 rounded-xl px-5 text-xs font-bold text-white" style={{ background: "#0f1e38" }}>
                {editTargets[`${item.id}:package`] ? "Save package" : "Add package"}
              </button>
            </div>
          </div>
          {editTargets[`${item.id}:package`] && (
            <button onClick={() => {
              setEditTargets((prev) => ({ ...prev, [`${item.id}:package`]: null }));
              setPackageDrafts((prev) => ({ ...prev, [item.id]: { title: "", description: "", price: "" } }));
            }} className="text-xs font-bold text-[#8a9ab5]">Cancel edit</button>
          )}
          <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white">
            {item.hospital.packages.length === 0 ? (
              <p className="p-5 text-sm font-semibold text-[#8a9ab5]">No health packages yet.</p>
            ) : item.hospital.packages.map((pkg) => (
              <div key={pkg.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-bold text-[#0f1e38]">{pkg.title}</p>
                  <p className="mt-1 text-xs font-semibold text-[#8a9ab5]">{pkg.price === null ? "No price" : `EUR ${pkg.price}`}</p>
                  {pkg.description && <p className="mt-1 line-clamp-2 text-xs text-[#8a9ab5]">{pkg.description}</p>}
                </div>
                <span className="flex gap-1">
                  <button onClick={() => {
                    setEditTargets((prev) => ({ ...prev, [`${item.id}:package`]: pkg.id }));
                    setPackageDrafts((prev) => ({ ...prev, [item.id]: { title: pkg.title, description: pkg.description ?? "", price: pkg.price === null ? "" : String(pkg.price) } }));
                  }} className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f7f4ef] text-[#0f1e38]"><Edit3 size={13} /></button>
                  <button onClick={() => requestDelete({
                    key: `${pkg.id}-delete`,
                    action: "DELETE_PACKAGE",
                    onboardingId: item.id,
                    entityId: pkg.id,
                    title: "Delete health package?",
                    description: `${pkg.title} will be removed from the public hospital listing.`,
                  })} className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600"><Trash2 size={13} /></button>
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeStep === "media") {
      return (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-extrabold text-[#0f1e38]">Logo & Photos</h2>
            <p className="mt-1 text-sm font-semibold text-[#8a9ab5]">Add public images that make the listing feel trustworthy.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
            <div className="rounded-2xl border border-gray-100 bg-white p-3">
              <div className="flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-[#f7f4ef]">
                {mediaDraft.url ? (
                  <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url("${mediaDraft.url}")` }} />
                ) : (
                  <div className="text-center">
                    <ImagePlus size={26} className="mx-auto text-[#c8a96e]" />
                    <p className="mt-2 text-xs font-bold text-[#8a9ab5]">Logo or photo</p>
                  </div>
                )}
              </div>
              <label className="mt-3 flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl text-xs font-bold text-white" style={{ background: "#0f1e38" }}>
                <Upload size={13} /> Upload image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadHospitalImage(item, file);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
            <div className="space-y-3">
              <input value={mediaDraft.url} onChange={(e) => setMediaDrafts((prev) => ({ ...prev, [item.id]: { ...mediaDraft, url: e.target.value } }))} placeholder="or paste image URL" className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]" />
              <input value={mediaDraft.altText} onChange={(e) => setMediaDrafts((prev) => ({ ...prev, [item.id]: { ...mediaDraft, altText: e.target.value } }))} placeholder="Image label, e.g. Main entrance" className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]" />
              <label className="flex items-center gap-2 text-sm font-bold text-[#0f1e38]">
                <input type="checkbox" checked={mediaDraft.isPrimary} onChange={(e) => setMediaDrafts((prev) => ({ ...prev, [item.id]: { ...mediaDraft, isPrimary: e.target.checked } }))} />
                Use as primary hospital image
              </label>
              <button onClick={() => addMedia(item)} className="h-10 rounded-xl px-5 text-xs font-bold text-white" style={{ background: "#0f1e38" }}>
                {editTargets[`${item.id}:media`] ? "Save image" : "Add image"}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {editTargets[`${item.id}:media`] && (
              <button onClick={() => {
                setEditTargets((prev) => ({ ...prev, [`${item.id}:media`]: null }));
                setMediaDrafts((prev) => ({ ...prev, [item.id]: { url: "", altText: "", isPrimary: false } }));
              }} className="text-xs font-bold text-[#8a9ab5]">Cancel edit</button>
            )}
          </div>
          {item.hospital.media.length === 0 ? (
            <p className="rounded-2xl border border-gray-100 bg-white p-5 text-sm font-semibold text-[#8a9ab5]">No logo or photos yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {item.hospital.media.map((media) => (
                <div key={media.id} className="flex gap-3 rounded-2xl border border-gray-100 bg-white p-3">
                  <div aria-label={media.altText ?? "Hospital photo"} className="h-20 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-[#f7f4ef] bg-cover bg-center" style={{ backgroundImage: `url("${media.url}")` }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[#0f1e38]">{media.altText || "Hospital photo"}</p>
                        <p className="mt-1 truncate text-xs font-semibold text-[#8a9ab5]">{media.url}</p>
                      </div>
                      {media.isPrimary && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-700">Primary</span>}
                    </div>
                    <div className="mt-3 flex gap-1">
                      <button onClick={() => {
                        setEditTargets((prev) => ({ ...prev, [`${item.id}:media`]: media.id }));
                        setMediaDrafts((prev) => ({ ...prev, [item.id]: { url: media.url, altText: media.altText ?? "", isPrimary: media.isPrimary } }));
                      }} className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f7f4ef] text-[#0f1e38]"><Edit3 size={13} /></button>
                      <button onClick={() => requestDelete({
                        key: `${media.id}-delete`,
                        action: "DELETE_MEDIA",
                        onboardingId: item.id,
                        entityId: media.id,
                        title: "Delete image?",
                        description: `${media.altText || "This hospital image"} will be removed from the public listing.`,
                      })} className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (activeStep === "owner") {
      return (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-extrabold text-[#0f1e38]">Main Hospital Admin</h2>
          <p className="mt-1 text-sm font-semibold text-[#8a9ab5]">Assign the first person who will manage this hospital after launch.</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <p className="text-sm font-extrabold text-[#0f1e38]">Owner access only</p>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-[#8a9ab5]">This gives one person owner access. They can add managers, receptionists, doctors, and staff later from hospital admin.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input value={ownerDrafts[item.id] ?? ""} onChange={(e) => setOwnerDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))} placeholder="Existing user email" className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#c8a96e]" />
          <button onClick={() => assignOwner(item)} className="h-11 rounded-xl px-5 text-xs font-bold text-white" style={{ background: "#0f1e38" }}>Assign main admin</button>
        </div>
        <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white">
          {item.hospital.memberships.length === 0 ? (
            <p className="p-5 text-sm font-semibold text-[#8a9ab5]">No main hospital admin assigned yet.</p>
          ) : item.hospital.memberships.map((membership) => (
            <div key={membership.id} className="p-4">
              <p className="font-bold text-[#0f1e38]">{membership.user.fullName}</p>
              <p className="mt-1 text-xs font-semibold text-[#8a9ab5]">{membership.user.email}</p>
            </div>
          ))}
        </div>
      </div>
      );
    }

    const requiredChecks = item.checklist.filter((check) => check.isRequired);
    const completedChecks = requiredChecks.filter((check) => check.isCompleted);
    const readinessPercent = requiredChecks.length > 0 ? Math.round((completedChecks.length / requiredChecks.length) * 100) : 0;
    const primaryMedia = item.hospital.media.find((media) => media.isPrimary) ?? item.hospital.media[0];
    const mainAdmin = item.hospital.memberships[0]?.user;
    const sortedReviewSlots = [...item.hospital.availabilitySlots].sort((a, b) => {
      const dayDiff = daySortValue(a.dayOfWeek) - daySortValue(b.dayOfWeek);
      if (dayDiff !== 0) return dayDiff;
      const timeDiff = a.startTime.localeCompare(b.startTime);
      if (timeDiff !== 0) return timeDiff;
      return a.doctor.fullName.localeCompare(b.doctor.fullName);
    });
    const reviewSlotsByDay = DAY_OPTIONS.map((day) => ({
      ...day,
      slots: sortedReviewSlots.filter((slot) => String(slot.dayOfWeek) === day.value),
    })).filter((day) => day.slots.length > 0);
    const missingChecks = requiredChecks.filter((check) => !check.isCompleted);
    const reviewStats = [
      { label: "Services", value: item.hospital.departments.length },
      { label: "Doctors", value: item.hospital.doctors.length },
      { label: "Booking windows", value: item.hospital.availabilitySlots.length },
      { label: "Packages", value: item.hospital.packages.length },
      { label: "Images", value: item.hospital.media.length },
      { label: "Admin", value: mainAdmin ? "Yes" : "No" },
    ];
    const listingRows = [
      ["Phone", item.hospital.phone || "Not added"],
      ["Email", item.hospital.email || "Not added"],
      ["Website", item.hospital.website || "Not added"],
      ["Opening hours", item.hospital.openingHours || "Not added"],
      ["Emergency", item.hospital.emergencyAvailable ? "Available" : "Not marked"],
    ];
    const locationLabel = formatLocationLabel(item.hospital.location);
    const hasCoordinates = item.hospital.location.lat !== null && item.hospital.location.lng !== null;
    const mapSrc = hasCoordinates
      ? `https://maps.google.com/maps?q=${item.hospital.location.lat},${item.hospital.location.lng}&z=15&output=embed`
      : `https://maps.google.com/maps?q=${encodeURIComponent(locationLabel)}&output=embed`;

    return (
      <div className="space-y-5">
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8a9ab5]">Final approval</p>
              <h2 className="mt-1 text-2xl font-extrabold text-[#0f1e38]">Review & launch</h2>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-[#6b7a96]">
                Confirm the public listing, booking rules, health packages, photos, and owner access before the hospital goes live.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {reviewStats.map((stat) => (
                  <div key={stat.label} className="min-h-[74px] rounded-2xl bg-[#f7f4ef] px-3 py-3">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-[#8a9ab5]">{stat.label}</p>
                    <p className="mt-1 text-base font-extrabold text-[#0f1e38]">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-3xl bg-[#0f1e38] p-4 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/55">Readiness</p>
                    <p className="mt-1 text-base font-extrabold">{completedChecks.length}/{requiredChecks.length} required</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${missingChecks.length === 0 ? "bg-emerald-100 text-emerald-800" : "bg-[#fff7ed] text-[#9a3412]"}`}>
                    {missingChecks.length === 0 ? "Ready" : "Blocked"}
                  </span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/12">
                  <div className="h-full rounded-full bg-[#c8a96e]" style={{ width: `${readinessPercent}%` }} />
                </div>
                {missingChecks.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {missingChecks.slice(0, 3).map((check) => (
                      <button key={check.id} onClick={() => toggleChecklist(item, check)} className="flex w-full items-center gap-2 text-left text-xs font-bold text-white/75">
                        <Circle size={12} /> {checklistLabel(check.title)}
                      </button>
                    ))}
                    {missingChecks.length > 3 && <p className="text-xs font-semibold text-white/55">+{missingChecks.length - 3} more required</p>}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-gray-100 bg-[#f7f4ef]">
                <button
                  onClick={() => setNotesOpen((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span>
                    <span className="block text-sm font-extrabold text-[#0f1e38]">Setup notes</span>
                    <span className="mt-0.5 block text-xs font-semibold text-[#8a9ab5]">{item.notes.length} activity note{item.notes.length === 1 ? "" : "s"}</span>
                  </span>
                  <ChevronRight size={16} className={`text-[#8a9ab5] transition-transform ${notesOpen[item.id] ? "rotate-90" : ""}`} />
                </button>
                {notesOpen[item.id] && (
                  <div className="space-y-3 border-t border-gray-200 p-4">
                    <textarea value={internalDrafts[item.id] ?? item.internalNotes ?? ""} onChange={(e) => setInternalDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))} rows={3} className="w-full resize-none rounded-2xl border border-gray-100 bg-white px-3 py-2 text-xs font-semibold text-[#0f1e38] outline-none placeholder:text-gray-400" placeholder="Internal setup notes..." />
                    <button onClick={() => saveInternalNotes(item)} className="h-8 rounded-xl px-3 text-xs font-bold" style={{ background: "#fff", color: "#0f1e38" }}>Save notes</button>
                    <div className="max-h-36 space-y-2 overflow-y-auto pr-1">
                      {item.notes.length === 0 ? (
                        <p className="rounded-2xl bg-white px-3 py-3 text-xs font-semibold text-[#8a9ab5]">No notes yet.</p>
                      ) : item.notes.map((note) => (
                        <div key={note.id} className="rounded-2xl bg-white px-3 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-bold text-[#0f1e38]">{note.title || "Note"}</p>
                            <p className="text-[10px] font-semibold text-[#8a9ab5]">{formatDateTime(note.createdAt)}</p>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-[#3b4a63]">{note.body}</p>
                        </div>
                      ))}
                    </div>
                    <textarea value={noteDrafts[item.id] ?? ""} onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))} rows={2} placeholder="Add a note..." className="w-full resize-none rounded-2xl border border-gray-100 bg-white px-3 py-2 text-xs font-semibold text-[#0f1e38] outline-none placeholder:text-gray-400" />
                    <button onClick={() => addNote(item)} className="flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-white" style={{ background: "#0f1e38" }}>
                      <FileText size={12} /> Add note
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
            <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
              <div className="grid min-h-[220px] lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#f7f4ef] px-2.5 py-1 text-[10px] font-bold uppercase text-[#9a7c3f]">{TYPE_LABELS[item.hospital.type]}</span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-700">{item.hospital.emergencyAvailable ? "Emergency available" : "Regular listing"}</span>
                  </div>
                  <h3 className="mt-4 text-3xl font-extrabold leading-tight text-[#0f1e38]">{item.hospital.name}</h3>
                  <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-[#6b7a96]">{item.hospital.servicesSummary || "No public services summary added."}</p>
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {listingRows.map(([label, value]) => (
                      <div key={label} className="rounded-2xl bg-[#f7f4ef] px-3 py-2.5">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[#8a9ab5]">{label}</p>
                        <p className="mt-1 truncate text-sm font-bold text-[#0f1e38]">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-2xl bg-[#f7f4ef] px-3 py-3">
                    <div className="flex items-start gap-2">
                      <MapPin size={14} className="mt-0.5 flex-shrink-0 text-[#c8a96e]" />
                      <div className="min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[#8a9ab5]">Map location</p>
                        <p className="mt-1 text-sm font-bold leading-relaxed text-[#0f1e38]">{locationLabel}</p>
                      </div>
                    </div>
                  </div>
                </div>
                {primaryMedia ? (
                  <div aria-label={primaryMedia.altText ?? "Primary hospital image"} className="min-h-[220px] bg-[#f7f4ef] bg-cover bg-center" style={{ backgroundImage: `url("${primaryMedia.url}")` }} />
                ) : (
                  <div className="flex min-h-[220px] items-center justify-center bg-[#f7f4ef] text-[#c8a96e]">
                    <ImageIcon size={36} />
                  </div>
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#8a9ab5]">Location</p>
                  <h3 className="mt-1 text-lg font-extrabold text-[#0f1e38]">Map preview</h3>
                </div>
                <p className="max-w-xl text-right text-xs font-semibold leading-relaxed text-[#8a9ab5]">{locationLabel}</p>
              </div>
              <iframe
                title={`${item.hospital.name} map`}
                src={mapSrc}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-72 w-full border-0"
              />
            </section>

            <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#8a9ab5]">Clinical setup</p>
                  <h3 className="mt-1 text-lg font-extrabold text-[#0f1e38]">Services, doctors, and booking times</h3>
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
                <div className="space-y-2">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-[#8a9ab5]">Services</p>
                  {item.hospital.departments.length === 0 ? (
                    <p className="rounded-2xl bg-[#f7f4ef] px-3 py-3 text-xs font-semibold text-[#8a9ab5]">No services added.</p>
                  ) : item.hospital.departments.map((dept) => (
                    <div key={dept.id} className="rounded-2xl bg-[#f7f4ef] px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-bold text-[#0f1e38]">{dept.name}</p>
                        {dept.overview && dept.overview.length > 90 && (
                          <button
                            onClick={() => setExpandedServices((prev) => ({ ...prev, [dept.id]: !prev[dept.id] }))}
                            className="flex-shrink-0 text-[11px] font-extrabold text-[#9a7c3f]"
                          >
                            {expandedServices[dept.id] ? "Show less" : "Read more"}
                          </button>
                        )}
                      </div>
                      <p className="mt-1 text-xs font-semibold leading-relaxed text-[#8a9ab5]">
                        {expandedServices[dept.id] ? dept.overview : compactText(dept.overview)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-[#8a9ab5]">Doctors</p>
                  {item.hospital.doctors.length === 0 ? (
                    <p className="rounded-2xl bg-[#f7f4ef] px-3 py-3 text-xs font-semibold text-[#8a9ab5]">No doctors added.</p>
                  ) : item.hospital.doctors.map(({ doctor: doc, positionTitle }) => (
                    <div key={doc.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 px-3 py-3">
                      <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-2xl bg-[#f7f4ef]">
                        {doc.media[0]?.url ? <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url("${doc.media[0].url}")` }} /> : <div className="flex h-full w-full items-center justify-center text-[#c8a96e]"><UserRound size={16} /></div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[#0f1e38]">{doc.fullName}</p>
                        <p className="mt-0.5 truncate text-xs font-semibold text-[#8a9ab5]">{positionTitle || "No position"}{doc.licenseNumber ? ` - ${doc.licenseNumber}` : ""}</p>
                      </div>
                      <p className="text-xs font-bold text-[#0f1e38]">{doc.feeMin || doc.feeMax ? `EUR ${doc.feeMin ?? doc.feeMax}${doc.feeMax ? `-${doc.feeMax}` : ""}` : "No fee"}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 border-t border-gray-100 pt-5">
                <p className="mb-3 text-xs font-extrabold uppercase tracking-widest text-[#8a9ab5]">Weekly booking times</p>
                {reviewSlotsByDay.length === 0 ? (
                  <p className="rounded-2xl bg-[#f7f4ef] px-3 py-3 text-xs font-semibold text-[#8a9ab5]">No booking windows added.</p>
                ) : (
                  <div className="space-y-3">
                    {reviewSlotsByDay.map((day) => (
                      <div key={day.value} className="rounded-2xl border border-gray-100 p-3">
                        <p className="text-sm font-extrabold text-[#0f1e38]">{day.label}</p>
                        <div className="mt-3 space-y-3">
                          {day.slots.map((slot) => {
                            const slotTimes = bookingTimeLabels(slot.startTime, slot.endTime, slot.slotDurationMinutes);
                            return (
                              <div key={slot.id} className="rounded-2xl bg-[#f7f4ef] px-3 py-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-sm font-bold text-[#0f1e38]">{slot.doctor.fullName}</p>
                                  <p className="text-xs font-bold text-[#8a9ab5]">{formatTimeLabel(slot.startTime)} to {formatTimeLabel(slot.endTime)} - {slot.mode.toLowerCase()}</p>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {slotTimes.map((time) => (
                                    <span key={time} className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#0f1e38]">{time}</span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#8a9ab5]">Patient offers</p>
                <h3 className="mt-1 text-lg font-extrabold text-[#0f1e38]">Health packages</h3>
                <div className="mt-4 space-y-2">
                  {item.hospital.packages.length === 0 ? (
                    <p className="rounded-2xl bg-[#f7f4ef] px-3 py-3 text-xs font-semibold text-[#8a9ab5]">No health packages added.</p>
                  ) : item.hospital.packages.map((pkg) => (
                    <div key={pkg.id} className="overflow-hidden rounded-2xl bg-[#f7f4ef]">
                      <button
                        onClick={() => setExpandedPackages((prev) => ({ ...prev, [pkg.id]: !prev[pkg.id] }))}
                        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-[#0f1e38]">{pkg.title}</span>
                          <span className="mt-1 block text-xs font-bold text-[#8a9ab5]">{pkg.price === null ? "No price" : `EUR ${pkg.price}`}</span>
                        </span>
                        <ChevronRight size={15} className={`flex-shrink-0 text-[#8a9ab5] transition-transform ${expandedPackages[pkg.id] ? "rotate-90" : ""}`} />
                      </button>
                      {expandedPackages[pkg.id] && (
                        <div className="border-t border-white px-3 py-3">
                          <p className="text-xs font-semibold leading-relaxed text-[#6b7a96]">{pkg.description || "No package description added."}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#8a9ab5]">Access handoff</p>
                <h3 className="mt-1 text-lg font-extrabold text-[#0f1e38]">Main hospital admin</h3>
                {mainAdmin ? (
                  <div className="mt-4 rounded-2xl bg-[#f7f4ef] px-3 py-3">
                    <p className="text-sm font-bold text-[#0f1e38]">{mainAdmin.fullName}</p>
                    <p className="mt-1 text-xs font-semibold text-[#8a9ab5]">{mainAdmin.email}</p>
                  </div>
                ) : (
                  <p className="mt-4 rounded-2xl bg-[#fff7ed] px-3 py-3 text-xs font-semibold text-[#9a3412]">No main hospital admin assigned.</p>
                )}
                <p className="mt-3 text-xs font-semibold leading-relaxed text-[#8a9ab5]">This owner can add managers, receptionists, doctors, and staff after launch.</p>
              </div>
            </section>

            <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#8a9ab5]">Public gallery</p>
                  <h3 className="mt-1 text-lg font-extrabold text-[#0f1e38]">Logo & photos</h3>
                </div>
                <p className="text-xs font-bold text-[#8a9ab5]">{item.hospital.media.length} image{item.hospital.media.length === 1 ? "" : "s"}</p>
              </div>
              {item.hospital.media.length === 0 ? (
                <p className="rounded-2xl bg-[#f7f4ef] px-3 py-3 text-xs font-semibold text-[#8a9ab5]">No images added.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {item.hospital.media.map((media) => (
                    <div key={media.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-[#f7f4ef]">
                      <div aria-label={media.altText ?? "Hospital image"} className="aspect-video bg-cover bg-center" style={{ backgroundImage: `url("${media.url}")` }} />
                      <div className="flex items-center justify-between gap-2 px-3 py-2">
                        <p className="truncate text-xs font-bold text-[#0f1e38]">{media.altText || "Hospital image"}</p>
                        {media.isPrimary && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-700">Primary</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
        </div>
      </div>
    );
  };

  const activeSetup = expandedId ? data?.onboardings.find((item) => item.id === expandedId) ?? null : null;
  if (activeSetup) {
    const summary = getSetupSummary(activeSetup);
    const name = summary.name;
    const type = summary.type;
    const required = activeSetup.checklist.filter((check) => check.isRequired);
    const completed = required.filter((check) => check.isCompleted);
    const activeStep = activeDataSteps[activeSetup.id] ?? "request";
    const activeStepIndex = Math.max(0, DATA_STEPS.findIndex((step) => step.id === activeStep));
    const activeStepMeta = DATA_STEPS[activeStepIndex] ?? DATA_STEPS[0];
    const previousStep = DATA_STEPS[activeStepIndex - 1];
    const nextStep = DATA_STEPS[activeStepIndex + 1];
    const canPublish = data?.canManage && activeSetup.hospital && activeSetup.status !== "PUBLISHED";
    const isPublished = activeSetup.status === "PUBLISHED";

    return (
      <div className="min-h-full space-y-4">
        <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <button
                onClick={() => setExpandedId(null)}
                className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-bold"
                style={{ background: "#f7f4ef", color: "#0f1e38" }}
              >
                <ChevronLeft size={14} /> Back
              </button>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-lg font-extrabold text-[#0f1e38]">{name}</h1>
                  <StatusBadge status={activeSetup.status} />
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "rgba(200,169,110,.12)", color: "#9a7c3f" }}>
                    {TYPE_LABELS[type]}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${activeSetup.hospital ? "text-emerald-700" : "text-gray-500"}`} style={{ background: activeSetup.hospital ? "rgba(16,185,129,.1)" : "rgba(107,114,128,.09)" }}>
                    {activeSetup.hospital ? "Record linked" : "No record"}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-[#8a9ab5]">
                  {summary.contactName && <span>Contact: {summary.contactName}</span>}
                  {summary.phone && <span>Phone: {summary.phone}</span>}
                  {summary.email && <span>Email: {summary.email}</span>}
                  {summary.place && <span>Location: {summary.place}</span>}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-44">
                <ProgressBar completed={completed.length} total={required.length} />
              </div>
              <button
                onClick={() => fetchOnboardings()}
                className="flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-bold"
                style={{ background: "#f7f4ef", color: "#0f1e38" }}
              >
                <RefreshCw size={13} /> Refresh
              </button>
              {canPublish ? (
                <button
                  onClick={() => runPatch(`${activeSetup.id}-publish`, { action: "PUBLISH", onboardingId: activeSetup.id })}
                  disabled={!!actionLoading}
                  className="flex h-9 items-center gap-2 rounded-xl px-4 text-xs font-bold text-white disabled:opacity-50"
                  style={{ background: "#059669" }}
                >
                  <Rocket size={13} /> Make live
                </button>
              ) : isPublished ? (
                <span className="flex h-9 items-center gap-2 rounded-xl bg-emerald-50 px-4 text-xs font-bold text-emerald-700">
                  <CheckCircle2 size={13} /> Live
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-gray-100 bg-white p-4 xl:sticky xl:top-4 xl:self-start">
            <div className="border-b border-gray-100 px-1 pb-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8a9ab5]">
                Step {activeStepIndex + 1} of {DATA_STEPS.length}
              </p>
              <p className="mt-1 text-base font-extrabold text-[#0f1e38]">{activeStepMeta.label}</p>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-[#8a9ab5]">{activeStepMeta.helper}</p>
            </div>
            <div className="mt-3 space-y-1.5">
              {DATA_STEPS.map((step, index) => {
                const checklistItem = step.match ? activeSetup.checklist.find((check) => check.title === step.match) : null;
                const active = activeStep === step.id;
                const done = step.id === "request" || !!checklistItem?.isCompleted;
                return (
                  <button
                    key={step.id}
                    onClick={() => setActiveDataSteps((prev) => ({ ...prev, [activeSetup.id]: step.id }))}
                    className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-all"
                    style={{
                      background: active ? "#0f1e38" : done ? "rgba(16,185,129,.06)" : "transparent",
                      color: active ? "#fff" : "#0f1e38",
                    }}
                  >
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-extrabold" style={{ background: active ? "rgba(200,169,110,.18)" : "#f7f4ef", color: active ? "#c8a96e" : "#8a9ab5" }}>
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-extrabold">{step.label}</span>
                      <span className={active ? "block truncate text-[11px] font-semibold text-white/55" : "block truncate text-[11px] font-semibold text-[#8a9ab5]"}>{step.helper}</span>
                    </span>
                    {done ? <CheckCircle2 size={15} className="text-emerald-500" /> : <Circle size={15} className={active ? "text-white/35" : "text-gray-300"} />}
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="min-w-0 rounded-3xl border border-gray-100 bg-[#fcfbf8] p-6 shadow-sm">
            {renderSetupStep(activeSetup)}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
              <button
                onClick={() => previousStep && setActiveDataSteps((prev) => ({ ...prev, [activeSetup.id]: previousStep.id }))}
                disabled={!previousStep}
                className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold disabled:opacity-40"
                style={{ background: "#fff", color: "#0f1e38", border: "1px solid rgba(15,30,56,.08)" }}
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <div className="text-center">
                <p className="text-xs font-extrabold text-[#0f1e38]">{activeStepMeta.label}</p>
                <p className="mt-0.5 text-[11px] font-semibold text-[#8a9ab5]">{completed.length}/{required.length} launch tasks complete</p>
              </div>
              {nextStep ? (
                <button
                  onClick={() => setActiveDataSteps((prev) => ({ ...prev, [activeSetup.id]: nextStep.id }))}
                  className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold text-white"
                  style={{ background: "#0f1e38" }}
                >
                  Next <ChevronRight size={14} />
                </button>
              ) : isPublished ? (
                <span className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-50 px-4 text-xs font-bold text-emerald-700">
                  <CheckCircle2 size={13} /> Published
                </span>
              ) : (
                <button
                  onClick={() => runPatch(`${activeSetup.id}-publish`, { action: "PUBLISH", onboardingId: activeSetup.id })}
                  disabled={!canPublish || !!actionLoading}
                  className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold text-white disabled:opacity-40"
                  style={{ background: "#059669" }}
                >
                  <Rocket size={13} /> Make live
                </button>
              )}
            </div>
          </section>
        </div>
        {pendingDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1e38]/45 px-4 backdrop-blur-sm">
            <div role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" className="w-full max-w-md rounded-3xl border border-red-100 bg-white p-5 shadow-2xl">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                  <AlertCircle size={20} />
                </div>
                <div className="min-w-0">
                  <h2 id="delete-dialog-title" className="text-lg font-extrabold text-[#0f1e38]">{pendingDelete.title}</h2>
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-[#6b7a96]">{pendingDelete.description}</p>
                  <p className="mt-3 rounded-2xl bg-[#fff7ed] px-3 py-2 text-xs font-bold leading-relaxed text-[#9a3412]">
                    This cannot be undone from this screen.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setPendingDelete(null)}
                  className="h-10 rounded-xl px-4 text-xs font-bold text-[#0f1e38]"
                  style={{ background: "#f7f4ef" }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-xs font-bold text-white"
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[#0f1e38]">Hospital Setup</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            {data?.total ?? 0} hospital setup case{(data?.total ?? 0) === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data?.canManage && (
            <button
              onClick={() => setShowStartSetup((prev) => !prev)}
              className="flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-bold text-white transition-all"
              style={{ background: "#0f1e38" }}
            >
              <Plus size={13} /> New setup
            </button>
          )}
          <button
            onClick={() => fetchOnboardings()}
            className="flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition-all"
            style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.1)", color: "#6b7a96" }}
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
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Search hospital, contact, email, city..."
              className="admin-search-input"
            />
          </div>
          <p className="admin-page-indicator ml-auto">
            Page {page}
          </p>
        </div>
        <div className="admin-control-row-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {STATUSES.map((item) => {
            const count = item.value === "all" ? data?.total ?? 0 : counts.get(item.value) ?? 0;
            return (
              <button
                key={item.value}
                onClick={() => {
                  setStatus(item.value);
                  setPage(1);
                }}
                className={`admin-filter-pill ${status === item.value ? "admin-filter-pill-active" : ""}`}
              >
                <span>{item.label}</span>
                <span className="admin-filter-count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {data?.canManage && showStartSetup && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ClipboardList size={16} className="text-[#c8a96e]" />
              <p className="text-sm font-extrabold text-[#0f1e38]">Start Hospital Setup</p>
            </div>
            <button
              onClick={() => setShowStartSetup(false)}
              className="h-8 rounded-xl px-3 text-xs font-bold text-[#6b7a96]"
              style={{ background: "#f7f4ef" }}
            >
              Close
            </button>
          </div>
          <div className="mb-3 inline-flex rounded-2xl bg-[#f7f4ef] p-1">
            {[
              { value: "inquiry", label: "From inquiry" },
              { value: "direct", label: "Direct contact" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setNewCase((prev) => ({ ...prev, source: option.value as "inquiry" | "direct", partnerInquiryId: option.value === "direct" ? "" : prev.partnerInquiryId }))}
                className="h-8 rounded-xl px-3 text-xs font-bold transition-all"
                style={{
                  background: newCase.source === option.value ? "#0f1e38" : "transparent",
                  color: newCase.source === option.value ? "#c8a96e" : "#6b7a96",
                }}
              >
                {option.label}
              </button>
            ))}
          </div>

          {newCase.source === "inquiry" ? (
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
                placeholder="Setup note..."
                className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold text-[#0f1e38] outline-none placeholder:text-gray-400"
              />
              <button
                onClick={createCase}
                disabled={actionLoading === "create-case"}
                className="flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold text-white disabled:opacity-50"
                style={{ background: "#0f1e38" }}
              >
                <Plus size={13} /> {actionLoading === "create-case" ? "Starting..." : "Start setup"}
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="grid gap-2.5 lg:grid-cols-[1.3fr_.8fr_1fr_1fr]">
                <input
                  value={newCase.hospitalName}
                  onChange={(e) => setNewCase((prev) => ({ ...prev, hospitalName: e.target.value }))}
                  placeholder="Hospital or clinic name"
                  className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold text-[#0f1e38] outline-none placeholder:text-gray-400"
                />
                <select
                  value={newCase.type}
                  onChange={(e) => setNewCase((prev) => ({ ...prev, type: e.target.value as "HOSPITAL" | "CLINIC" | "LAB" }))}
                  className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold text-[#0f1e38] outline-none"
                >
                  <option value="HOSPITAL">Hospital</option>
                  <option value="CLINIC">Clinic</option>
                  <option value="LAB">Laboratory</option>
                </select>
                <input
                  value={newCase.contactName}
                  onChange={(e) => setNewCase((prev) => ({ ...prev, contactName: e.target.value }))}
                  placeholder="Contact person"
                  className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold text-[#0f1e38] outline-none placeholder:text-gray-400"
                />
                <input
                  value={newCase.city}
                  onChange={(e) => setNewCase((prev) => ({ ...prev, city: e.target.value }))}
                  placeholder="City / district"
                  className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold text-[#0f1e38] outline-none placeholder:text-gray-400"
                />
              </div>
              <div className="grid gap-2.5 lg:grid-cols-[1fr_1fr_1fr_1.4fr_auto]">
                <input
                  value={newCase.email}
                  onChange={(e) => setNewCase((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="Contact email"
                  type="email"
                  className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold text-[#0f1e38] outline-none placeholder:text-gray-400"
                />
                <input
                  value={newCase.phone}
                  onChange={(e) => setNewCase((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Contact phone"
                  className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold text-[#0f1e38] outline-none placeholder:text-gray-400"
                />
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
                  placeholder="Setup note..."
                  className="h-10 rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-xs font-semibold text-[#0f1e38] outline-none placeholder:text-gray-400"
                />
                <button
                  onClick={createCase}
                  disabled={actionLoading === "create-case"}
                  className="flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold text-white disabled:opacity-50"
                  style={{ background: "#0f1e38" }}
                >
                  <Plus size={13} /> {actionLoading === "create-case" ? "Starting..." : "Start setup"}
                </button>
              </div>
            </div>
          )}
          {data.inquiries.length === 0 && (
            <p className="mt-2 text-xs font-semibold text-gray-400">No unlinked partner inquiries are waiting. Use Direct contact when the lead came by phone, WhatsApp, email, or in person.</p>
          )}
        </div>
      )}

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
          <p className="text-sm font-semibold text-[#0f1e38]">No hospital setup cases found</p>
          <p className="mt-1 text-xs text-gray-400">Create one from a partner inquiry when a hospital is ready for setup.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.onboardings.map((item) => {
            const summary = getSetupSummary(item);
            const name = summary.name;
            const type = summary.type;
            const required = item.checklist.filter((check) => check.isRequired);
            const completed = required.filter((check) => check.isCompleted);
            const canPublish = data.canManage && item.hospital && item.status !== "PUBLISHED";
            const isPublished = item.status === "PUBLISHED";
            const canCreateShell = data.canManage && !item.hospital && item.partnerInquiry;

            return (
              <div key={item.id} className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
                <div className="grid min-h-[230px] items-stretch gap-6 p-6 xl:grid-cols-[minmax(320px,1.25fr)_minmax(260px,.82fr)_minmax(260px,.92fr)_minmax(240px,.78fr)]">
                  <div className="flex min-w-0 flex-col justify-between">
                    <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={item.status} />
                      <span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: "rgba(200,169,110,.12)", color: "#9a7c3f" }}>
                        {TYPE_LABELS[type]}
                      </span>
                      {item.hospital ? (
                        <span className="rounded-full px-2.5 py-1 text-[10px] font-bold text-emerald-700" style={{ background: "rgba(16,185,129,.1)" }}>
                          Hospital record linked
                        </span>
                      ) : (
                        <span className="rounded-full px-2.5 py-1 text-[10px] font-bold text-gray-500" style={{ background: "rgba(107,114,128,.09)" }}>
                          No hospital record
                        </span>
                      )}
                    </div>
                    <h2 className="mt-4 truncate text-2xl font-extrabold text-[#0f1e38]">{name}</h2>
                    <div className="mt-3 grid gap-2 text-xs font-semibold text-[#8a9ab5] sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      {summary.contactName && <span className="flex min-w-0 items-center gap-1.5"><UserRound size={12} className="flex-shrink-0" /> <span className="truncate">Contact: {summary.contactName}</span></span>}
                      {summary.phone && <span className="truncate">Phone: {summary.phone}</span>}
                      {summary.email && <span className="truncate">Email: {summary.email}</span>}
                      {summary.place && <span className="truncate">Location: {summary.place}</span>}
                    </div>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setActiveDataSteps((prev) => ({ ...prev, [item.id]: "request" }));
                          setExpandedId(item.id);
                        }}
                        className="flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold"
                        style={{ background: "#0f1e38", color: "#c8a96e" }}
                      >
                        <ClipboardList size={14} /> Continue setup
                      </button>
                    </div>
                  </div>

                  <div className="flex h-full flex-col justify-center rounded-2xl bg-[#fcfbf8] p-4">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Launch checklist</p>
                    <ProgressBar completed={completed.length} total={required.length} />
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-white px-2 py-3 shadow-sm shadow-[#0f1e38]/[0.03]">
                        <p className="text-lg font-extrabold text-[#0f1e38]">{item._count.files}</p>
                        <p className="text-[11px] font-semibold text-gray-400">Files</p>
                      </div>
                      <div className="rounded-xl bg-white px-2 py-3 shadow-sm shadow-[#0f1e38]/[0.03]">
                        <p className="text-lg font-extrabold text-[#0f1e38]">{item._count.imports}</p>
                        <p className="text-[11px] font-semibold text-gray-400">Imports</p>
                      </div>
                      <div className="rounded-xl bg-white px-2 py-3 shadow-sm shadow-[#0f1e38]/[0.03]">
                        <p className="text-lg font-extrabold text-[#0f1e38]">{item._count.notes}</p>
                        <p className="text-[11px] font-semibold text-gray-400">Notes</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex h-full flex-col justify-center">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Assigned to</p>
                    <div className="rounded-2xl bg-[#f7f4ef] p-4">
                      <p className="text-sm font-bold text-[#0f1e38]">{item.assignedTo?.fullName ?? "Unassigned"}</p>
                      <p className="mt-1 truncate text-xs text-gray-400">{item.assignedTo?.email ?? "Assign platform support"}</p>
                    </div>
                    <p className="mt-3 text-xs font-semibold text-gray-400">Updated {formatDateTime(item.updatedAt)}</p>
                  </div>

                  <div className="flex h-full flex-col justify-center space-y-3">
                    <select
                      value={item.status}
                      onChange={(e) => runPatch(`${item.id}-status`, { action: "UPDATE", onboardingId: item.id, status: e.target.value })}
                      disabled={!!actionLoading}
                      className="h-11 w-full rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-sm font-bold text-[#0f1e38] outline-none disabled:opacity-50"
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
                        className="h-11 w-full rounded-xl border border-gray-100 bg-[#f7f4ef] px-3 text-sm font-bold text-[#0f1e38] outline-none disabled:opacity-50"
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
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                        style={{ background: "#0f1e38" }}
                      >
                        <Building2 size={13} /> Create hospital record
                      </button>
                    )}
                    {canPublish ? (
                      <button
                        onClick={() => runPatch(`${item.id}-publish`, { action: "PUBLISH", onboardingId: item.id })}
                        disabled={!!actionLoading}
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                        style={{ background: "#059669" }}
                      >
                        <Rocket size={13} /> Make live
                      </button>
                    ) : isPublished ? (
                      <div className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-50 text-sm font-bold text-emerald-700">
                        <CheckCircle2 size={13} /> Already live
                      </div>
                    ) : null}
                  </div>
                </div>

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
