import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { storageBucketName } from "@/lib/admin/firebase";
import { adminApi, errorResponse, readJsonBody } from "@/lib/admin/guard";
import { setMenuItemArchived, setMenuItemAvailability, updateMenuItem } from "@/lib/admin/repository";
import { isDocId, parseMenuItemInput } from "@/lib/admin/validation";
import { publishPublicContent } from "@/lib/public-content";

export const runtime = "nodejs";

/** Body: { action: "update", item } | { action: "setAvailability", isAvailable } | { action: "archive" } | { action: "restore" } */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return adminApi(request, "menu.write", async (actor, requestId) => {
    const { id } = await params;
    if (!isDocId(id)) return errorResponse(404, "NOT_FOUND", "That dish doesn't exist.");
    const body = (await readJsonBody(request)) as { action?: unknown; item?: unknown; isAvailable?: unknown } | null;
    switch (body?.action) {
      case "update": {
        const parsed = parseMenuItemInput(body.item, { bucket: storageBucketName() });
        if (!parsed.ok) return errorResponse(422, "INVALID_MENU_ITEM", "Please fix the highlighted fields.", parsed.errors);
        await updateMenuItem(actor, id, parsed.value, requestId, adminDb);
        break;
      }
      case "setAvailability":
        if (typeof body.isAvailable !== "boolean") return errorResponse(422, "INVALID_REQUEST", "Choose available or unavailable.");
        await setMenuItemAvailability(actor, id, body.isAvailable, requestId, adminDb);
        break;
      case "archive": await setMenuItemArchived(actor, id, true, requestId, adminDb); break;
      case "restore": await setMenuItemArchived(actor, id, false, requestId, adminDb); break;
      default: return errorResponse(400, "INVALID_ACTION", "Unknown action.");
    }
    publishPublicContent();
    return NextResponse.json({ ok: true });
  });
}
