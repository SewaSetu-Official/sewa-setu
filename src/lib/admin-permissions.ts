/**
 * Permission matrix — no server imports, safe to use in Client Components.
 */
import type { HospitalRole, UserRole } from "@prisma/client";

const PERMISSIONS = {
  VIEW_BOOKINGS:         ["OWNER", "MANAGER", "RECEPTIONIST", "DOCTOR"],
  CONFIRM_BOOKING:       ["OWNER", "MANAGER", "RECEPTIONIST"],
  CANCEL_BOOKING:        ["OWNER", "MANAGER", "RECEPTIONIST"],
  COMPLETE_BOOKING:      ["OWNER", "MANAGER", "DOCTOR"],
  CHECKIN_BOOKING:       ["OWNER", "MANAGER", "RECEPTIONIST"],
  RESCHEDULE_BOOKING:    ["OWNER", "MANAGER", "RECEPTIONIST"],
  VIEW_DOCTORS:          ["OWNER", "MANAGER", "RECEPTIONIST"],
  VIEW_AVAILABILITY:     ["OWNER", "MANAGER", "RECEPTIONIST", "DOCTOR"],
  MANAGE_DOCTORS:        ["OWNER", "MANAGER"],
  MANAGE_AVAILABILITY:   ["OWNER", "MANAGER"],
  MANAGE_PACKAGES:       ["OWNER", "MANAGER"],
  MODERATE_REVIEWS:      ["OWNER", "MANAGER"],
  VIEW_TEAM:             ["OWNER", "MANAGER"],
  APPROVE_TEAM_MEMBERS:  ["OWNER", "MANAGER"],
  MANAGE_TEAM_ROLES:     ["OWNER", "MANAGER"],
  REMOVE_TEAM_MEMBERS:   ["OWNER", "MANAGER"],
  VIEW_REPORTS:          ["OWNER", "MANAGER"],
  VIEW_OWNER_BUSINESS:   ["OWNER"],
  EXPORT_HOSPITAL_DATA:  ["OWNER"],
  VIEW_STAFF_TASKS:      ["OWNER", "MANAGER", "STAFF"],
  MANAGE_STAFF_TASKS:    ["OWNER", "MANAGER"],
  MANAGE_PUBLIC_PROFILE: ["OWNER", "MANAGER"],
  MANAGE_OWNER_CONTROLS: ["OWNER"],
  MANAGE_SETTINGS:       ["OWNER"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: HospitalRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}

// ─── Platform permission matrix ─────────────────────────────────────────────
//
// Single source of truth for what each PLATFORM role can do. Drives the
// platform nav, page access guards, and (for governance actions) API routes.
// PLATFORM_SUPPORT's data is additionally scoped to assigned hospitals at the
// route layer — this matrix only answers "is this capability available at all".
//
// Principle: SUPPORT = read + onboarding/setup write on assigned hospitals.
// ADMIN = everything, including governance (users, hospital status, settings,
// finalising onboarding/inquiries).

const PLATFORM_PERMISSIONS = {
  // Section access (nav + page guards)
  VIEW_DASHBOARD:         ["PLATFORM_ADMIN", "PLATFORM_SUPPORT"],
  VIEW_HOSPITALS:         ["PLATFORM_ADMIN", "PLATFORM_SUPPORT"],
  VIEW_INQUIRIES:         ["PLATFORM_ADMIN", "PLATFORM_SUPPORT"],
  VIEW_ONBOARDING:        ["PLATFORM_ADMIN", "PLATFORM_SUPPORT"],
  VIEW_BOOKINGS:          ["PLATFORM_ADMIN", "PLATFORM_SUPPORT"],
  VIEW_REVENUE:           ["PLATFORM_ADMIN", "PLATFORM_SUPPORT"],
  VIEW_AUDIT_LOGS:        ["PLATFORM_ADMIN", "PLATFORM_SUPPORT"],
  VIEW_USERS:             ["PLATFORM_ADMIN"],
  MANAGE_SUPPORT:         ["PLATFORM_ADMIN"],
  MANAGE_SETTINGS:        ["PLATFORM_ADMIN"],

  // Write / governance actions
  MANAGE_USERS:           ["PLATFORM_ADMIN"],
  MANAGE_HOSPITAL_STATUS: ["PLATFORM_ADMIN"],
  TRIAGE_INQUIRIES:       ["PLATFORM_ADMIN", "PLATFORM_SUPPORT"],
  FINALIZE_INQUIRY:       ["PLATFORM_ADMIN"],
  CREATE_ONBOARDING:      ["PLATFORM_ADMIN"],
  EDIT_ONBOARDING_DATA:   ["PLATFORM_ADMIN", "PLATFORM_SUPPORT"],
  PUBLISH_ONBOARDING:     ["PLATFORM_ADMIN"],
} as const;

export type PlatformPermission = keyof typeof PLATFORM_PERMISSIONS;

export function hasPlatformPermission(role: UserRole, permission: PlatformPermission): boolean {
  return (PLATFORM_PERMISSIONS[permission] as readonly string[]).includes(role);
}
