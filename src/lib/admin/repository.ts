import "server-only";
import { FieldValue, Timestamp, type DocumentReference, type Firestore, type Transaction } from "firebase-admin/firestore";
import type { StaffContext } from "@/lib/admin/permissions";
import type { MenuItemInput, PromotionInput, SettingsInput, UploadPurpose } from "@/lib/admin/validation";

// Trusted server reads/writes for the admin portal. Every mutation runs in a transaction that also
// writes its `auditLogs` entry, so a change can't land without its audit record (and vice versa).
// Public documents (menuItems, promotions, settings/public) never store staff UIDs; the audit log does.

export class AdminInputError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string, public readonly fieldErrors?: Record<string, string>) { super(message); }
}

type Data = Record<string, unknown>;
const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const millis = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : null);

// ---- Audit ---------------------------------------------------------------------------------

type AuditEntry = { action: string; entityType: string; entityId: string; before: Data | null; after: Data | null };
function writeAudit(tx: Transaction, db: Firestore, actor: StaffContext, requestId: string, entry: AuditEntry) {
  tx.create(db.collection("auditLogs").doc(), {
    actorType: "staff", actorId: actor.uid, action: entry.action, entityType: entry.entityType, entityId: entry.entityId,
    before: entry.before, after: entry.after, requestId, createdAt: FieldValue.serverTimestamp(),
  });
}

// ---- Categories & modifier groups (read-only here) ---------------------------------------

export interface AdminCategory { id: string; name: string; emoji: string; isActive: boolean; sortOrder: number }
export async function listCategories(db: Firestore): Promise<AdminCategory[]> {
  const snap = await db.collection("categories").get();
  return snap.docs.map((d) => ({ id: d.id, name: str(d.get("name"), d.id), emoji: str(d.get("emoji")), isActive: d.get("isActive") === true, sortOrder: num(d.get("sortOrder"), 100) })).sort((a, b) => a.sortOrder - b.sortOrder);
}

export interface AdminModifierOption { id: string; name: string; priceAdjustmentPesewas: number; isDefault?: boolean }
export interface AdminModifierGroup { id: string; name: string; min: number; max: number; isActive: boolean; options: AdminModifierOption[] }
const parseModifierGroup = (id: string, data: Data): AdminModifierGroup => ({
  id, name: str(data.name, id), min: Math.max(0, Math.trunc(num(data.min))), max: Math.max(1, Math.trunc(num(data.max, 1))), isActive: data.isActive === true,
  options: (Array.isArray(data.options) ? data.options : []).filter((o): o is Data => Boolean(o) && typeof o === "object").map((o) => ({
    id: str(o.id), name: str(o.name), priceAdjustmentPesewas: Math.trunc(num(o.priceAdjustmentPesewas)), ...(o.isDefault === true ? { isDefault: true } : {}),
  })).filter((o) => o.id && o.name),
});
export async function listModifierGroups(db: Firestore): Promise<AdminModifierGroup[]> {
  const snap = await db.collection("modifiers").get();
  return snap.docs.map((d) => parseModifierGroup(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name));
}

// ---- Menu items --------------------------------------------------------------------------

