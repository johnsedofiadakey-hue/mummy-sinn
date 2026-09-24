import "server-only";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { adminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { categories as sampleCategories, menuItems as sampleMenuItems, publicSettings as sampleSettings, type PublicSettings } from "@/lib/mock-data";
import type { Category, MenuItem, ModifierGroup } from "@/types/domain";

// Student-facing catalog, settings and homepage promotion, read server-side and projected to safe display fields.
// Falls back to the bundled sample data whenever Firestore isn't configured, is empty, or can't be reached,
// so the PWA never breaks because of a missing document. Admin writes call revalidateTag(PUBLIC_CONTENT_TAG).

export const PUBLIC_CONTENT_TAG = "public-content";

/**
 * Call after every admin write. The tag refreshes cached Firestore reads; the path refreshes the ISR Home page
 * even when its prerender never registered the tag (e.g. it was built without Firebase credentials).
 */
export function publishPublicContent() {
  revalidateTag(PUBLIC_CONTENT_TAG);
  revalidatePath("/");
}
const FALLBACK_IMAGE = "/icon.svg";

type Data = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const int = (v: unknown) => (typeof v === "number" && Number.isSafeInteger(v) ? v : null);
const ts = (v: unknown) => (v && typeof v === "object" && "toMillis" in v && typeof (v as { toMillis: unknown }).toMillis === "function" ? (v as { toMillis: () => number }).toMillis() : null);

function toDisplayItem(id: string, d: Data): MenuItem | null {
  const pricePesewas = int(d.pricePesewas);
  if (!str(d.name) || !str(d.slug) || pricePesewas === null || d.isArchived === true) return null;
  const groups: ModifierGroup[] = (Array.isArray(d.modifierGroups) ? d.modifierGroups : []).map((g: Data) => ({
    id: str(g.id), name: str(g.name), min: int(g.min) ?? 0, max: int(g.max) ?? 1, required: (int(g.min) ?? 0) > 0,
    options: (Array.isArray(g.options) ? g.options : []).map((o: Data) => ({ id: str(o.id), name: str(o.name), priceAdjustment: (int(o.priceAdjustmentPesewas) ?? 0) / 100, ...(o.isDefault === true ? { isDefault: true } : {}) })),
  })).filter((g) => g.id && g.options.length);
  return {
    id, slug: str(d.slug), name: str(d.name), description: str(d.description), price: pricePesewas / 100, categoryId: str(d.categoryId),
    imageUrl: str(d.imageUrl) || FALLBACK_IMAGE, prepMinutes: int(d.prepMinutes) ?? 15, isAvailable: d.isAvailable === true,
    ...(str(d.badge) ? { badge: str(d.badge) } : {}), modifierGroups: groups,
  };
}

export type PublicCatalog = { categories: Category[]; menuItems: MenuItem[]; source: "firestore" | "sample" };
const SAMPLE_CATALOG: PublicCatalog = { categories: sampleCategories, menuItems: sampleMenuItems, source: "sample" };

const loadCatalog = unstable_cache(async (): Promise<PublicCatalog> => {
  const [cats, items] = await Promise.all([adminDb.collection("categories").where("isActive", "==", true).get(), adminDb.collection("menuItems").get()]);
  const menuItems = items.docs.map((d) => toDisplayItem(d.id, d.data())).filter((i): i is MenuItem => Boolean(i));
  if (!menuItems.length) return SAMPLE_CATALOG; // not seeded yet
  const categories = cats.docs.map((d) => ({ id: d.id, name: str(d.get("name")) || d.id, emoji: str(d.get("emoji")), sortOrder: int(d.get("sortOrder")) ?? 100, isActive: true })).sort((a, b) => a.sortOrder - b.sortOrder);
  return { categories, menuItems, source: "firestore" };
}, ["public-catalog"], { revalidate: 60, tags: [PUBLIC_CONTENT_TAG] });

export async function getPublicCatalog(): Promise<PublicCatalog> {
  if (!isFirebaseAdminConfigured()) return SAMPLE_CATALOG;
  try { return await loadCatalog(); } catch (error) { console.warn("[public-content] catalog fallback:", (error as Error).message); return SAMPLE_CATALOG; }
}

const loadSettings = unstable_cache(async (): Promise<PublicSettings | null> => {
  const snap = await adminDb.doc("settings/public").get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  if (typeof d.acceptingOrders !== "boolean" || typeof d.asapEnabled !== "boolean") return null;
  return { acceptingOrders: d.acceptingOrders, asapEnabled: d.asapEnabled, asapWindow: sampleSettings.asapWindow, notice: str(d.notice) || null, supportPhone: str(d.supportPhone) || null };
}, ["public-settings"], { revalidate: 60, tags: [PUBLIC_CONTENT_TAG] });

export async function getPublicSettings(): Promise<PublicSettings> {
  if (!isFirebaseAdminConfigured()) return sampleSettings;
  try { return (await loadSettings()) ?? sampleSettings; } catch (error) { console.warn("[public-content] settings fallback:", (error as Error).message); return sampleSettings; }
}

export type HomepagePromotion = { id: string; title: string; subtitle: string; priceLabel: string | null; href: string; imageUrl: string | null };
type CachedPromotion = HomepagePromotion & { startsAt: number | null; endsAt: number | null; priority: number };

const loadPromotions = unstable_cache(async (): Promise<CachedPromotion[]> => {
  const snap = await adminDb.collection("promotions").where("kind", "==", "homepage").where("isActive", "==", true).get();
  const promos = await Promise.all(snap.docs.map(async (d) => {
    const data = d.data(); const targetId = str(data.targetMenuItemId);
    const target = targetId ? await adminDb.doc(`menuItems/${targetId}`).get() : null;
    const targetItem = target?.exists ? toDisplayItem(target.id, target.data()!) : null;
    return {
      id: d.id, title: str(data.title), subtitle: str(data.subtitle), priceLabel: str(data.priceLabel) || null,
      href: targetItem ? `/menu/${targetItem.slug}` : "/menu", imageUrl: str(data.imageUrl) || targetItem?.imageUrl || null,
      startsAt: ts(data.startsAt), endsAt: ts(data.endsAt), priority: int(data.priority) ?? 0,
    };
  }));
  return promos.filter((p) => p.title);
}, ["public-homepage-promotions"], { revalidate: 60, tags: [PUBLIC_CONTENT_TAG] });

/** The live homepage promotion, or null (the Home page then shows its built-in hero). */
export async function getHomepagePromotion(now = Date.now()): Promise<HomepagePromotion | null> {
  if (!isFirebaseAdminConfigured()) return null;
  try {
    const live = (await loadPromotions()).filter((p) => (p.startsAt === null || p.startsAt <= now) && (p.endsAt === null || p.endsAt > now)).sort((a, b) => b.priority - a.priority)[0];
    if (!live) return null;
    return { id: live.id, title: live.title, subtitle: live.subtitle, priceLabel: live.priceLabel, href: live.href, imageUrl: live.imageUrl };
  } catch (error) { console.warn("[public-content] promotion fallback:", (error as Error).message); return null; }
}
