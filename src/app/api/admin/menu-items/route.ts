import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { storageBucketName } from "@/lib/admin/firebase";
import { adminApi, errorResponse, readJsonBody } from "@/lib/admin/guard";
import { createMenuItem } from "@/lib/admin/repository";
import { parseMenuItemInput } from "@/lib/admin/validation";
import { publishPublicContent } from "@/lib/public-content";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return adminApi(request, "menu.write", async (actor, requestId) => {
    const parsed = parseMenuItemInput(await readJsonBody(request), { bucket: storageBucketName() });
    if (!parsed.ok) return errorResponse(422, "INVALID_MENU_ITEM", "Please fix the highlighted fields.", parsed.errors);
    const id = await createMenuItem(actor, parsed.value, requestId, adminDb);
    publishPublicContent();
    return NextResponse.json({ ok: true, id }, { status: 201 });
  });
}