export interface AdminMenuItem {
  id: string; name: string; slug: string; description: string; categoryId: string; pricePesewas: number; prepMinutes: number;
  isAvailable: boolean; isArchived: boolean; badge: string | null; imageUrl: string | null; imagePath: string | null; modifierGroupIds: string[]; updatedAt: number | null;
}
const toMenuItem = (id: string, d: Data): AdminMenuItem => ({
  id, name: str(d.name), slug: str(d.slug), description: str(d.description), categoryId: str(d.categoryId), pricePesewas: Math.trunc(num(d.pricePesewas)), prepMinutes: Math.trunc(num(d.prepMinutes, 15)),
  isAvailable: d.isAvailable === true, isArchived: d.isArchived === true, badge: str(d.badge) || null, imageUrl: str(d.imageUrl) || null, imagePath: str(d.imagePath) || null,
  modifierGroupIds: Array.isArray(d.modifierGroupIds) ? d.modifierGroupIds.filter((x): x is string => typeof x === "string") : [], updatedAt: millis(d.updatedAt),
});
/** The only fields copied into audit snapshots. */
const menuAuditSnapshot = (item: AdminMenuItem | null): Data | null => item && {
  name: item.name, slug: item.slug, description: item.description, categoryId: item.categoryId, pricePesewas: item.pricePesewas, prepMinutes: item.prepMinutes,
  isAvailable: item.isAvailable, isArchived: item.isArchived, badge: item.badge, imageUrl: item.imageUrl, imagePath: item.imagePath, modifierGroupIds: item.modifierGroupIds,
};

export async function listMenuItems(db: Firestore): Promise<AdminMenuItem[]> {
  const snap = await db.collection("menuItems").get();
  return snap.docs.map((d) => toMenuItem(d.id, d.data())).sort((a, b) => Number(a.isArchived) - Number(b.isArchived) || a.name.localeCompare(b.name));
}
export async function getMenuItem(id: string, db: Firestore): Promise<AdminMenuItem | null> {
  const snap = await db.doc(`menuItems/${id}`).get();
  return snap.exists ? toMenuItem(snap.id, snap.data()!) : null;
}

const slugRef = (db: Firestore, slug: string) => db.doc(`menuItemSlugs/${slug}`);

/** Slug uniqueness: a reservation doc per slug (atomic) plus a query that also catches legacy/seeded items. */
async function assertSlugFree(tx: Transaction, db: Firestore, slug: string, selfId: string | null): Promise<{ reservedBySelf: boolean }> {
  const [reservation, matches] = await Promise.all([tx.get(slugRef(db, slug)), tx.get(db.collection("menuItems").where("slug", "==", slug).limit(3))]);
  const reservedBy = reservation.exists ? str(reservation.get("menuItemId")) : null;
  const clash = (reservedBy && reservedBy !== selfId) || matches.docs.some((d) => d.id !== selfId);
  if (clash) throw new AdminInputError("SLUG_TAKEN", 409, "Another dish already uses that web address.", { slug: "This slug is already used by another dish. Choose a different one." });
  return { reservedBySelf: Boolean(selfId) && reservedBy === selfId };
}

async function resolveCatalogRefs(tx: Transaction, db: Firestore, input: MenuItemInput) {
  const [category, ...groups] = await Promise.all([tx.get(db.doc(`categories/${input.categoryId}`)), ...input.modifierGroupIds.map((id) => tx.get(db.doc(`modifiers/${id}`)))]);
  if (!category.exists) throw new AdminInputError("INVALID_CATEGORY", 422, "That category doesn't exist.", { categoryId: "Choose a category from the list." });
  const snapshots = groups.map((snap, i) => {
    if (!snap.exists) throw new AdminInputError("INVALID_MODIFIER", 422, "An option group no longer exists.", { modifierGroupIds: `Option group "${input.modifierGroupIds[i]}" doesn't exist.` });
    const group = parseModifierGroup(snap.id, snap.data()!);
    if (!group.isActive) throw new AdminInputError("INVALID_MODIFIER", 422, "An option group is switched off.", { modifierGroupIds: `Option group "${group.name}" is inactive.` });
    // Snapshot in the shape the trusted checkout quote reads (src/lib/server/catalog-quote.ts).
    return { id: group.id, name: group.name, min: group.min, max: group.max, required: group.min > 0, options: group.options };
  });
  return snapshots;
}

const menuDocFields = (input: MenuItemInput, modifierGroups: Data[]) => ({
  name: input.name, slug: input.slug, description: input.description, categoryId: input.categoryId, pricePesewas: input.pricePesewas, prepMinutes: input.prepMinutes,
  isAvailable: input.isAvailable, badge: input.badge, imageUrl: input.imageUrl, modifierGroupIds: input.modifierGroupIds, modifierGroups,
});

