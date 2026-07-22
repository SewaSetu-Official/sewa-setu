import { db } from "@/lib/db";

/**
 * Platform-wide settings, stored one row per key in PlatformSetting (JSON value).
 * Every getter falls back to a sensible default so the app works before an admin
 * has saved anything.
 */

export type ChecklistTemplateItem = { title: string; isRequired: boolean };
export type PlatformDefaults = {
  currency: string;
  contactEmail: string;
  supportPhone: string;
  cities: string[];
};

export const SETTING_KEYS = {
  checklist: "onboarding_checklist",
  defaults: "platform_defaults",
} as const;

// The original hardcoded launch checklist — now the fallback template.
export const DEFAULT_ONBOARDING_CHECKLIST: ChecklistTemplateItem[] = [
  { title: "Hospital basic info added", isRequired: true },
  { title: "Location verified", isRequired: true },
  { title: "Departments added", isRequired: true },
  { title: "Doctors added", isRequired: true },
  { title: "Schedules configured", isRequired: true },
  { title: "Packages configured", isRequired: true },
  { title: "Hospital media added", isRequired: true },
  { title: "Owner account linked", isRequired: true },
  { title: "Hospital confirmation received", isRequired: true },
];

export const DEFAULT_PLATFORM_DEFAULTS: PlatformDefaults = {
  currency: "EUR",
  contactEmail: "",
  supportPhone: "",
  cities: [],
};

export async function getChecklistTemplate(): Promise<ChecklistTemplateItem[]> {
  const row = await db.platformSetting.findUnique({ where: { key: SETTING_KEYS.checklist } });
  const items = (row?.value as { items?: ChecklistTemplateItem[] } | null)?.items;
  return Array.isArray(items) && items.length > 0 ? items : DEFAULT_ONBOARDING_CHECKLIST;
}

export async function getPlatformDefaults(): Promise<PlatformDefaults> {
  const row = await db.platformSetting.findUnique({ where: { key: SETTING_KEYS.defaults } });
  return { ...DEFAULT_PLATFORM_DEFAULTS, ...((row?.value as Partial<PlatformDefaults> | null) ?? {}) };
}
