"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { User, Check, Users } from "lucide-react";
import type { FamilyMember } from "./family-member-modal";

export type PrefillPatient = { fullName: string; age: string; phone: string; gender: string };

function ageString(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 ? String(age) : "";
}

/**
 * Shows the signed-in user's saved family members as quick-pick chips that prefill
 * the booking form. Renders nothing for signed-out users or those with no saved members,
 * so the form looks unchanged when there's nothing to pick.
 */
export function FamilyMemberPicker({
  onSelect,
  activeId,
}: {
  onSelect: (member: FamilyMember, prefill: PrefillPatient) => void;
  activeId: string | null;
}) {
  const { isSignedIn } = useAuth();
  const [members, setMembers] = useState<FamilyMember[]>([]);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/patients")
      .then((r) => r.json())
      .then((d: { patients?: FamilyMember[] }) => setMembers(d.patients ?? []))
      .catch(() => {});
  }, [isSignedIn]);

  if (members.length === 0) return null;

  return (
    <div>
      <label className="mb-2 flex items-center gap-1.5" style={{ fontSize: "0.75rem", fontWeight: 600, color: "#46524D" }}>
        <Users className="h-3.5 w-3.5" style={{ color: "#0C6B57" }} />
        Booking for a family member?
      </label>
      <div className="flex flex-wrap gap-2">
        {members.map((m) => {
          const active = activeId === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m, { fullName: m.fullName, age: ageString(m.dateOfBirth), phone: m.phone ?? "", gender: m.gender ?? "" })}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors"
              style={{
                border: `1.5px solid ${active ? "#0C6B57" : "rgba(20,33,29,.14)"}`,
                background: active ? "#E6F0EC" : "#fff",
                color: active ? "#0C6B57" : "#46524D",
              }}
            >
              {active ? <Check className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
              {m.fullName}
            </button>
          );
        })}
      </div>
    </div>
  );
}