export async function createMenuItem(actor: StaffContext, input: MenuItemInput, requestId: string, db: Firestore): Promise<string> {
  const ref = db.collection("menuItems").doc();
  await db.runTransaction(async (tx) => {
    await assertSlugFree(tx, db, input.slug, null);
    const modifierGroups = await resolveCatalogRefs(tx, db, input);
    const now = FieldValue.serverTimestamp();
    tx.create(ref, { ...menuDocFields(input, modifierGroups), imagePath: null, isArchived: false, capacityUnits: 1, sortOrder: 100, createdAt: now, updatedAt: now });
    tx.create(slugRef(db, input.slug), { menuItemId: ref.id, createdAt: now });
    writeAudit(tx, db, actor, requestId, { action: "MENU_ITEM_CREATED", entityType: "menuItem", entityId: ref.id, before: null, after: menuAuditSnapshot({ ...toMenuItem(ref.id, { ...input, imagePath: null, isArchived: false }) }) });
  });
  return ref.id;
}

export async function updateMenuItem(actor: StaffContext, id: string, input: MenuItemInput, requestId: string, db: Firestore) {
  const ref = db.doc(`menuItems/${id}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AdminInputError("NOT_FOUND", 404, "That dish no longer exists.");
    const before = toMenuItem(id, snap.data()!);
    if (before.isArchived && input.isAvailable) throw new AdminInputError("ARCHIVED", 409, "Restore this dish before making it available.", { isAvailable: "Archived dishes can't be available." });
    const { reservedBySelf } = await assertSlugFree(tx, db, input.slug, id);
    const modifierGroups = await resolveCatalogRefs(tx, db, input);
    // All reads are done above; Firestore transactions require reads before writes.
    const now = FieldValue.serverTimestamp();
    tx.update(ref, { ...menuDocFields(input, modifierGroups), updatedAt: now });
    if (before.slug && before.slug !== input.slug) tx.delete(slugRef(db, before.slug));
    if (!reservedBySelf) tx.create(slugRef(db, input.slug), { menuItemId: id, createdAt: now }); // new slug, or backfill for seeded items
    writeAudit(tx, db, actor, requestId, { action: "MENU_ITEM_UPDATED", entityType: "menuItem", entityId: id, before: menuAuditSnapshot(before), after: menuAuditSnapshot({ ...before, ...input }) });
  });
}

async function patchMenuItem(actor: StaffContext, id: string, requestId: string, db: Firestore, action: string, change: (before: AdminMenuItem) => Partial<AdminMenuItem>) {
  const ref = db.doc(`menuItems/${id}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new AdminInputError("NOT_FOUND", 404, "That dish no longer exists.");
    const before = toMenuItem(id, snap.data()!);
    const patch = change(before);
    tx.update(ref, { ...patch, updatedAt: FieldValue.serverTimestamp() });
    writeAudit(tx, db, actor, requestId, { action, entityType: "menuItem", entityId: id, before: menuAuditSnapshot(before), after: menuAuditSnapshot({ ...before, ...patch }) });
  });
}

export const setMenuItemAvailability = (actor: StaffContext, id: string, isAvailable: boolean, requestId: string, db: Firestore) =>
  patchMenuItem(actor, id, requestId, db, isAvailable ? "MENU_ITEM_AVAILABLE" : "MENU_ITEM_UNAVAILABLE", (before) => {
    if (before.isArchived && isAvailable) throw new AdminInputError("ARCHIVED", 409, "Restore this dish before making it available.");
    return { isAvailable };
  });

