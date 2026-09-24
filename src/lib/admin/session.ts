import "server-only";
import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { AdminAccessError, parseRole, parseStaff, resolveStaffContext, type RoleRecord, type StaffContext } from "@/lib/admin/permissions";

/** Firebase Hosting / App Hosting only forward a cookie with this exact name to the server. */
export const SESSION_COOKIE = "__session";
export const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // one working shift
const RECENT_SIGN_IN_MS = 5 * 60 * 1000;

/** Load the staff record and roles for a verified uid and resolve permissions (default deny). */
export async function loadStaffContext(uid: string, db: Firestore): Promise<StaffContext> {
  const staffSnap = await db.doc(`staff/${uid}`).get();
  const staff = staffSnap.exists ? parseStaff(staffSnap.data()) : null;
  const roles = new Map<string, RoleRecord | null>();
  if (staff?.isActive && staff.roleIds.length) {
    const snaps = await db.getAll(...staff.roleIds.map((id) => db.doc(`roles/${id}`)));
    snaps.forEach((snap, i) => roles.set(staff.roleIds[i], snap.exists ? parseRole(snap.data()) : null));
  }
  return resolveStaffContext(uid, staff, roles);
}

/**
 * Exchange a fresh Firebase ID token for an httpOnly session cookie — but only for active staff with a role.
 * Guests and deactivated staff never get a cookie.
 */
export async function createAdminSession(idToken: string, deps: { auth: Auth; db: Firestore }) {
  if (typeof idToken !== "string" || idToken.length < 20 || idToken.length > 4096) throw new AdminAccessError("NO_SESSION");
  let decoded;
  try { decoded = await deps.auth.verifyIdToken(idToken, true); } catch { throw new AdminAccessError("NO_SESSION"); }
  if (Date.now() - decoded.auth_time * 1000 > RECENT_SIGN_IN_MS) throw new AdminAccessError("NO_SESSION");
  const context = await loadStaffContext(decoded.uid, deps.db);
  const cookie = await deps.auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
  return { cookie, context };
}

/** Verify the session cookie (including revocation) and re-check staff status on every request. */
export async function readStaffContext(cookie: string | undefined, deps: { auth: Auth; db: Firestore }): Promise<StaffContext> {
  if (!cookie) throw new AdminAccessError("NO_SESSION");
  let uid: string;
  try { uid = (await deps.auth.verifySessionCookie(cookie, true)).uid; } catch { throw new AdminAccessError("NO_SESSION"); }
  return loadStaffContext(uid, deps.db);
}

export const sessionCookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/", maxAge: maxAgeSeconds,
});
