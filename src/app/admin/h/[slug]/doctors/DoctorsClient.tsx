"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  Check,
  Clock,
  Copy,
  Filter,
  Mail,
  RefreshCw,
  Search,
  Send,
  Stethoscope,
} from "lucide-react";

type Department = {
  id: string;
  name: string;
  sortOrder: number;
  doctorSortOrder: number;
};

type Doctor = {
  id: string;
  fullName: string;
  gender: string | null;
  experienceYears: number | null;
  licenseNumber: string | null;
  verified: boolean;
  positionTitle: string | null;
  linkedUser: { id: string; email: string; fullName: string } | null;
  pendingInvite: { id: string; email: string; expiresAt: string; createdAt: string } | null;
  primaryDepartment: Department | null;
  departments: Department[];
  primarySpecialty: string | null;
  photoUrl: string | null;
  activeSlots: number;
  bookingCount: number;
  feeMin: number | null;
  feeMax: number | null;
  currency: string;
  consultationModes: unknown;
};

function formatMoney(cents: number, currency: string) {
  void currency;
  return "€" + Math.round(cents / 100).toLocaleString();
}

function getModes(doctor: Doctor) {
  return Array.isArray(doctor.consultationModes) ? (doctor.consultationModes as string[]) : [];
}

export default function DoctorsClient({ slug, canManage }: { slug: string; canManage: boolean }) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [role, setRole] = useState<string>("RECEPTIONIST");
  const [doctorName, setDoctorName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [slotFilter, setSlotFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [inviteEmails, setInviteEmails] = useState<Record<string, string>>({});
  const [inviteLinks, setInviteLinks] = useState<Record<string, string>>({});
  const [inviting, setInviting] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState<string | null>(null);

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/h/${slug}/doctors`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setDoctors(data.doctors);
      setRole(data.role ?? "RECEPTIONIST");
      setDoctorName(data.doctorName ?? null);
    } catch {
      setError("Failed to load doctors.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchDoctors();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchDoctors]);

  const departments = Array.from(
    new Map(
      doctors
        .flatMap((doctor) => doctor.departments)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        .map((department) => [department.id, department]),
    ).values(),
  );

  const filtered = doctors.filter((doctor) => {
    const q = search.trim().toLowerCase();
    const modes = getModes(doctor);
    const matchesSearch =
      !q ||
      doctor.fullName.toLowerCase().includes(q) ||
      (doctor.primarySpecialty?.toLowerCase().includes(q) ?? false) ||
      doctor.departments.some((department) => department.name.toLowerCase().includes(q));
    const matchesDepartment =
      departmentFilter === "all" ||
      (departmentFilter === "unassigned" && doctor.departments.length === 0) ||
      doctor.departments.some((department) => department.id === departmentFilter);
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "verified" && doctor.verified) ||
      (statusFilter === "unverified" && !doctor.verified);
    const matchesSlots =
      slotFilter === "all" ||
      (slotFilter === "with-slots" && doctor.activeSlots > 0) ||
      (slotFilter === "no-slots" && doctor.activeSlots === 0);
    const matchesMode = modeFilter === "all" || modes.includes(modeFilter);

    return matchesSearch && matchesDepartment && matchesStatus && matchesSlots && matchesMode;
  });

  const groupedDoctors = filtered.reduce<Record<string, { department: Department | null; doctors: Doctor[] }>>(
    (groups, doctor) => {
      const department = doctor.primaryDepartment;
      const key = department?.id ?? "unassigned";
      if (!groups[key]) groups[key] = { department, doctors: [] };
      groups[key].doctors.push(doctor);
      return groups;
    },
    {},
  );

  const doctorGroups = Object.values(groupedDoctors).sort((a, b) => {
    const departmentDelta = (a.department?.sortOrder ?? 9999) - (b.department?.sortOrder ?? 9999);
    if (departmentDelta !== 0) return departmentDelta;
    return (a.department?.name ?? "Unassigned").localeCompare(b.department?.name ?? "Unassigned");
  });

  const verified = doctors.filter((d) => d.verified).length;
  const withSlots = doctors.filter((d) => d.activeSlots > 0).length;
  const hasFilters =
    !!search || departmentFilter !== "all" || statusFilter !== "all" || slotFilter !== "all" || modeFilter !== "all";
  const isDoctor = role === "DOCTOR";

  const sendInvite = async (doctor: Doctor) => {
    const email = inviteEmails[doctor.id]?.trim();
    if (!email) {
      setError("Enter an email address before creating an invite.");
      return;
    }

    setInviting(doctor.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/h/${slug}/doctors/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorId: doctor.id, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create invite.");
        return;
      }
      setInviteLinks((prev) => ({ ...prev, [doctor.id]: data.invite.inviteUrl }));
      await fetchDoctors();
    } catch {
      setError("Network error while creating invite.");
    } finally {
      setInviting(null);
    }
  };

  const copyInvite = async (doctorId: string) => {
    const link = inviteLinks[doctorId];
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopiedInvite(doctorId);
    window.setTimeout(() => setCopiedInvite(null), 1500);
  };

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[#0f1e38]">{isDoctor ? "My Doctor Profile" : "Doctors"}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {doctors.length} doctor{doctors.length !== 1 ? "s" : ""} Â· {departments.length} department
            {departments.length !== 1 ? "s" : ""} Â· {verified} verified Â· {withSlots} with active slots
          </p>
          {isDoctor && doctorName && (
            <p className="text-xs font-semibold text-[#a88b50] mt-1">Profile linked for {doctorName}</p>
          )}
        </div>
        <button
          onClick={fetchDoctors}
          className="flex items-center gap-2 px-3 h-9 rounded-xl text-xs font-semibold transition-all"
          style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.1)", color: "#6b7a96" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#c8a96e";
            e.currentTarget.style.color = "#c8a96e";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(15,30,56,.1)";
            e.currentTarget.style.color = "#6b7a96";
          }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {!isDoctor && <div className="admin-control-panel space-y-3">
        <div className="admin-control-row">
          <div className="admin-search-control">
            <Search size={14} className="admin-search-icon" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, department, or specialty..."
              className="admin-search-input"
            />
          </div>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="admin-select-control"
          >
            <option value="all">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
            <option value="unassigned">Unassigned</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="admin-select-control"
          >
            <option value="all">All statuses</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
          </select>
          <select
            value={slotFilter}
            onChange={(e) => setSlotFilter(e.target.value)}
            className="admin-select-control"
          >
            <option value="all">All slots</option>
            <option value="with-slots">With active slots</option>
            <option value="no-slots">No active slots</option>
          </select>
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            className="admin-select-control"
          >
            <option value="all">All modes</option>
            <option value="ONLINE">Online</option>
            <option value="PHYSICAL">In-person</option>
          </select>
        </div>

        {hasFilters && (
          <button
            onClick={() => {
              setSearch("");
              setDepartmentFilter("all");
              setStatusFilter("all");
              setSlotFilter("all");
              setModeFilter("all");
            }}
            className="admin-clear-filter inline-flex items-center gap-1.5"
          >
            <Filter size={12} /> Clear filters
          </button>
        )}
      </div>}

      {error && (
        <div
          className="p-3 rounded-xl text-sm font-semibold text-red-600 flex items-center gap-2"
          style={{ background: "#fef2f2", border: "1px solid rgba(220,38,38,.2)" }}
        >
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-solid border-[#c8a96e] border-r-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <Stethoscope size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-400">
            {hasFilters ? "No doctors match your filters" : "No doctors found"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {doctorGroups.map((group) => (
            <section key={group.department?.id ?? "unassigned"} className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
                  <Building2 size={15} className="text-[#c8a96e]" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-[#0f1e38]">
                    {group.department?.name ?? "Unassigned Department"}
                  </h2>
                  <p className="text-xs text-gray-400">
                    {group.doctors.length} doctor{group.doctors.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {group.doctors.map((doc) => {
                  const modes = getModes(doc);
                  return (
                    <div key={doc.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3">
                      <div className="flex items-start gap-3">
                        <div className="h-12 w-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center">
                          {doc.photoUrl ? (
                            <Image
                              src={doc.photoUrl}
                              alt={doc.fullName}
                              width={48}
                              height={48}
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <Stethoscope size={18} className="text-gray-300" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-[#0f1e38] text-sm truncate">{doc.fullName}</p>
                            {doc.verified && <BadgeCheck size={14} className="text-[#c8a96e] flex-shrink-0" />}
                          </div>
                          {doc.primarySpecialty && (
                            <p className="text-xs text-gray-400 truncate">{doc.primarySpecialty}</p>
                          )}
                          {doc.departments.length > 0 && (
                            <p className="text-[11px] text-[#a88b50] truncate">
                              {doc.departments.map((department) => department.name).join(", ")}
                            </p>
                          )}
                          {doc.positionTitle && (
                            <p className="text-[10px] text-gray-300 truncate">{doc.positionTitle}</p>
                          )}
                          {doc.linkedUser ? (
                            <p className="mt-1 text-[10px] font-bold text-emerald-700 truncate">
                              Linked: {doc.linkedUser.email}
                            </p>
                          ) : doc.pendingInvite ? (
                            <p className="mt-1 text-[10px] font-bold text-[#a88b50] truncate">
                              Invite pending: {doc.pendingInvite.email}
                            </p>
                          ) : (
                            <p className="mt-1 text-[10px] font-bold text-rose-500 truncate">No linked account</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-gray-50">
                        <div className="text-center">
                          <p className="text-base font-extrabold text-[#0f1e38]">{doc.bookingCount}</p>
                          <p className="text-[10px] text-gray-400">bookings</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            <Clock size={10} className={doc.activeSlots > 0 ? "text-emerald-500" : "text-gray-300"} />
                            <p className="text-base font-extrabold text-[#0f1e38]">{doc.activeSlots}</p>
                          </div>
                          <p className="text-[10px] text-gray-400">slots</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-[#0f1e38]">
                            {doc.feeMin != null ? formatMoney(doc.feeMin, doc.currency) : "-"}
                          </p>
                          <p className="text-[10px] text-gray-400">fee from</p>
                        </div>
                      </div>

                      {modes.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap">
                          {modes.map((m: string) => (
                            <span
                              key={m}
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{
                                background: m === "ONLINE" ? "rgba(200,169,110,.1)" : "rgba(16,185,129,.1)",
                                color: m === "ONLINE" ? "#a88b50" : "#059669",
                              }}
                            >
                              {m === "ONLINE" ? "Online" : "In-person"}
                            </span>
                          ))}
                        </div>
                      )}

                      {canManage && !doc.linkedUser && (
                        <div className="border-t border-gray-50 pt-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="flex flex-1 items-center gap-2 h-9 rounded-lg px-3 bg-[#f7f4ef] border border-gray-100 min-w-0">
                              <Mail size={12} className="text-gray-400 flex-shrink-0" />
                              <input
                                value={inviteEmails[doc.id] ?? doc.pendingInvite?.email ?? ""}
                                onChange={(e) => setInviteEmails((prev) => ({ ...prev, [doc.id]: e.target.value }))}
                                placeholder="doctor@email.com"
                                className="flex-1 min-w-0 text-xs outline-none bg-transparent text-[#0f1e38] placeholder-gray-400"
                              />
                            </div>
                            <button
                              onClick={() => sendInvite(doc)}
                              disabled={inviting === doc.id}
                              className="h-9 rounded-lg px-3 text-xs font-bold disabled:opacity-50"
                              style={{ background: "#142746", color: "#d8b975" }}
                            >
                              {inviting === doc.id ? "..." : <Send size={13} />}
                            </button>
                          </div>

                          {inviteLinks[doc.id] && (
                            <button
                              onClick={() => copyInvite(doc.id)}
                              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#a88b50]"
                            >
                              {copiedInvite === doc.id ? <Check size={12} /> : <Copy size={12} />}
                              {copiedInvite === doc.id ? "Copied invite link" : "Copy invite link"}
                            </button>
                          )}
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