export const setMenuItemArchived = (actor: StaffContext, id: string, archived: boolean, requestId: string, db: Firestore) =>
  patchMenuItem(actor, id, requestId, db, archived ? "MENU_ITEM_ARCHIVED" : "MENU_ITEM_RESTORED", () => (archived ? { isArchived: true, isAvailable: false } : { isArchived: false }));

// ---- Homepage promotions -----------------------------------------------------------------

export interface AdminPromotion {
  id: string; title: string; subtitle: string; priceLabel: string | null; targetMenuItemId: string | null; imageUrl: string | null; imagePath: string | null;
  startsAt: number | null; endsAt: number | null; isActive: boolean; priority: number; updatedAt: number | null;
}
const toPromotion = (id: string, d: Data): AdminPromotion => ({
  id, title: str(d.title), subtitle: str(d.subtitle), priceLabel: str(d.priceLabel) || null, targetMenuItemId: str(d.targetMenuItemId) || null,
  imageUrl: str(d.imageUrl) || null, imagePath: str(d.imagePath) || null, startsAt: millis(d.startsAt), endsAt: millis(d.endsAt),
  isActive: d.isActive === true, priority: Math.trunc(num(d.priority)), updatedAt: millis(d.updatedAt),
});
const promoAuditSnapshot = (p: AdminPromotion | null): Data | null => p && {
  title: p.title, subtitle: p.subtitle, priceLabel: p.priceLabel, targetMenuItemId: p.targetMenuItemId, imageUrl: p.imageUrl, imagePath: p.imagePath,
  startsAt: p.startsAt, endsAt: p.endsAt, isActive: p.isActive, priority: p.priority,
};
export const isPromotionLive = (p: Pick<AdminPromotion, "isActive" | "startsAt" | "endsAt">, now = Date.now()) =>
  p.isActive && (p.startsAt === null || p.startsAt <= now) && (p.endsAt === null || p.endsAt > now);

const homepagePromos = (db: Firestore) => db.collection("promotions").where("kind", "==", "homepage");

