/**
 * Permission matrix — no server imports, safe to use in Client Components.
 */
import type { HospitalRole } from "@prisma/client";

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
