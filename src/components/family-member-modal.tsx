"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, UserPlus, Pencil } from "lucide-react";

export type FamilyMember = {
  id: string;
  fullName: string;
  gender: string | null;
  dateOfBirth: string | null;
  phone: string | null;
  notes: string | null;
  bookingCount: number;
  activeBookingCount: number; // upcoming/not-yet-completed bookings — blocks removal while > 0
};

interface Props {
  member?: FamilyMember; // set → edit mode
  onClose: () => void;
  onSuccess: (member: FamilyMember) => void;
}

const GENDERS = ["Male", "Female", "Other"];

function isoToInputDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function FamilyMemberModal({ member, onClose, onSuccess }: Props) {
  const isEdit = Boolean(member);

  const [fullName, setFullName] = useState(member?.fullName ?? "");
  const [gender, setGender] = useState<string>(member?.gender ?? "");
  const [dob, setDob] = useState(isoToInputDate(member?.dateOfBirth ?? null));
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [notes, setNotes] = useState(member?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (fullName.trim().length < 2) { setError("Please enter a name (at least 2 characters)."); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        fullName: fullName.trim(),
        gender: gender || null,
        dateOfBirth: dob || null,
        phone: phone.trim() || null,
        notes: notes.trim() || null,
      };
      const res = isEdit
        ? await fetch(`/api/patients/${member!.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/patients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); setSaving(false); return; }
      onSuccess(data);
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  };

  const fieldCls = "w-full rounded-xl px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted outline-none transition-all";
  const fieldStyle = { background: "#F6F4EE", border: "1.5px solid rgba(20,33,29,0.12)" } as const;

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:p-4"
      style={{ background: "rgba(20,33,29,0.5)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full overflow-hidden rounded-t-[28px] sm:max-w-[420px] sm:rounded-[28px]"
        style={{ background: "#fff", boxShadow: "0 40px 90px -30px rgba(0,0,0,.55)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-[rgba(20,33,29,0.08)] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-brand-soft text-brand">
              {isEdit ? <Pencil size={16} /> : <UserPlus size={16} />}
            </span>
            <p className="text-[15px] font-bold text-ink">{isEdit ? "Edit family member" : "Add family member"}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-page transition-colors hover:bg-[rgba(20,33,29,0.08)]">
            <X size={14} className="text-ink-soft" />
          </button>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-4 px-6 pb-2 pt-5">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-ink-muted">Full name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} placeholder="e.g. Sita Sharma" className={fieldCls} style={fieldStyle} />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-ink-muted">Gender <span className="font-normal normal-case">(optional)</span></label>
            <div className="flex gap-2">
              {GENDERS.map((g) => {
                const active = gender === g;
                return (
                  <button key={g} type="button" onClick={() => setGender(active ? "" : g)}
                    className="flex-1 rounded-[11px] border-[1.5px] px-3 py-2.5 text-[13px] font-semibold transition-colors"
                    style={{ background: active ? "#E6F0EC" : "#fff", color: active ? "#0C6B57" : "#46524D", borderColor: active ? "#0C6B57" : "rgba(20,33,29,.12)" }}>
                    {g}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-ink-muted">Date of birth <span className="font-normal normal-case">(optional)</span></label>
              <input type="date" value={dob} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDob(e.target.value)} className={fieldCls} style={fieldStyle} />
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-ink-muted">Phone <span className="font-normal normal-case">(optional)</span></label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="98XXXXXXXX" className={fieldCls} style={fieldStyle} />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-ink-muted">Relationship / notes <span className="font-normal normal-case">(optional)</span></label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder="e.g. Mother, Son…" className={fieldCls} style={fieldStyle} />
          </div>

          {error && <p className="text-xs font-semibold" style={{ color: "#C0556B" }}>{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6 pt-3">
          <button type="button" onClick={onClose} disabled={saving} className="h-11 rounded-xl px-6 text-sm font-semibold text-ink-soft transition-all hover:bg-page disabled:opacity-40" style={{ border: "1.5px solid rgba(20,33,29,0.14)" }}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving || fullName.trim().length < 2}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
            style={{ background: fullName.trim().length >= 2 && !saving ? "#0C6B57" : "#e8e4de", color: fullName.trim().length >= 2 && !saving ? "#fff" : "#a0a8b4" }}>
            {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent" /> : isEdit ? "Save changes" : "Add member"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
