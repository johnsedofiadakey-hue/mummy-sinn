import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { storageBucketName } from "@/lib/admin/firebase";
import { adminApi, errorResponse, readJsonBody } from "@/lib/admin/guard";
import { createPromotion } from "@/lib/admin/repository";
import { parsePromotionInput } from "@/lib/admin/validation";
import { publishPublicContent } from "@/lib/public-content";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return adminApi(request, "promotions.write", async (actor, requestId) => {
    const parsed = parsePromotionInput(await readJsonBody(request), { bucket: storageBucketName() });
    if (!parsed.ok) return errorResponse(422, "INVALID_PROMOTION", "Please fix the highlighted fields.", parsed.errors);
    const id = await createPromotion(actor, parsed.value, requestId, adminDb);
    publishPublicContent();
    return NextResponse.json({ ok: true, id }, { status: 201 });
  });
}
