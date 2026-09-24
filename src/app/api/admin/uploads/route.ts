import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { adminBucket, storageBucketName } from "@/lib/admin/firebase";
import { adminApi, errorResponse } from "@/lib/admin/guard";
import { attachImage, targetExists } from "@/lib/admin/repository";
import { isDocId, PUBLIC_IMAGE_PATH, publicImageUrl, storagePathFor, UPLOAD_MAX_BYTES, validateImageUpload, type UploadPurpose } from "@/lib/admin/validation";
import { publishPublicContent } from "@/lib/public-content";

export const runtime = "nodejs";

/**
 * POST /api/admin/uploads?purpose=menu-item|promotion&targetId=<doc id>  (multipart field "file")
 * The purpose is in the URL so permissions are checked before any bytes are read. The object path is
 * generated here; the client's filename and any client path are ignored.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const purpose = url.searchParams.get("purpose") as UploadPurpose | null;
  const targetId = url.searchParams.get("targetId");
  if (purpose !== "menu-item" && purpose !== "promotion") return errorResponse(400, "INVALID_PURPOSE", "Unknown upload type.");
  if (!isDocId(targetId)) return errorResponse(400, "INVALID_TARGET", "Save the item before adding an image.");

  return adminApi(request, ["uploads.write", purpose === "menu-item" ? "menu.write" : "promotions.write"], async (actor, requestId) => {
    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (!declaredLength || declaredLength > UPLOAD_MAX_BYTES + 64 * 1024) return errorResponse(413, "FILE_TOO_LARGE", "Images must be 3 MB or smaller.");
    if (!(await targetExists(purpose, targetId, adminDb))) return errorResponse(404, "NOT_FOUND", "The item this image belongs to no longer exists.");

    let file: FormDataEntryValue | null;
    try { file = (await request.formData()).get("file"); } catch { return errorResponse(400, "INVALID_UPLOAD", "Upload a single image file."); }
    if (!(file instanceof File)) return errorResponse(400, "INVALID_UPLOAD", "Upload a single image file.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const checked = validateImageUpload({ declaredType: file.type, size: file.size, bytes });
    if (!checked.ok) return errorResponse(422, "INVALID_IMAGE", checked.error);

    const bucket = adminBucket();
    const path = storagePathFor(purpose, checked.value.ext, randomUUID());
    const object = bucket.file(path);
    await object.save(Buffer.from(bytes), { resumable: false, contentType: checked.value.contentType, metadata: { cacheControl: "public, max-age=31536000, immutable" } });
    const imageUrl = publicImageUrl(storageBucketName(), path);

    let previousPath: string | null;
    try {
      previousPath = await attachImage(actor, purpose, targetId, { url: imageUrl, path }, requestId, adminDb);
    } catch (error) {
      await object.delete({ ignoreNotFound: true }).catch(() => undefined); // don't leave an orphaned public file
      throw error;
    }
    if (previousPath && previousPath !== path && PUBLIC_IMAGE_PATH.test(previousPath)) {
      await bucket.file(previousPath).delete({ ignoreNotFound: true }).catch((error) => console.warn(`[admin] ${requestId} old image not removed`, error));
    }
    publishPublicContent();
    return NextResponse.json({ ok: true, imageUrl, path }, { status: 201 });
  });
}
