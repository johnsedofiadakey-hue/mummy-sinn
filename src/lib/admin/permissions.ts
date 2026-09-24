// Default-deny staff authorisation. Pure functions: no Firebase imports, so they are unit-testable.
// Access is granted only by an active `staff/{authUid}` document whose active `roles` list the permission.

export const PERMISSIONS = [
  "dashboard.read",
  "menu.read",
  "menu.write",
  "promotions.read",
  "promotions.write",
  "settings.read",
  "settings.write",
  "uploads.write",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export interface StaffRecord { authUid: string; displayName: string; roleIds: string[]; isActive: boolean; }
export interface RoleRecord { name: string; permissions: string[]; isActive?: boolean; }
export interface StaffContext { uid: string; displayName: string; roleIds: string[]; permissions: ReadonlySet<Permission>; }

export type AccessDenial = "NO_SESSION" | "NOT_STAFF" | "STAFF_INACTIVE" | "STAFF_UID_MISMATCH" | "NO_ROLES" | "FORBIDDEN";

export class AdminAccessError extends Error {
  constructor(public readonly reason: AccessDenial, public readonly status: 401 | 403 = reason === "NO_SESSION" ? 401 : 403) {
    super(reason);
  }
}

const isPermission = (value: unknown): value is Permission => typeof value === "string" && (PERMISSIONS as readonly string[]).includes(value);

/** Parse an untrusted Firestore `staff` document. Anything malformed is treated as "not staff". */
export function parseStaff(value: unknown): StaffRecord | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (typeof data.authUid !== "string" || typeof data.isActive !== "boolean" || !Array.isArray(data.roleIds)) return null;
  return {
    authUid: data.authUid,
    displayName: typeof data.displayName === "string" && data.displayName.trim() ? data.displayName.trim().slice(0, 80) : "Staff member",
    roleIds: data.roleIds.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 60),
    isActive: data.isActive,
  };
}

export function parseRole(value: unknown): RoleRecord | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (typeof data.name !== "string" || !Array.isArray(data.permissions)) return null;
  return { name: data.name, permissions: data.permissions.filter((p): p is string => typeof p === "string"), isActive: data.isActive !== false };
}

/**
 * Resolve the effective permissions for a signed-in uid. Throws AdminAccessError when the person has no access at all.
 * Unknown permission strings and inactive or missing roles grant nothing; there is no wildcard.
 */
export function resolveStaffContext(uid: string, staff: StaffRecord | null, roles: Map<string, RoleRecord | null>): StaffContext {
  if (!uid) throw new AdminAccessError("NO_SESSION");
  if (!staff) throw new AdminAccessError("NOT_STAFF");
  if (staff.authUid !== uid) throw new AdminAccessError("STAFF_UID_MISMATCH");
  if (!staff.isActive) throw new AdminAccessError("STAFF_INACTIVE");
  const permissions = new Set<Permission>();
  for (const roleId of staff.roleIds) {
    const role = roles.get(roleId);
    if (!role || role.isActive === false) continue;
    for (const permission of role.permissions) if (isPermission(permission)) permissions.add(permission);
  }
  if (!permissions.size) throw new AdminAccessError("NO_ROLES");
  return { uid, displayName: staff.displayName, roleIds: staff.roleIds, permissions };
}

export function assertPermission(context: StaffContext, permission: Permission) {
  if (!context.permissions.has(permission)) throw new AdminAccessError("FORBIDDEN");
}

export const can = (context: StaffContext, permission: Permission) => context.permissions.has(permission);

export const denialMessage: Record<AccessDenial, string> = {
  NO_SESSION: "Please sign in with your staff account.",
  NOT_STAFF: "This account isn't registered as Mummy's Inn staff.",
  STAFF_INACTIVE: "This staff account has been deactivated. Ask a manager to restore access.",
  STAFF_UID_MISMATCH: "This staff record doesn't match your sign-in. Ask a manager to fix it.",
  NO_ROLES: "Your staff account has no active role yet. Ask a manager to assign one.",
  FORBIDDEN: "You don't have permission to do that.",
};
