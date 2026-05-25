"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Building2,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";

type SupportUser = {
  id: string;
  fullName: string;
  email: string;
  assignments: {
    id: string;
    createdAt: string;
    hospital: { id: string; name: string; slug: string; isActive: boolean; verified: boolean };
  }[];
};

type Hospital = {
  id: string;
  name: string;
  slug: string;
  verified: boolean;
  assignments: {
    id: string;
    createdAt: string;
    supportUser: { id: string; fullName: string; email: string };
  }[];
};

type SupportData = {
  supportUsers: SupportUser[];
  hospitals: Hospital[];
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function PlatformSupportPage() {
  const [data, setData] = useState<SupportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedHospitalByUser, setSelectedHospitalByUser] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const fetchSupport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/platform/support");
      if (!res.ok) throw new Error("Failed");
      setData(await res.json());
    } catch {
      setError("Failed to load support assignments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchSupport();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchSupport]);

  const stats = useMemo(() => {
    const supportUsers = data?.supportUsers ?? [];
    const hospitals = data?.hospitals ?? [];
    return {
      supportUsers: supportUsers.length,
      unassignedSupport: supportUsers.filter((user) => user.assignments.length === 0).length,
      uncoveredHospitals: hospitals.filter((hospital) => hospital.assignments.length === 0).length,
      activeAssignments: supportUsers.reduce((sum, user) => sum + user.assignments.length, 0),
    };
  }, [data]);

  const assignSupport = async (userId: string) => {
    const hospitalId = selectedHospitalByUser[userId];
    if (!hospitalId) return;
    setActionLoading(userId + hospitalId);
    setError("");
    try {
      const res = await fetch("/api/admin/platform/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ASSIGN_SUPPORT", userId, hospitalId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setSelectedHospitalByUser((current) => ({ ...current, [userId]: "" }));
      await fetchSupport();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign support.");
    } finally {
      setActionLoading(null);
    }
  };

  const unassignSupport = async (assignmentId: string) => {
    if (!window.confirm("Remove this support assignment?")) return;
    setActionLoading(assignmentId);
    setError("");
    try {
      const res = await fetch("/api/admin/platform/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UNASSIGN_SUPPORT", assignmentId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      await fetchSupport();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove support assignment.");
    } finally {
      setActionLoading(null);
    }
  };

  const hospitals = data?.hospitals ?? [];
  const supportUsers = data?.supportUsers ?? [];

  return (
    <div className="w-full max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-[#0f1e38]">Support Assignments</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            Keep platform support scoped to explicit hospitals.
          </p>
        </div>
        <button
          onClick={fetchSupport}
          className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition-all"
          style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.1)", color: "#6b7a96" }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {error && (
        <div
          className="flex items-center gap-2 rounded-2xl p-3 text-sm font-semibold text-red-600"
          style={{ background: "#fef2f2", border: "1px solid rgba(220,38,38,.2)" }}
        >
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-56 items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-solid border-[#c8a96e] border-r-transparent" />
        </div>
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-4">
            <Stat label="Support users" value={stats.supportUsers} />
            <Stat label="Unassigned" value={stats.unassignedSupport} />
            <Stat label="Uncovered hospitals" value={stats.uncoveredHospitals} />
            <Stat label="Assignments" value={stats.activeAssignments} />
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-[#c8a96e]" />
                <h2 className="text-sm font-extrabold text-[#0f172a]">Support Users</h2>
              </div>

              {supportUsers.length === 0 ? (
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-xl">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f7f4ef] text-[#c8a96e]">
                        <ShieldCheck size={22} />
                      </div>
                      <h3 className="mt-4 text-lg font-extrabold text-[#0f172a]">No platform support users yet</h3>
                      <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500">
                        Support assignments only work after an existing user is promoted to Platform Support. Once promoted, that person appears here and can be scoped to specific hospitals.
                      </p>
                    </div>
                    <Link
                      href="/admin/platform/users"
                      className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-extrabold no-underline"
                      style={{ background: "#0f1e38", color: "#c8a96e" }}
                    >
                      Open users <ChevronRight size={14} />
                    </Link>
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <SetupStep index="1" title="User signs in" body="The person must exist as a user first, usually after logging in once." />
                    <SetupStep index="2" title="Promote role" body="Go to Users and change their platform role to Platform Support." />
                    <SetupStep index="3" title="Assign hospitals" body="Return here and give them access only to the hospitals they support." />
                  </div>
                </div>
              ) : (
                supportUsers.map((user) => {
                  const availableHospitals = hospitals.filter((hospital) =>
                    !user.assignments.some((assignment) => assignment.hospital.id === hospital.id)
                  );
                  const selectedHospitalId = selectedHospitalByUser[user.id] ?? "";
                  return (
                    <div key={user.id} className="rounded-2xl border border-gray-100 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-extrabold text-[#0f172a]">{user.fullName}</p>
                          <p className="text-xs font-semibold text-slate-400">{user.email}</p>
                        </div>
                        <span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: "rgba(200,169,110,.14)", color: "#a8874f" }}>
                          {user.assignments.length} assigned
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {user.assignments.length === 0 ? (
                          <span className="text-xs font-semibold text-amber-700">No hospital scope assigned</span>
                        ) : (
                          user.assignments.map((assignment) => (
                            <span key={assignment.id} className="inline-flex items-center gap-2 rounded-xl bg-[#f7f4ef] px-2.5 py-1.5 text-xs font-bold text-[#0f1e38]">
                              {assignment.hospital.name}
                              <button
                                onClick={() => unassignSupport(assignment.id)}
                                disabled={actionLoading === assignment.id}
                                className="text-rose-500 disabled:opacity-40"
                                title="Remove assignment"
                              >
                                <XCircle size={13} />
                              </button>
                            </span>
                          ))
                        )}
                      </div>

                      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                        <select
                          value={selectedHospitalId}
                          onChange={(event) => setSelectedHospitalByUser((current) => ({ ...current, [user.id]: event.target.value }))}
                          className="admin-select-control w-full"
                        >
                          <option value="">Assign hospital...</option>
                          {availableHospitals.map((hospital) => (
                            <option key={hospital.id} value={hospital.id}>
                              {hospital.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => assignSupport(user.id)}
                          disabled={!selectedHospitalId || actionLoading === user.id + selectedHospitalId}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-extrabold disabled:opacity-40"
                          style={{ background: "#0f1e38", color: "#c8a96e" }}
                        >
                          <UserCheck size={13} /> Assign
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-[#c8a96e]" />
                <h2 className="text-sm font-extrabold text-[#0f172a]">Hospital Coverage</h2>
              </div>

              {hospitals.map((hospital) => (
                <div key={hospital.id} className="rounded-2xl border border-gray-100 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-[#0f172a]">{hospital.name}</p>
                      <p className="text-[11px] font-semibold text-slate-400">/{hospital.slug}</p>
                    </div>
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-bold"
                      style={{
                        background: hospital.assignments.length ? "#ecfdf5" : "#fff7ed",
                        color: hospital.assignments.length ? "#047857" : "#c2410c",
                      }}
                    >
                      {hospital.assignments.length ? "Covered" : "No support"}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {hospital.assignments.length === 0 ? (
                      <p className="text-xs font-semibold text-slate-400">No active support assignment.</p>
                    ) : (
                      hospital.assignments.map((assignment) => (
                        <div key={assignment.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#f7f4ef] px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-[#0f1e38]">{assignment.supportUser.fullName}</p>
                            <p className="text-[10px] font-semibold text-slate-400">Assigned {formatDate(assignment.createdAt)}</p>
                          </div>
                          <button
                            onClick={() => unassignSupport(assignment.id)}
                            disabled={actionLoading === assignment.id}
                            className="flex-shrink-0 text-rose-500 disabled:opacity-40"
                            title="Remove assignment"
                          >
                            <XCircle size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#8a9ab5]">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-[#0f1e38]">{value}</p>
    </div>
  );
}

function SetupStep({ index, title, body }: { index: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-[#f7f4ef] p-4">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-extrabold text-[#c8a96e]">
        {index}
      </div>
      <p className="mt-3 text-sm font-extrabold text-[#0f172a]">{title}</p>
      <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">{body}</p>
    </div>
  );
}