export async function listHomepagePromotions(db: Firestore): Promise<AdminPromotion[]> {
  const snap = await homepagePromos(db).get();
  return snap.docs.map((d) => toPromotion(d.id, d.data())).sort((a, b) => Number(b.isActive) - Number(a.isActive) || (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

async function assertTarget(tx: Transaction, db: Firestore, targetId: string | null) {
  if (!targetId) return;
  const target = await tx.get(db.doc(`menuItems/${targetId}`));
  if (!target.exists || target.get("isArchived") === true) throw new AdminInputError("INVALID_TARGET", 422, "That dish can't be promoted.", { targetMenuItemId: "Choose a dish that isn't archived." });
}

/** Only one homepage promotion may be active: activating one pauses the others in the same transaction. */
async function pauseOtherActive(tx: Transaction, db: Firestore, actor: StaffContext, requestId: string, keepId: string) {
  const active = await tx.get(homepagePromos(db).where("isActive", "==", true));
  return () => active.docs.filter((d) => d.id !== keepId).forEach((d) => {
    const before = toPromotion(d.id, d.data());
    tx.update(d.ref, { isActive: false, updatedAt: FieldValue.serverTimestamp() });
    writeAudit(tx, db, actor, requestId, { action: "PROMOTION_PAUSED_BY_ACTIVATION", entityType: "promotion", entityId: d.id, before: promoAuditSnapshot(before), after: promoAuditSnapshot({ ...before, isActive: false }) });
  });
}

const promoDocFields = (input: PromotionInput) => ({
  kind: "homepage", title: input.title, subtitle: input.subtitle, priceLabel: input.priceLabel, targetMenuItemId: input.targetMenuItemId, imageUrl: input.imageUrl,
  startsAt: Timestamp.fromDate(input.startsAt), endsAt: input.endsAt ? Timestamp.fromDate(input.endsAt) : null, isActive: input.isActive, priority: input.priority,
});
const inputAsPromotion = (id: string, input: PromotionInput, imagePath: string | null): AdminPromotion => ({
  id, ...input, imagePath, startsAt: input.startsAt.getTime(), endsAt: input.endsAt?.getTime() ?? null, updatedAt: null,
});

export async function createPromotion(actor: StaffContext, input: PromotionInput, requestId: string, db: Firestore): Promise<string> {
  const ref = db.collection("promotions").doc();
  await db.runTransaction(async (tx) => {
    await assertTarget(tx, db, input.targetMenuItemId);
    const applyPause = input.isActive ? await pauseOtherActive(tx, db, actor, requestId, ref.id) : () => undefined;
    applyPause();
    const now = FieldValue.serverTimestamp();
    tx.create(ref, { ...promoDocFields(input), imagePath: null, createdAt: now, updatedAt: now });
    writeAudit(tx, db, actor, requestId, { action: "PROMOTION_CREATED", entityType: "promotion", entityId: ref.id, before: null, after: promoAuditSnapshot(inputAsPromotion(ref.id, input, null)) });
  });
  return ref.id;
}

export async function updatePromotion(actor: StaffContext, id: string, input: PromotionInput, requestId: string, db: Firestore) {
  const ref = db.doc(`promotions/${id}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get("kind") !== "homepage") throw new AdminInputError("NOT_FOUND", 404, "That promotion no longer exists.");
    const before = toPromotion(id, snap.data()!);
    await assertTarget(tx, db, input.targetMenuItemId);
    const applyPause = input.isActive ? await pauseOtherActive(tx, db, actor, requestId, id) : () => undefined;
    applyPause();
    tx.update(ref, { ...promoDocFields(input), updatedAt: FieldValue.serverTimestamp() });
    writeAudit(tx, db, actor, requestId, { action: "PROMOTION_UPDATED", entityType: "promotion", entityId: id, before: promoAuditSnapshot(before), after: promoAuditSnapshot(inputAsPromotion(id, input, before.imagePath)) });
  });
}

export async function setPromotionActive(actor: StaffContext, id: string, isActive: boolean, requestId: string, db: Firestore) {
  const ref = db.doc(`promotions/${id}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get("kind") !== "homepage") throw new AdminInputError("NOT_FOUND", 404, "That promotion no longer exists.");
    const before = toPromotion(id, snap.data()!);
    const applyPause = isActive ? await pauseOtherActive(tx, db, actor, requestId, id) : () => undefined;
    applyPause();
    tx.update(ref, { isActive, updatedAt: FieldValue.serverTimestamp() });
    writeAudit(tx, db, actor, requestId, { action: isActive ? "PROMOTION_ACTIVATED" : "PROMOTION_PAUSED", entityType: "promotion", entityId: id, before: promoAuditSnapshot(before), after: promoAuditSnapshot({ ...before, isActive }) });
  });
}

// ---- Images (called by the upload route only after the object is safely stored) -----------

export async function attachImage(actor: StaffContext, purpose: UploadPurpose, targetId: string, image: { url: string; path: string }, requestId: string, db: Firestore): Promise<string | null> {
  const ref: DocumentReference = db.doc(purpose === "menu-item" ? `menuItems/${targetId}` : `promotions/${targetId}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || (purpose === "promotion" && snap.get("kind") !== "homepage")) throw new AdminInputError("NOT_FOUND", 404, "The item this image belongs to no longer exists.");
    const previousPath = str(snap.get("imagePath")) || null;
    tx.update(ref, { imageUrl: image.url, imagePath: image.path, updatedAt: FieldValue.serverTimestamp() });
    writeAudit(tx, db, actor, requestId, {
      action: purpose === "menu-item" ? "MENU_ITEM_IMAGE_UPLOADED" : "PROMOTION_IMAGE_UPLOADED", entityType: purpose === "menu-item" ? "menuItem" : "promotion", entityId: targetId,
      before: { imageUrl: str(snap.get("imageUrl")) || null, imagePath: previousPath }, after: { imageUrl: image.url, imagePath: image.path },
    });
    return previousPath;
  });
}

export async function targetExists(purpose: UploadPurpose, targetId: string, db: Firestore) {
  const snap = await db.doc(purpose === "menu-item" ? `menuItems/${targetId}` : `promotions/${targetId}`).get();
  return snap.exists && (purpose === "menu-item" || snap.get("kind") === "homepage");
}

// ---- Public settings ---------------------------------------------------------------------

export interface AdminSettings { acceptingOrders: boolean; asapEnabled: boolean; notice: string | null; supportPhone: string | null; updatedAt: number | null; exists: boolean }
const toSettings = (d: Data | undefined): AdminSettings => ({
  acceptingOrders: d?.acceptingOrders === true, asapEnabled: d?.asapEnabled === true, notice: str(d?.notice) || null, supportPhone: str(d?.supportPhone) || null, updatedAt: millis(d?.updatedAt), exists: Boolean(d),
});
export async function getSettings(db: Firestore): Promise<AdminSettings> {
  const snap = await db.doc("settings/public").get();
  return toSettings(snap.exists ? snap.data() : undefined);
}

export async function updateSettings(actor: StaffContext, input: SettingsInput, requestId: string, db: Firestore) {
  const ref = db.doc("settings/public");
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const before = snap.exists ? toSettings(snap.data()) : null;
    // merge: leaves any other public fields (e.g. minimumOrderPesewas) untouched.
    tx.set(ref, { ...input, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    const pick = (s: SettingsInput | AdminSettings | null) => s && { acceptingOrders: s.acceptingOrders, asapEnabled: s.asapEnabled, notice: s.notice, supportPhone: s.supportPhone };
    writeAudit(tx, db, actor, requestId, { action: "SETTINGS_UPDATED", entityType: "settings", entityId: "public", before: pick(before), after: pick(input) });
  });
}

// ---- Dashboard (read-only, no customer data) ---------------------------------------------

export interface DashboardSnapshot {
  settings: AdminSettings; menu: { total: number; available: number; unavailable: number; archived: number };
  livePromotion: AdminPromotion | null; nextSlot: { id: string; serviceDate: string; startsAt: string; endsAt: string; totalCapacity: number; reservedCapacity: number } | null;
}

export async function getDashboardSnapshot(db: Firestore, now = new Date()): Promise<DashboardSnapshot> {
  const items = db.collection("menuItems");
  const today = now.toISOString().slice(0, 10);
  const [settings, total, available, archived, promos, slots] = await Promise.all([
    getSettings(db), items.count().get(), items.where("isAvailable", "==", true).count().get(), items.where("isArchived", "==", true).count().get(),
    listHomepagePromotions(db), db.collection("preorderSlots").where("serviceDate", ">=", today).orderBy("serviceDate").orderBy("startsAt").limit(20).get(),
  ]);
  const t = total.data().count; const a = available.data().count; const ar = archived.data().count;
  const nowHm = now.toTimeString().slice(0, 5);
  const next = slots.docs.map((d) => ({ id: d.id, data: d.data() })).find(({ data }) => data.isOpen === true && (str(data.serviceDate) > today || str(data.startsAt) >= nowHm));
  const livePromotion = promos.filter((p) => isPromotionLive(p, now.getTime())).sort((x, y) => y.priority - x.priority)[0] ?? null;
  return {
    settings, menu: { total: t, available: a, archived: ar, unavailable: Math.max(0, t - a - ar) }, livePromotion,
    nextSlot: next ? { id: next.id, serviceDate: str(next.data.serviceDate), startsAt: str(next.data.startsAt), endsAt: str(next.data.endsAt), totalCapacity: Math.trunc(num(next.data.totalCapacity)), reservedCapacity: Math.trunc(num(next.data.reservedCapacity)) } : null,
  };
}
