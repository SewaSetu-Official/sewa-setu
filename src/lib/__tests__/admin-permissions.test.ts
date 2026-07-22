import { describe, it, expect } from "vitest";
import type { HospitalRole, UserRole } from "@prisma/client";
import {
  hasPermission,
  hasPlatformPermission,
  type Permission,
  type PlatformPermission,
} from "@/lib/admin-permissions";
import {
  getAssignableHospitalRoles,
  canManageHospitalMember,
  isPlatformAdmin,
  isPlatformStaff,
} from "@/lib/admin-roles";

/**
 * The permission matrix is the security boundary for the hospital workspace.
 * This suite pins down the full role × permission grid so any future edit that
 * widens (or narrows) access fails loudly instead of silently shipping.
 *
 * If a change to admin-permissions.ts is intentional, update the expected grid
 * below in the same commit.
 */

const ROLES: HospitalRole[] = ["OWNER", "MANAGER", "RECEPTIONIST", "DOCTOR", "STAFF"];

// Expected allow-list per permission. Keep alphabetised within each row.
const EXPECTED: Record<Permission, HospitalRole[]> = {
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
};

describe("hasPermission — full role × permission grid", () => {
  for (const permission of Object.keys(EXPECTED) as Permission[]) {
    const allowed = EXPECTED[permission];
    for (const role of ROLES) {
      const shouldAllow = allowed.includes(role);
      it(`${role} ${shouldAllow ? "CAN" : "cannot"} ${permission}`, () => {
        expect(hasPermission(role, permission)).toBe(shouldAllow);
      });
    }
  }
});

describe("permission invariants", () => {
  it("OWNER holds every permission", () => {
    for (const permission of Object.keys(EXPECTED) as Permission[]) {
      expect(hasPermission("OWNER", permission)).toBe(true);
    }
  });

  it("only OWNER can manage settings / owner controls / business / exports", () => {
    const ownerOnly: Permission[] = [
      "MANAGE_SETTINGS",
      "MANAGE_OWNER_CONTROLS",
      "VIEW_OWNER_BUSINESS",
      "EXPORT_HOSPITAL_DATA",
    ];
    for (const permission of ownerOnly) {
      for (const role of ROLES) {
        expect(hasPermission(role, permission)).toBe(role === "OWNER");
      }
    }
  });

  it("DOCTOR cannot confirm, cancel, check-in or reschedule bookings", () => {
    expect(hasPermission("DOCTOR", "CONFIRM_BOOKING")).toBe(false);
    expect(hasPermission("DOCTOR", "CANCEL_BOOKING")).toBe(false);
    expect(hasPermission("DOCTOR", "CHECKIN_BOOKING")).toBe(false);
    expect(hasPermission("DOCTOR", "RESCHEDULE_BOOKING")).toBe(false);
  });

  it("RECEPTIONIST cannot complete bookings or manage the team", () => {
    expect(hasPermission("RECEPTIONIST", "COMPLETE_BOOKING")).toBe(false);
    expect(hasPermission("RECEPTIONIST", "MANAGE_TEAM_ROLES")).toBe(false);
    expect(hasPermission("RECEPTIONIST", "REMOVE_TEAM_MEMBERS")).toBe(false);
  });
});

describe("role-assignment ceilings", () => {
  it("OWNER can assign every hospital role", () => {
    expect(getAssignableHospitalRoles("OWNER")).toEqual([
      "OWNER", "MANAGER", "RECEPTIONIST", "DOCTOR", "STAFF",
    ]);
  });

  it("MANAGER cannot assign OWNER or MANAGER", () => {
    const assignable = getAssignableHospitalRoles("MANAGER");
    expect(assignable).not.toContain("OWNER");
    expect(assignable).not.toContain("MANAGER");
    expect(assignable).toEqual(["RECEPTIONIST", "DOCTOR", "STAFF"]);
  });

  it("non-managerial roles can assign nothing", () => {
    for (const role of ["RECEPTIONIST", "DOCTOR", "STAFF"] as HospitalRole[]) {
      expect(getAssignableHospitalRoles(role)).toEqual([]);
    }
  });

  it("MANAGER cannot manage an OWNER or another MANAGER", () => {
    expect(canManageHospitalMember("MANAGER", "OWNER")).toBe(false);
    expect(canManageHospitalMember("MANAGER", "MANAGER")).toBe(false);
    expect(canManageHospitalMember("MANAGER", "RECEPTIONIST")).toBe(true);
  });

  it("OWNER can manage any member; staff cannot manage anyone", () => {
    for (const target of ROLES) {
      expect(canManageHospitalMember("OWNER", target)).toBe(true);
      expect(canManageHospitalMember("STAFF", target)).toBe(false);
    }
  });
});

