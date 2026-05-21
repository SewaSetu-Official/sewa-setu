import type { HospitalRole, UserRole } from "@prisma/client";

export const HOSPITAL_ROLE_LABELS = {
  OWNER: "Owner",
  MANAGER: "Manager",
  RECEPTIONIST: "Receptionist",
  DOCTOR: "Doctor",
  STAFF: "Staff",
} satisfies Record<HospitalRole, string>;

export const PLATFORM_ROLE_LABELS = {
  USER: "Standard User",
  PLATFORM_SUPPORT: "Platform Support",
  PLATFORM_ADMIN: "Platform Admin",
} satisfies Record<UserRole, string>;

export const ACCESS_REQUEST_ROLES = [
  "MANAGER",
  "RECEPTIONIST",
  "DOCTOR",
  "STAFF",
] as const satisfies readonly HospitalRole[];

export const TEAM_ASSIGNABLE_ROLES = [
  "OWNER",
  "MANAGER",
  "RECEPTIONIST",
  "DOCTOR",
  "STAFF",
] as const satisfies readonly HospitalRole[];

export const MANAGER_ASSIGNABLE_ROLES = [
  "RECEPTIONIST",
  "DOCTOR",
  "STAFF",
] as const satisfies readonly HospitalRole[];

export function isPlatformAdmin(role: string): boolean {
  return role === "PLATFORM_ADMIN";
}

export function isPlatformStaff(role: string): boolean {
  return role === "PLATFORM_ADMIN" || role === "PLATFORM_SUPPORT";
}

export function getAssignableHospitalRoles(actorRole: HospitalRole): readonly HospitalRole[] {
  if (actorRole === "OWNER") return TEAM_ASSIGNABLE_ROLES;
  if (actorRole === "MANAGER") return MANAGER_ASSIGNABLE_ROLES;
  return [];
}

export function canManageHospitalMember(actorRole: HospitalRole, targetRole: HospitalRole): boolean {
  if (actorRole === "OWNER") return true;
  if (actorRole === "MANAGER") return (MANAGER_ASSIGNABLE_ROLES as readonly HospitalRole[]).includes(targetRole);
  return false;
}
