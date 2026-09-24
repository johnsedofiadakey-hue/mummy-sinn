import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { adminApi, errorResponse, readJsonBody } from "@/lib/admin/guard";
import { updateSettings } from "@/lib/admin/repository";
import { parseSettingsInput } from "@/lib/admin/validation";
import { publishPublicContent } from "@/lib/public-content";

export const runtime = "nodejs";

/** Only acceptingOrders, asapEnabled, notice and supportPhone can change here. */
export async function PUT(request: Request) {
  return adminApi(request, "settings.write", async (actor, requestId) => {
    const parsed = parseSettingsInput(await readJsonBody(request));
    if (!parsed.ok) return errorResponse(422, "INVALID_SETTINGS", "Please fix the highlighted fields.", parsed.errors);
    await updateSettings(actor, parsed.value, requestId, adminDb);
    publishPublicContent();
    return NextResponse.json({ ok: true });
  });
}
