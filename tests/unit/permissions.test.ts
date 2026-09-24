import { test } from "node:test";
import assert from "node:assert/strict";
import { AdminAccessError, assertPermission, parseRole, parseStaff, resolveStaffContext, type RoleRecord } from "@/lib/admin/permissions";

const roles = (entries: Record<string, RoleRecord | null>) => new Map(Object.entries(entries));
const manager: RoleRecord = { name: "Manager", permissions: ["dashboard.read", "menu.read", "menu.write"], isActive: true };
const denied = (fn: () => unknown, reason: string) => assert.throws(fn, (e: unknown) => e instanceof AdminAccessError && e.reason === reason);

test("no uid → NO_SESSION (401)", () => {
  assert.throws(() => resolveStaffContext("", null, roles({})), (e: unknown) => e instanceof AdminAccessError && e.reason === "NO_SESSION" && e.status === 401);
});

test("signed-in user without a staff record is denied", () => denied(() => resolveStaffContext("u1", null, roles({})), "NOT_STAFF"));

test("inactive staff is denied even with a powerful role", () => {
  denied(() => resolveStaffContext("u1", { authUid: "u1", displayName: "A", roleIds: ["manager"], isActive: false }, roles({ manager })), "STAFF_INACTIVE");
});

test("staff doc whose authUid doesn't match the session is denied", () => {
  denied(() => resolveStaffContext("u1", { authUid: "someone-else", displayName: "A", roleIds: ["manager"], isActive: true }, roles({ manager })), "STAFF_UID_MISMATCH");
});

test("missing, inactive or unknown roles grant nothing", () => {
  const staff = { authUid: "u1", displayName: "A", roleIds: ["ghost", "retired", "weird"], isActive: true };
  denied(() => resolveStaffContext("u1", staff, roles({ ghost: null, retired: { ...manager, isActive: false }, weird: { name: "W", permissions: ["*", "orders.write", "admin"] } })), "NO_ROLES");
});

test("permissions come only from active roles; others are forbidden", () => {
  const ctx = resolveStaffContext("u1", { authUid: "u1", displayName: "A", roleIds: ["manager"], isActive: true }, roles({ manager }));
  assert.doesNotThrow(() => assertPermission(ctx, "menu.write"));
  denied(() => assertPermission(ctx, "settings.write"), "FORBIDDEN");
  denied(() => assertPermission(ctx, "uploads.write"), "FORBIDDEN");
});

test("malformed staff/role documents are treated as absent", () => {
  assert.equal(parseStaff({ authUid: "u1", isActive: "yes", roleIds: [] }), null);
  assert.equal(parseStaff({ authUid: "u1", isActive: true }), null);
  assert.equal(parseStaff(null), null);
  assert.equal(parseRole({ permissions: "menu.write" }), null);
  assert.equal(parseRole({ name: "R", permissions: [] })?.isActive, true);
});
