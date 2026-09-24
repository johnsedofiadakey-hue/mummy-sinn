import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { storageBucketName } from "@/lib/admin/firebase";
import { adminApi, errorResponse, readJsonBody } from "@/lib/admin/guard";
import { setPromotionActive, updatePromotion } from "@/lib/admin/repository";
import { isDocId, parsePromotionInput } from "@/lib/admin/validation";
import { publishPublicContent } from "@/lib/public-content";

export const runtime = "nodejs";

/** Body: { action: "update", promotion } | { action: "pause" } | { action: "activate" } */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return adminApi(request, "promotions.write", async (actor, requestId) => {
    const { id } = await params;
    if (!isDocId(id)) return errorResponse(404, "NOT_FOUND", "That promotion doesn't exist.");
    const body = (await readJsonBody(request)) as { action?: unknown; promotion?: unknown } | null;
    switch (body?.action) {
      case "update": {
        const parsed = parsePromotionInput(body.promotion, { bucket: storageBucketName() });
        if (!parsed.ok) return errorResponse(422, "INVALID_PROMOTION", "Please fix the highlighted fields.", parsed.errors);
        await updatePromotion(actor, id, parsed.value, requestId, adminDb);
        break;
      }
      case "pause": await setPromotionActive(actor, id, false, requestId, adminDb); break;
      case "activate": await setPromotionActive(actor, id, true, requestId, adminDb); break;
      default: return errorResponse(400, "INVALID_ACTION", "Unknown action.");
    }
    publishPublicContent();
    return NextResponse.json({ ok: true });
  });
}
