"use client";

import { useEffect, useState, useCallback } from "react";
import { Package, Plus, Edit2, ToggleLeft, ToggleRight, X, AlertCircle, RefreshCw } from "lucide-react";

type Pkg = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { bookings: number };
};

function formatMoney(cents: number, currency: string) {
  void currency;
  return "€" + Math.round(cents / 100).toLocaleString();
}

const EMPTY_FORM = { title: "", description: "", price: "", currency: "EUR" };

export default function PackagesClient({ slug }: { slug: string }) {
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Pkg | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [formError, setFormError] = useState("");

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/h/${slug}/packages`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setPackages(data.packages);
    } catch {
      setError("Failed to load packages.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchPackages();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchPackages]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (pkg: Pkg) => {
    setEditTarget(pkg);
    setForm({
      title: pkg.title,
      description: pkg.description ?? "",
      price: pkg.price != null ? String(Math.round(pkg.price / 100)) : "",
      currency: pkg.currency ?? "EUR",
    });
    setFormError("");
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setFormError("Title is required"); return; }
    setSaving(true);
    setFormError("");

    const priceInCents = form.price ? Math.round(parseFloat(form.price) * 100) : null;
    const body = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      price: priceInCents,
      currency: form.currency || "EUR",
      ...(editTarget ? { id: editTarget.id } : {}),
    };

    try {
      const res = await fetch(`/api/admin/h/${slug}/packages`, {
        method: editTarget ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error ?? "Failed to save"); return; }
      setShowForm(false);
      await fetchPackages();
    } catch {
      setFormError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (pkg: Pkg) => {
    setToggling(pkg.id);
    try {
      const res = await fetch(`/api/admin/h/${slug}/packages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pkg.id, isActive: !pkg.isActive }),
      });
      if (!res.ok) throw new Error("Failed");
      await fetchPackages();
    } catch {
      setError("Failed to update package status.");
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-[#0f1e38]">Packages</h1>
          <p className="text-sm text-gray-400 mt-0.5">{packages.length} package{packages.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchPackages}
            className="flex items-center gap-2 px-3 h-9 rounded-xl text-xs font-semibold transition-all"
            style={{ background: "#fff", border: "1.5px solid rgba(15,30,56,.1)", color: "#6b7a96" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#c8a96e"; e.currentTarget.style.color = "#c8a96e"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(15,30,56,.1)"; e.currentTarget.style.color = "#6b7a96"; }}
          >
            <RefreshCw size={13} />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 h-9 rounded-xl text-xs font-bold transition-all"
            style={{ background: "linear-gradient(135deg,#0f1e38,#1a3059)", color: "#c8a96e" }}
          >
            <Plus size={14} /> New Package
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl text-sm font-semibold text-red-600 flex items-center gap-2"
          style={{ background: "#fef2f2", border: "1px solid rgba(220,38,38,.2)" }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-extrabold text-[#0f1e38]">
                {editTarget ? "Edit Package" : "New Package"}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-1.5">Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Full Body Checkup"
                  className="w-full h-10 rounded-xl px-3 text-sm outline-none"
                  style={{ background: "#f7f4ef", border: "1.5px solid rgba(15,30,56,.1)" }}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What's included in this package..."
                  rows={3}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                  style={{ background: "#f7f4ef", border: "1.5px solid rgba(15,30,56,.1)" }}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-1.5">Price</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    placeholder="0"
                    min="0"
                    step="0.01"
                    className="w-full h-10 rounded-xl px-3 text-sm outline-none"
                    style={{ background: "#f7f4ef", border: "1.5px solid rgba(15,30,56,.1)" }}
                  />
                </div>
                <div className="w-28">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-1.5">Currency</label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                    className="w-full h-10 rounded-xl px-3 text-sm outline-none appearance-none"
                    style={{ background: "#f7f4ef", border: "1.5px solid rgba(15,30,56,.1)" }}
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              {formError && <p className="text-xs text-red-600 font-semibold">{formError}</p>}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 h-10 rounded-xl text-sm font-semibold"
                  style={{ background: "#f7f4ef", color: "#6b7a96" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 h-10 rounded-xl text-sm font-bold disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#0f1e38,#1a3059)", color: "#c8a96e" }}
                >
                  {saving ? "Saving..." : editTarget ? "Save Changes" : "Create Package"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-solid border-[#c8a96e] border-r-transparent" />
        </div>
      ) : packages.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <Package size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-400">No packages yet</p>
          <button onClick={openCreate} className="mt-4 px-4 h-9 rounded-xl text-xs font-bold"
            style={{ background: "linear-gradient(135deg,#0f1e38,#1a3059)", color: "#c8a96e" }}>
            + Add your first package
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {packages.map((pkg) => (
            <div key={pkg.id} className="bg-white rounded-2xl border p-4 flex flex-col gap-3"
              style={{
                borderColor: pkg.isActive ? "rgba(15,30,56,.07)" : "rgba(156,163,175,.3)",
                opacity: pkg.isActive ? 1 : 0.6,
              }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-[#0f1e38] text-sm truncate">{pkg.title}</p>
                    {!pkg.isActive && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: "rgba(156,163,175,.15)", color: "#6b7280" }}>
                        Inactive
                      </span>
                    )}
                  </div>
                  {pkg.description && (
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{pkg.description}</p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  {pkg.price != null ? (
                    <p className="text-base font-extrabold text-[#0f1e38]">
                      {formatMoney(pkg.price, pkg.currency ?? "EUR")}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400">No price set</p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-gray-50">
                <p className="text-xs text-gray-400">{pkg._count.bookings} booking{pkg._count.bookings !== 1 ? "s" : ""}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(pkg)}
                    className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: "#f7f4ef", color: "#6b7a96" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(200,169,110,.1)"; e.currentTarget.style.color = "#c8a96e"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#f7f4ef"; e.currentTarget.style.color = "#6b7a96"; }}
                  >
                    <Edit2 size={11} /> Edit
                  </button>
                  <button
                    onClick={() => handleToggle(pkg)}
                    disabled={toggling === pkg.id}
                    className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                    style={{
                      background: pkg.isActive ? "rgba(239,68,68,.08)" : "rgba(16,185,129,.08)",
                      color: pkg.isActive ? "#dc2626" : "#059669",
                    }}
                  >
                    {pkg.isActive ? <ToggleLeft size={13} /> : <ToggleRight size={13} />}
                    {toggling === pkg.id ? "..." : pkg.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
