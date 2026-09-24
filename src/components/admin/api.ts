"use client";

export type ApiResult<T = Record<string, unknown>> = { ok: true; data: T } | { ok: false; status: number; code: string; message: string; fieldErrors: Record<string, string> };

/** Thin JSON client for /api/admin. The server does all validation and authorisation. */
export async function adminFetch<T = Record<string, unknown>>(url: string, init: { method: string; body?: unknown; form?: FormData }): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method, credentials: "same-origin", cache: "no-store",
      ...(init.form ? { body: init.form } : init.body !== undefined ? { body: JSON.stringify(init.body), headers: { "Content-Type": "application/json" } } : {}),
    });
  } catch {
    return { ok: false, status: 0, code: "NETWORK", message: "No connection. Check your internet and try again.", fieldErrors: {} };
  }
  const payload = await response.json().catch(() => ({})) as { error?: { code?: string; message?: string; fieldErrors?: Record<string, string> } };
  if (response.status === 401 && typeof window !== "undefined") window.location.assign("/admin/sign-in");
  if (!response.ok) return { ok: false, status: response.status, code: payload.error?.code ?? "ERROR", message: payload.error?.message ?? "Something went wrong.", fieldErrors: payload.error?.fieldErrors ?? {} };
  return { ok: true, data: payload as T };
}
