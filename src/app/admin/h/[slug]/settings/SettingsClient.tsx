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
  isActive: boolean;
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
};

export default function SettingsClient({ slug, role }: { slug: string; role: HospitalRole }) {
  const [hospital, setHospital] = useState<HospitalSettings | null>(null);
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
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <form onSubmit={handleSave} className="space-y-5">
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

            {canManageOwnerControls && (
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
                  value="Owner protected"
                />
                <OwnerControlRow
                  icon={<CreditCard size={15} />}
                  title="Stripe billing"
                  value="Payment reporting active"
                />
                <OwnerControlRow
                  icon={<ShieldCheck size={15} />}
                  title="Legal identity"
                  value={hospital.verified ? "Verified by platform" : "Pending verification"}
                />
              </div>
            )}
          </aside>
        </div>
      )}
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
