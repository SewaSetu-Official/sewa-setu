"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ListChecks, SlidersHorizontal, Plus, Trash2, ChevronUp, ChevronDown,
  Loader2, Save, CheckCircle2, AlertCircle, RotateCcw,
} from "lucide-react";

type ChecklistItem = { title: string; isRequired: boolean };
type Defaults = { currency: string; contactEmail: string; supportPhone: string; cities: string[] };

const fieldCls = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-[#0f1e38] outline-none transition focus:border-[#c8a96e]";
const labelCls = "text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#8a9ab5]";

export default function PlatformSettingsPage() {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [defaults, setDefaults] = useState<Defaults>({ currency: "EUR", contactEmail: "", supportPhone: "", cities: [] });
  const [fallbackChecklist, setFallbackChecklist] = useState<ChecklistItem[]>([]);
  const [citiesText, setCitiesText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<"checklist" | "defaults" | null>(null);
  const [saved, setSaved] = useState<"checklist" | "defaults" | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/platform/settings");
      if (!res.ok) throw new Error("Failed to load settings.");
      const data = await res.json();
      setChecklist(data.checklist ?? []);
      setDefaults(data.defaults ?? { currency: "EUR", contactEmail: "", supportPhone: "", cities: [] });
      setCitiesText((data.defaults?.cities ?? []).join(", "));
      setFallbackChecklist(data.fallbacks?.checklist ?? []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; state set after await
  useEffect(() => { void load(); }, [load]);

  const saveSection = async (section: "checklist" | "defaults") => {
    setSaving(section); setSaved(null); setError("");
    try {
      const payload = section === "checklist"
        ? { section, items: checklist.map((i) => ({ title: i.title.trim(), isRequired: i.isRequired })) }
        : {
            section,
            currency: defaults.currency,
            contactEmail: defaults.contactEmail,
            supportPhone: defaults.supportPhone,
            cities: citiesText.split(",").map((c) => c.trim()).filter(Boolean),
          };
      const res = await fetch("/api/admin/platform/settings", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save.");
      setSaved(section);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(null);
    }
  };

  // checklist editing helpers
  const setItem = (i: number, patch: Partial<ChecklistItem>) =>
    setChecklist((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const removeItem = (i: number) => setChecklist((prev) => prev.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) =>
    setChecklist((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const addItem = () => setChecklist((prev) => [...prev, { title: "", isRequired: true }]);

  if (loading) {
    return <div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#c8a96e]" /></div>;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#8a9ab5]">Platform configuration</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#0f1e38]">Settings</h1>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-extrabold text-red-700">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* ── Onboarding checklist template ── */}
      <section className="rounded-[24px] border border-slate-100 bg-white p-6 shadow-[0_18px_50px_rgba(15,30,56,0.05)]">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#fbf8f0] text-[#c8a96e]"><ListChecks size={18} /></div>
          <div>
            <h2 className="text-lg font-extrabold text-[#0f1e38]">Onboarding checklist template</h2>
            <p className="mt-0.5 text-sm font-semibold text-[#8a9ab5]">The launch checklist every new hospital setup starts with. Required items must be completed before a hospital can go live.</p>
          </div>
        </div>

        <div className="space-y-2">
          {checklist.map((item, i) => (
            <div key={i} className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50/60 p-2.5">
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="text-[#b1bfd2] transition hover:text-[#c8a96e] disabled:opacity-30"><ChevronUp size={14} /></button>
                <button onClick={() => move(i, 1)} disabled={i === checklist.length - 1} className="text-[#b1bfd2] transition hover:text-[#c8a96e] disabled:opacity-30"><ChevronDown size={14} /></button>
              </div>
              <input
                value={item.title}
                onChange={(e) => setItem(i, { title: e.target.value })}
                placeholder="Checklist item"
                className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-[#0f1e38] outline-none focus:border-[#c8a96e]"
              />
              <button
                onClick={() => setItem(i, { isRequired: !item.isRequired })}
                className={`h-8 shrink-0 rounded-lg px-2.5 text-[11px] font-extrabold transition ${item.isRequired ? "bg-[#fbf8f0] text-[#9c7939]" : "bg-slate-100 text-[#8a9ab5]"}`}
              >
                {item.isRequired ? "Required" : "Optional"}
              </button>
              <button onClick={() => removeItem(i)} className="shrink-0 rounded-lg p-1.5 text-red-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={addItem} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-extrabold text-[#5f6f8d] transition hover:border-[#c8a96e]"><Plus size={14} /> Add item</button>
          <button onClick={() => setChecklist(fallbackChecklist)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-extrabold text-[#5f6f8d] transition hover:border-[#c8a96e]"><RotateCcw size={13} /> Reset to default</button>
          <div className="ml-auto flex items-center gap-3">
            {saved === "checklist" && <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600"><CheckCircle2 size={15} /> Saved</span>}
            <button onClick={() => saveSection("checklist")} disabled={saving === "checklist" || checklist.some((i) => !i.title.trim())} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#0f1e38] px-5 text-sm font-extrabold text-white transition hover:bg-[#1a2c4d] disabled:opacity-50">
              {saving === "checklist" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save template
            </button>
          </div>
        </div>
      </section>

      {/* ── Platform defaults ── */}
      <section className="rounded-[24px] border border-slate-100 bg-white p-6 shadow-[0_18px_50px_rgba(15,30,56,0.05)]">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#fbf8f0] text-[#c8a96e]"><SlidersHorizontal size={18} /></div>
          <div>
            <h2 className="text-lg font-extrabold text-[#0f1e38]">Platform defaults</h2>
            <p className="mt-0.5 text-sm font-semibold text-[#8a9ab5]">Defaults used across the platform.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5"><span className={labelCls}>Default currency</span>
            <input className={fieldCls} value={defaults.currency} onChange={(e) => setDefaults((d) => ({ ...d, currency: e.target.value }))} placeholder="EUR" /></label>
          <label className="space-y-1.5"><span className={labelCls}>Support phone</span>
            <input className={fieldCls} value={defaults.supportPhone} onChange={(e) => setDefaults((d) => ({ ...d, supportPhone: e.target.value }))} placeholder="+977 ..." /></label>
          <label className="space-y-1.5 sm:col-span-2"><span className={labelCls}>Platform contact email</span>
            <input className={fieldCls} value={defaults.contactEmail} onChange={(e) => setDefaults((d) => ({ ...d, contactEmail: e.target.value }))} placeholder="support@sewasetu.com" /></label>
          <label className="space-y-1.5 sm:col-span-2"><span className={labelCls}>Supported cities (comma-separated)</span>
            <textarea rows={2} className={`${fieldCls} h-auto resize-none py-2.5`} value={citiesText} onChange={(e) => setCitiesText(e.target.value)} placeholder="Kathmandu, Pokhara, Lalitpur" /></label>
        </div>

        <div className="mt-4 flex items-center justify-end gap-3">
          {saved === "defaults" && <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600"><CheckCircle2 size={15} /> Saved</span>}
          <button onClick={() => saveSection("defaults")} disabled={saving === "defaults"} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#0f1e38] px-5 text-sm font-extrabold text-white transition hover:bg-[#1a2c4d] disabled:opacity-50">
            {saving === "defaults" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save defaults
          </button>
        </div>
      </section>
    </div>
  );
}
