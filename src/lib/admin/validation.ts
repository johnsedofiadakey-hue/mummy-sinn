// Server-side validation for every admin write. Pure functions so they can be unit-tested without Firebase.
import { normaliseGhPhone } from "@/lib/phone";

export type FieldErrors = Record<string, string>;
export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

const MAX_PRICE_PESEWAS = 1_000_000; // GHS 10,000 — anything higher is a typo
const DOC_ID = /^[A-Za-z0-9_-]{1,100}$/;
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const isDocId = (value: unknown): value is string => typeof value === "string" && DOC_ID.test(value);

const obj = (value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const bool = (value: unknown) => (typeof value === "boolean" ? value : null);

/** "35", "35.5", "35.50" or 35.5 → 3550. Uses string arithmetic so floats never enter money maths. */
export function ghsToPesewas(input: unknown): number | null {
  const raw = typeof input === "number" && Number.isFinite(input) ? String(input) : typeof input === "string" ? input.trim().replace(/^GHS\s*/i, "") : "";
  const match = raw.match(/^(\d{1,5})(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}
export const pesewasToGhs = (pesewas: number) => (pesewas / 100).toFixed(2);

export const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\+/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

/** Images must come from our Storage bucket's public folders, the bundled /images folder, or the sample CDN. */
export function isAllowedImageUrl(value: string, bucket?: string): boolean {
  if (/^\/images\/[A-Za-z0-9/_.-]+\.(png|jpe?g|webp)$/.test(value) && !value.includes("..")) return true;
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  if (url.hostname === "images.unsplash.com") return true;
  if (url.hostname === "firebasestorage.googleapis.com") {
    const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
    return Boolean(match && (!bucket || match[1] === bucket) && PUBLIC_IMAGE_PATH.test(decodeURIComponent(match[2])));
  }
  return false;
}

export interface MenuItemInput {
  name: string; slug: string; description: string; categoryId: string; pricePesewas: number; prepMinutes: number;
  isAvailable: boolean; badge: string | null; imageUrl: string | null; modifierGroupIds: string[];
}

export function parseMenuItemInput(body: unknown, options: { bucket?: string } = {}): Parsed<MenuItemInput> {
  const data = obj(body); const errors: FieldErrors = {};
  if (!data) return { ok: false, errors: { form: "Invalid request." } };
  const name = text(data.name);
  if (name.length < 2 || name.length > 80) errors.name = "Name must be 2–80 characters.";
  const slug = text(data.slug) || slugify(name);
  if (!SLUG.test(slug) || slug.length < 2 || slug.length > 80) errors.slug = "Use lowercase letters, numbers and single hyphens (e.g. jollof-chicken).";
  const description = text(data.description);
  if (description.length > 300) errors.description = "Keep the description under 300 characters.";
  const categoryId = text(data.categoryId);
  if (!isDocId(categoryId)) errors.categoryId = "Choose a category.";
  const pricePesewas = ghsToPesewas(data.price);
  if (pricePesewas === null || pricePesewas < 1 || pricePesewas > MAX_PRICE_PESEWAS) errors.price = "Enter a price in GHS between 0.01 and 10,000, with at most 2 decimal places.";
  const prepMinutes = typeof data.prepMinutes === "string" && /^\d+$/.test(data.prepMinutes.trim()) ? Number(data.prepMinutes) : data.prepMinutes;
  if (typeof prepMinutes !== "number" || !Number.isInteger(prepMinutes) || prepMinutes < 1 || prepMinutes > 180) errors.prepMinutes = "Prep time must be a whole number of minutes from 1 to 180.";
  const isAvailable = bool(data.isAvailable);
  if (isAvailable === null) errors.isAvailable = "Choose whether the dish is available.";
  const badge = text(data.badge);
  if (badge.length > 24) errors.badge = "Keep the badge under 24 characters.";
  const imageUrl = text(data.imageUrl);
  if (imageUrl && (imageUrl.length > 600 || !isAllowedImageUrl(imageUrl, options.bucket))) errors.imageUrl = "Upload an image, or use an image already in the app's image library.";
  const ids = Array.isArray(data.modifierGroupIds) ? data.modifierGroupIds : data.modifierGroupIds === undefined ? [] : null;
  if (!ids || ids.length > 10 || ids.some((id) => !isDocId(id))) errors.modifierGroupIds = "Choose up to 10 valid option groups.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name, slug, description, categoryId, pricePesewas: pricePesewas!, prepMinutes: prepMinutes as number, isAvailable: isAvailable!, badge: badge || null, imageUrl: imageUrl || null, modifierGroupIds: [...new Set(ids as string[])] } };
}

export interface PromotionInput {
  title: string; subtitle: string; priceLabel: string | null; targetMenuItemId: string | null; imageUrl: string | null;
  startsAt: Date; endsAt: Date | null; isActive: boolean; priority: number;
}

const date = (value: unknown) => { if (typeof value !== "string" || !value.trim()) return null; const d = new Date(value); return Number.isNaN(d.getTime()) ? undefined : d; };

export function parsePromotionInput(body: unknown, options: { bucket?: string } = {}): Parsed<PromotionInput> {
  const data = obj(body); const errors: FieldErrors = {};
  if (!data) return { ok: false, errors: { form: "Invalid request." } };
  const title = text(data.title);
  if (title.length < 2 || title.length > 60) errors.title = "Title must be 2–60 characters.";
  const subtitle = text(data.subtitle);
  if (subtitle.length > 120) errors.subtitle = "Keep the subtitle under 120 characters.";
  const priceLabel = text(data.priceLabel);
  if (priceLabel.length > 24) errors.priceLabel = "Keep the price label under 24 characters (e.g. \"From GHS 30\").";
  const target = text(data.targetMenuItemId);
  if (target && !isDocId(target)) errors.targetMenuItemId = "Choose a dish from the list.";
  const imageUrl = text(data.imageUrl);
  if (imageUrl && (imageUrl.length > 600 || !isAllowedImageUrl(imageUrl, options.bucket))) errors.imageUrl = "Upload an image, or use an image already in the app's image library.";
  const startsAt = date(data.startsAt); const endsAt = date(data.endsAt);
  if (!startsAt) errors.startsAt = "Choose when the promotion starts.";
  if (endsAt === undefined) errors.endsAt = "Enter a valid end date, or leave it empty.";
  if (startsAt && endsAt && endsAt <= startsAt) errors.endsAt = "The end must be after the start.";
  const isActive = bool(data.isActive);
  if (isActive === null) errors.isActive = "Choose whether the promotion is live.";
  const priority = typeof data.priority === "string" && /^\d+$/.test(data.priority.trim()) ? Number(data.priority) : data.priority ?? 0;
  if (typeof priority !== "number" || !Number.isInteger(priority) || priority < 0 || priority > 100) errors.priority = "Priority must be a whole number from 0 to 100.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { title, subtitle, priceLabel: priceLabel || null, targetMenuItemId: target || null, imageUrl: imageUrl || null, startsAt: startsAt!, endsAt: endsAt ?? null, isActive: isActive!, priority: priority as number } };
}

export interface SettingsInput { acceptingOrders: boolean; asapEnabled: boolean; notice: string | null; supportPhone: string | null; }

export function parseSettingsInput(body: unknown): Parsed<SettingsInput> {
  const data = obj(body); const errors: FieldErrors = {};
  if (!data) return { ok: false, errors: { form: "Invalid request." } };
  const acceptingOrders = bool(data.acceptingOrders); const asapEnabled = bool(data.asapEnabled);
  if (acceptingOrders === null) errors.acceptingOrders = "Choose whether the kitchen is taking orders.";
  if (asapEnabled === null) errors.asapEnabled = "Choose whether ASAP delivery is on.";
  const notice = text(data.notice);
  if (notice.length > 140) errors.notice = "Keep the notice under 140 characters.";
  const phoneText = text(data.supportPhone);
  const supportPhone = phoneText ? normaliseGhPhone(phoneText) : null;
  if (phoneText && !supportPhone) errors.supportPhone = "Enter a Ghana phone number, e.g. 024 123 4567, or leave it empty.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { acceptingOrders: acceptingOrders!, asapEnabled: asapEnabled!, notice: notice || null, supportPhone } };
}

// ---- Image uploads -------------------------------------------------------------------------

export const UPLOAD_MAX_BYTES = 3 * 1024 * 1024;
export type UploadPurpose = "menu-item" | "promotion";
export const UPLOAD_FOLDERS: Record<UploadPurpose, string> = { "menu-item": "public/menu-images", promotion: "public/promotions" };
/** The only object paths the app ever writes, and the only public-readable ones in storage.rules. */
export const PUBLIC_IMAGE_PATH = /^public\/(menu-images|promotions)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

const SIGNATURES: { contentType: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp"; matches: (b: Uint8Array) => boolean }[] = [
  { contentType: "image/jpeg", ext: "jpg", matches: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { contentType: "image/png", ext: "png", matches: (b) => b.length > 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, i) => b[i] === byte) },
  { contentType: "image/webp", ext: "webp", matches: (b) => b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP" },
];

export type ValidatedUpload = { contentType: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" };

/** Checks size and the file's real bytes. The browser's declared type must agree with the bytes; the filename is ignored. */
export function validateImageUpload(file: { declaredType: string; size: number; bytes: Uint8Array }): { ok: true; value: ValidatedUpload } | { ok: false; error: string } {
  if (file.size <= 0 || file.bytes.length === 0) return { ok: false, error: "The file is empty." };
  if (file.size > UPLOAD_MAX_BYTES || file.bytes.length > UPLOAD_MAX_BYTES) return { ok: false, error: "Images must be 3 MB or smaller." };
  const detected = SIGNATURES.find((signature) => signature.matches(file.bytes));
  if (!detected) return { ok: false, error: "Upload a JPG, PNG or WebP image." };
  if (file.declaredType !== detected.contentType) return { ok: false, error: "The file type doesn't match its contents." };
  return { ok: true, value: { contentType: detected.contentType, ext: detected.ext } };
}

/** Server-generated object path. Client filenames and paths are never used. */
export const storagePathFor = (purpose: UploadPurpose, ext: ValidatedUpload["ext"], id: string) => {
  const path = `${UPLOAD_FOLDERS[purpose]}/${id}.${ext}`;
  if (!PUBLIC_IMAGE_PATH.test(path)) throw new Error("Refusing to build an unexpected storage path.");
  return path;
};
export const publicImageUrl = (bucket: string, path: string) => `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