// ─── Platform permission matrix ─────────────────────────────────────────────

const PLATFORM_ROLES: UserRole[] = ["PLATFORM_ADMIN", "PLATFORM_SUPPORT", "USER"];

// Expected allow-list per platform permission.
const EXPECTED_PLATFORM: Record<PlatformPermission, UserRole[]> = {
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
  MANAGE_USERS:           ["PLATFORM_ADMIN"],
  MANAGE_HOSPITAL_STATUS: ["PLATFORM_ADMIN"],
  TRIAGE_INQUIRIES:       ["PLATFORM_ADMIN", "PLATFORM_SUPPORT"],
  FINALIZE_INQUIRY:       ["PLATFORM_ADMIN"],
  CREATE_ONBOARDING:      ["PLATFORM_ADMIN"],
  EDIT_ONBOARDING_DATA:   ["PLATFORM_ADMIN", "PLATFORM_SUPPORT"],
  PUBLISH_ONBOARDING:     ["PLATFORM_ADMIN"],
};

describe("hasPlatformPermission — full role × permission grid", () => {
  for (const permission of Object.keys(EXPECTED_PLATFORM) as PlatformPermission[]) {
    const allowed = EXPECTED_PLATFORM[permission];
    for (const role of PLATFORM_ROLES) {
      const shouldAllow = allowed.includes(role);
      it(`${role} ${shouldAllow ? "CAN" : "cannot"} ${permission}`, () => {
        expect(hasPlatformPermission(role, permission)).toBe(shouldAllow);
      });
    }
  }
});

describe("platform permission invariants", () => {
  it("a standard USER has no platform permissions", () => {
    for (const permission of Object.keys(EXPECTED_PLATFORM) as PlatformPermission[]) {
      expect(hasPlatformPermission("USER", permission)).toBe(false);
    }
  });

  it("PLATFORM_ADMIN holds every platform permission", () => {
    for (const permission of Object.keys(EXPECTED_PLATFORM) as PlatformPermission[]) {
      expect(hasPlatformPermission("PLATFORM_ADMIN", permission)).toBe(true);
    }
  });

  it("PLATFORM_SUPPORT can never perform governance actions", () => {
    const governance: PlatformPermission[] = [
      "VIEW_USERS",
      "MANAGE_USERS",
      "MANAGE_SUPPORT",
      "MANAGE_SETTINGS",
      "MANAGE_HOSPITAL_STATUS",
      "FINALIZE_INQUIRY",
      "CREATE_ONBOARDING",
      "PUBLISH_ONBOARDING",
    ];
    for (const permission of governance) {
      expect(hasPlatformPermission("PLATFORM_SUPPORT", permission)).toBe(false);
    }
  });

  it("PLATFORM_SUPPORT can read sections and write onboarding/setup data", () => {
    const allowed: PlatformPermission[] = [
      "VIEW_DASHBOARD",
      "VIEW_HOSPITALS",
      "VIEW_INQUIRIES",
      "VIEW_ONBOARDING",
      "VIEW_BOOKINGS",
      "VIEW_REVENUE",
      "VIEW_AUDIT_LOGS",
      "TRIAGE_INQUIRIES",
      "EDIT_ONBOARDING_DATA",
    ];
    for (const permission of allowed) {
      expect(hasPlatformPermission("PLATFORM_SUPPORT", permission)).toBe(true);
    }
  });
});

describe("platform role helpers", () => {
  it("isPlatformAdmin only true for PLATFORM_ADMIN", () => {
    expect(isPlatformAdmin("PLATFORM_ADMIN")).toBe(true);
    expect(isPlatformAdmin("PLATFORM_SUPPORT")).toBe(false);
    expect(isPlatformAdmin("USER")).toBe(false);
  });

  it("isPlatformStaff true for admin and support, false for standard user", () => {
    expect(isPlatformStaff("PLATFORM_ADMIN")).toBe(true);
    expect(isPlatformStaff("PLATFORM_SUPPORT")).toBe(true);
    expect(isPlatformStaff("USER")).toBe(false);
  });
});
