"use client";

import { useEffect, useState, useCallback } from "react";
import type { HospitalRole } from "@prisma/client";
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  CreditCard,
  Globe2,
  LockKeyhole,
  Save,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

type HospitalSettings = {
  id: string;
  name: string;
  slug: string;
  type: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  openingHours: string | null;
  emergencyAvailable: boolean;
  servicesSummary: string | null;
  verified: boolean;
  verifiedAt: string | null;
  isActive: boolean;
  suspendedAt: string | null;
  suspensionReason: string | null;
  location: {
    country: string;
    province: string | null;
    district: string;
    city: string;
    area: string | null;
    addressLine: string | null;
  } | null;
};

type SettingsResponse = {
  hospital: HospitalSettings;
  role: HospitalRole;
  canManageOwnerControls: boolean;
  ownerSummary: OwnerSummary | null;
};

type OwnerSummary = {
  billing: {
    provider: string;
    status: "connected" | "not_configured";
    paidBookings: number;
    refundedBookings: number;
    totalRevenue: number;
  };
  governance: {
    owners: number;
    activeMembers: number;
    pendingRequests: number;
    verified: boolean;
    verifiedAt: string | null;
    isActive: boolean;
    suspendedAt: string | null;
    suspensionReason: string | null;
  };
  readiness: {
    completed: number;
    total: number;
    items: { label: string; complete: boolean }[];
  };
};

