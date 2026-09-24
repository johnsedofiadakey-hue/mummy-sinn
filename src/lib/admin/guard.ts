import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { adminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { adminAuth } from "@/lib/admin/firebase";
import { AdminAccessError, assertPermission, denialMessage, type Permission, type StaffContext } from "@/lib/admin/permissions";
import { AdminInputError } from "@/lib/admin/repository";
import { readStaffContext, SESSION_COOKIE } from "@/lib/admin/session";

/** Server components: every admin page calls this itself (layouts are not re-run on client navigation). */
export async function requireAdminPage(permission?: Permission): Promise<StaffContext> {
  if (!isFirebaseAdminConfigured()) redirect("/admin/denied?reason=NOT_CONFIGURED");
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  let context: StaffContext;
  try { context = await readStaffContext(cookie, { auth: adminAuth(), db: adminDb }); } catch (error) {
    if (error instanceof AdminAccessError) redirect(error.reason === "NO_SESSION" ? "/admin/sign-in" : `/admin/denied?reason=${error.reason}`);
    throw error;
  }
  if (permission) { try { assertPermission(context, permission); } catch { redirect("/admin/denied?reason=FORBIDDEN"); } }
  return context;
}

/** Mutations must come from our own pages: SameSite=strict cookie plus an explicit Origin check. */
export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

const json = (body: unknown, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export const errorResponse = (status: number, code: string, message: string, fieldErrors?: Record<string, string>) => json({ error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) } }, status);

/**
 * Route-handler guard: same-origin → valid, unrevoked staff session → active staff → permission → handler.
 * Every admin API route goes through this; UI hiding is never relied on.
 */
export async function adminApi(request: Request, permissions: Permission | Permission[], handler: (context: StaffContext, requestId: string) => Promise<Response>): Promise<Response> {
  const requestId = randomUUID();
  if (request.method !== "GET" && !isSameOrigin(request)) return errorResponse(403, "CROSS_ORIGIN", "Request blocked.");
  if (!isFirebaseAdminConfigured()) return errorResponse(503, "NOT_CONFIGURED", "The admin portal isn't connected to Firebase yet.");
  try {
    const context = await readStaffContext((await cookies()).get(SESSION_COOKIE)?.value, { auth: adminAuth(), db: adminDb });
    for (const permission of Array.isArray(permissions) ? permissions : [permissions]) assertPermission(context, permission);
    return await handler(context, requestId);
  } catch (error) {
    if (error instanceof AdminAccessError) return errorResponse(error.status, error.reason, denialMessage[error.reason]);
    if (error instanceof AdminInputError) return errorResponse(error.status, error.code, error.message, error.fieldErrors);
    console.error(`[admin] ${requestId}`, error);
    return errorResponse(500, "SERVER_ERROR", `Something went wrong. Reference: ${requestId.slice(0, 8)}`);
  }
}

/** Parse a JSON body without letting a huge or malformed payload through. */
export async function readJsonBody(request: Request, maxBytes = 32_000): Promise<unknown> {
  const text = await request.text();
  if (text.length > maxBytes) throw new AdminInputError("PAYLOAD_TOO_LARGE", 413, "That request is too large.");
  try { return JSON.parse(text); } catch { throw new AdminInputError("INVALID_JSON", 400, "Invalid request."); }
}
