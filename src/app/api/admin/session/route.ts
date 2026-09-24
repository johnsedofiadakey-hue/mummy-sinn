import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { adminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { adminAuth } from "@/lib/admin/firebase";
import { errorResponse, isSameOrigin } from "@/lib/admin/guard";
import { AdminAccessError, denialMessage } from "@/lib/admin/permissions";
import { createAdminSession, SESSION_COOKIE, SESSION_MAX_AGE_MS, sessionCookieOptions } from "@/lib/admin/session";

export const runtime = "nodejs";

/** Sign in: exchange a fresh Firebase ID token for an httpOnly session cookie (active staff only). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse(403, "CROSS_ORIGIN", "Request blocked.");
  if (!isFirebaseAdminConfigured()) return errorResponse(503, "NOT_CONFIGURED", "The admin portal isn't connected to Firebase yet.");
  let idToken: unknown;
  try { idToken = ((await request.json()) as { idToken?: unknown }).idToken; } catch { return errorResponse(400, "INVALID_JSON", "Invalid request."); }
  try {
    const { cookie, context } = await createAdminSession(String(idToken ?? ""), { auth: adminAuth(), db: adminDb });
    const response = NextResponse.json({ ok: true, displayName: context.displayName }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(SESSION_COOKIE, cookie, sessionCookieOptions(SESSION_MAX_AGE_MS / 1000));
    return response;
  } catch (error) {
    if (error instanceof AdminAccessError) return errorResponse(error.status, error.reason, denialMessage[error.reason]);
    console.error("[admin] sign-in failed", error);
    return errorResponse(500, "SERVER_ERROR", "Sign-in failed. Please try again.");
  }
}

/** Sign out: clear the cookie and revoke the user's sessions everywhere. */
export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return errorResponse(403, "CROSS_ORIGIN", "Request blocked.");
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (cookie && isFirebaseAdminConfigured()) {
    try { const { uid } = await adminAuth().verifySessionCookie(cookie); await adminAuth().revokeRefreshTokens(uid); } catch { /* already invalid */ }
  }
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return response;
}