function formatMoney(cents: number) {
  return `EUR ${Math.round(cents / 100).toLocaleString()}`;
}

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function SettingsClient({ slug, role }: { slug: string; role: HospitalRole }) {
  const [hospital, setHospital] = useState<HospitalSettings | null>(null);
  const [ownerSummary, setOwnerSummary] = useState<OwnerSummary | null>(null);
  const [canManageOwnerControls, setCanManageOwnerControls] = useState(role === "OWNER");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    phone: "",
    email: "",
    website: "",
    openingHours: "",
    emergencyAvailable: false,
    servicesSummary: "",
  });

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/h/${slug}/settings`);
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as SettingsResponse;
      setHospital(data.hospital);
      setOwnerSummary(data.ownerSummary);
      setCanManageOwnerControls(data.canManageOwnerControls);
      setForm({
        phone: data.hospital.phone ?? "",
        email: data.hospital.email ?? "",
        website: data.hospital.website ?? "",
        openingHours: data.hospital.openingHours ?? "",
        emergencyAvailable: data.hospital.emergencyAvailable,
        servicesSummary: data.hospital.servicesSummary ?? "",
      });
    } catch {
      setError("Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchSettings();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const res = await fetch(`/api/admin/h/${slug}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      setHospital((current) => current ? { ...current, ...data.hospital } : data.hospital);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof Omit<typeof form, "emergencyAvailable">) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  const locationLabel = hospital?.location
    ? [
        hospital.location.addressLine,
        hospital.location.area,
        hospital.location.city,
        hospital.location.district,
      ].filter(Boolean).join(", ")
    : "No location recorded";

  return (
    <div className="space-y-6 w-full max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#0f1e38]">Hospital Settings</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {canManageOwnerControls ? "Owner workspace controls" : "Public profile controls"}
          </p>
        </div>
        <span
          className="inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-bold"
          style={{
            background: canManageOwnerControls ? "rgba(200,169,110,.14)" : "rgba(15,30,56,.06)",
            color: canManageOwnerControls ? "#8a6a2f" : "#60708d",
            border: "1px solid rgba(15,30,56,.08)",
          }}
        >
          <ShieldCheck size={13} />
          {canManageOwnerControls ? "Owner" : "Manager"}
        </span>
      </div>

      {error && (
        <div className="p-3 rounded-xl text-sm font-semibold text-red-600 flex items-center gap-2"
          style={{ background: "#fef2f2", border: "1px solid rgba(220,38,38,.2)" }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {success && (
        <div className="p-3 rounded-xl text-sm font-semibold text-emerald-700 flex items-center gap-2"
          style={{ background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.25)" }}>
          <CheckCircle2 size={14} /> Public profile saved
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-solid border-[#c8a96e] border-r-transparent" />
        </div>
      ) : !hospital ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <Settings size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Could not load settings</p>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <form onSubmit={handleSave} className="space-y-5">
            {canManageOwnerControls && ownerSummary && (
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
                <div className="px-5 py-4" style={{ background: "linear-gradient(135deg,#0f1e38,#192d52)" }}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "rgba(200,169,110,.14)", color: "#c8a96e" }}>
                      <LockKeyhole size={17} />
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-white">Owner Settings</p>
                      <p className="text-xs font-medium text-white/55">Billing, activation, legal readiness, and ownership metadata.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-5 p-5">
                  <div className="grid gap-3 md:grid-cols-3">
                    <OwnerMetric label="Revenue" value={formatMoney(ownerSummary.billing.totalRevenue)} sub={`${ownerSummary.billing.paidBookings} paid bookings`} />
                    <OwnerMetric label="Team" value={`${ownerSummary.governance.activeMembers}`} sub={`${ownerSummary.governance.pendingRequests} pending requests`} />
                    <OwnerMetric label="Readiness" value={`${ownerSummary.readiness.completed}/${ownerSummary.readiness.total}`} sub="profile checks complete" />
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl p-4" style={{ background: "#f7f4ef" }}>
                      <p className="text-xs font-extrabold uppercase tracking-widest text-gray-400">Billing / Payments</p>
                      <div className="mt-3 space-y-3">
                        <OwnerDetail icon={<CreditCard size={15} />} label="Provider" value={ownerSummary.billing.provider} />
                        <OwnerDetail icon={<BadgeCheck size={15} />} label="Status" value={ownerSummary.billing.status === "connected" ? "Stripe connected" : "Stripe not configured"} />
                        <OwnerDetail icon={<ShieldCheck size={15} />} label="Refunded bookings" value={String(ownerSummary.billing.refundedBookings)} />
                      </div>
                    </div>

                    <div className="rounded-2xl p-4" style={{ background: "#f7f4ef" }}>
                      <p className="text-xs font-extrabold uppercase tracking-widest text-gray-400">Activation / Ownership</p>
                      <div className="mt-3 space-y-3">
                        <OwnerDetail icon={<Building2 size={15} />} label="Hospital status" value={ownerSummary.governance.isActive ? "Active" : "Inactive"} />
                        <OwnerDetail icon={<ShieldCheck size={15} />} label="Verification" value={ownerSummary.governance.verified ? `Verified ${formatDate(ownerSummary.governance.verifiedAt)}` : "Pending platform verification"} />
                        <OwnerDetail icon={<Users size={15} />} label="Approved owners" value={String(ownerSummary.governance.owners)} />
                      </div>
                    </div>
                  </div>

                  {ownerSummary.governance.suspendedAt && (
                    <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                      <p className="text-xs font-extrabold uppercase tracking-widest text-red-500">Suspension visibility</p>
                      <p className="mt-2 text-sm font-bold text-[#0f1e38]">Suspended on {formatDate(ownerSummary.governance.suspendedAt)}</p>
                      <p className="mt-1 text-xs font-semibold text-red-700">{ownerSummary.governance.suspensionReason ?? "No reason recorded."}</p>
                    </div>
                  )}

                  <div>
                    <p className="mb-2 text-xs font-extrabold uppercase tracking-widest text-gray-400">Legal / Profile Review</p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {ownerSummary.readiness.items.map((item) => (
                        <div key={item.label} className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: item.complete ? "#10b981" : "#f59e0b" }}
                          />
                          <span className="text-xs font-bold text-[#0f1e38]">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: "#f7f4ef" }}>
                  <Globe2 size={16} className="text-[#c8a96e]" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-[#0f1e38]">Public Profile</p>
                  <p className="text-xs text-gray-400">Visible on hospital pages and booking surfaces</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1.5">Phone</label>
                  <input {...field("phone")} placeholder="+977 1 234 5678"
                    className="w-full h-10 rounded-xl px-3 text-sm outline-none"
                    style={{ background: "#f7f4ef", border: "1.5px solid rgba(15,30,56,.1)" }} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1.5">Email</label>
                  <input {...field("email")} type="email" placeholder="info@hospital.com"
                    className="w-full h-10 rounded-xl px-3 text-sm outline-none"
                    style={{ background: "#f7f4ef", border: "1.5px solid rgba(15,30,56,.1)" }} />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1.5">Website</label>
                <input {...field("website")} placeholder="https://hospital.com"
                  className="w-full h-10 rounded-xl px-3 text-sm outline-none"
                  style={{ background: "#f7f4ef", border: "1.5px solid rgba(15,30,56,.1)" }} />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1.5">Opening Hours</label>
                <input {...field("openingHours")} placeholder="Sun-Fri: 8am-6pm, Sat: 8am-1pm"
                  className="w-full h-10 rounded-xl px-3 text-sm outline-none"
                  style={{ background: "#f7f4ef", border: "1.5px solid rgba(15,30,56,.1)" }} />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1.5">Services Summary</label>
                <textarea
                  {...field("servicesSummary")}
                  placeholder="Brief summary of services offered..."
                  rows={4}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                  style={{ background: "#f7f4ef", border: "1.5px solid rgba(15,30,56,.1)" }}
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, emergencyAvailable: !f.emergencyAvailable }))}
                  className="relative h-6 w-11 rounded-full transition-all flex-shrink-0"
                  style={{ background: form.emergencyAvailable ? "#c8a96e" : "#e5e7eb" }}
                  aria-pressed={form.emergencyAvailable}
                >
                  <span className="absolute top-0.5 h-5 w-5 bg-white rounded-full shadow transition-all"
                    style={{ left: form.emergencyAvailable ? "calc(100% - 22px)" : "2px" }} />
                </button>
                <div>
                  <p className="text-sm font-semibold text-[#0f1e38]">Emergency Available</p>
                  <p className="text-xs text-gray-400">Shown on the hospital listing</p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#0f1e38,#1a3059)", color: "#c8a96e" }}
            >
              <Save size={15} />
              {saving ? "Saving..." : "Save Public Profile"}
            </button>
          </form>

          <aside className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(15,30,56,.05)" }}>
                  <Building2 size={16} className="text-[#0f1e38]" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-[#0f1e38]">Hospital Identity</p>
                  <p className="text-xs text-gray-400">Platform-governed record</p>
                </div>
              </div>

              <InfoRow label="Name" value={hospital.name} />
              <InfoRow label="Type" value={hospital.type.toLowerCase()} />
              <InfoRow label="Slug" value={hospital.slug} mono />
              <InfoRow label="Location" value={locationLabel || "No location recorded"} />
              {canManageOwnerControls && (
                <>
                  <InfoRow label="Verified At" value={formatDate(hospital.verifiedAt)} />
                  <InfoRow label="Suspension" value={hospital.suspendedAt ? `${formatDate(hospital.suspendedAt)} / ${hospital.suspensionReason ?? "No reason recorded"}` : "Not suspended"} />
                </>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <StatusPill
                  label={hospital.verified ? "Verified" : "Unverified"}
                  tone={hospital.verified ? "green" : "amber"}
                />
                <StatusPill
                  label={hospital.isActive ? "Active" : "Inactive"}
                  tone={hospital.isActive ? "green" : "red"}
                />
              </div>
            </div>

            {canManageOwnerControls && ownerSummary && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(200,169,110,.12)" }}>
                    <LockKeyhole size={16} className="text-[#a8874f]" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-[#0f1e38]">Owner Controls</p>
                    <p className="text-xs text-gray-400">Authority, billing, and legal scope</p>
                  </div>
                </div>

                <OwnerControlRow
                  icon={<BadgeCheck size={15} />}
                  title="Authority"
                  value={`${ownerSummary.governance.owners} approved owner${ownerSummary.governance.owners === 1 ? "" : "s"}`}
                />
                <OwnerControlRow
                  icon={<CreditCard size={15} />}
                  title="Stripe billing"
                  value={ownerSummary.billing.status === "connected" ? "Payment reporting active" : "Awaiting Stripe configuration"}
                />
                <OwnerControlRow
                  icon={<ShieldCheck size={15} />}
                  title="Legal identity"
                  value={hospital.verified ? "Verified by platform" : "Pending verification"}
                />
                <OwnerControlRow
                  icon={<Users size={15} />}
                  title="Pending access"
                  value={`${ownerSummary.governance.pendingRequests} request${ownerSummary.governance.pendingRequests === 1 ? "" : "s"} waiting`}
                />
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function OwnerMetric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-extrabold text-[#0f1e38]">{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-gray-400">{sub}</p>
    </div>
  );
}

function OwnerDetail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-2">
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: "rgba(200,169,110,.12)", color: "#a8874f" }}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
        <p className="truncate text-xs font-extrabold text-[#0f1e38]">{value}</p>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</p>
      <p className={`text-sm font-semibold text-[#0f1e38] break-words ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "green" | "amber" | "red" }) {
  const styles = {
    green: { background: "rgba(16,185,129,.1)", color: "#047857" },
    amber: { background: "rgba(245,158,11,.12)", color: "#b45309" },
    red: { background: "rgba(239,68,68,.1)", color: "#b91c1c" },
  }[tone];

  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={styles}>
      {label}
    </span>
  );
}

function OwnerControlRow({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: "#f7f4ef" }}>
      <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#fff", color: "#a8874f" }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-[#0f1e38]">{title}</p>
        <p className="text-[11px] text-gray-500 truncate">{value}</p>
      </div>
    </div>
  );
}
