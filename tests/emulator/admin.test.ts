// Runs only inside `npm run test:emulator` (Firebase Auth + Firestore emulators, demo project — never production).
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { adminApp, adminDb as db } from "@/lib/firebase/admin";
import { AdminAccessError, assertPermission, type StaffContext } from "@/lib/admin/permissions";
import { createAdminSession, readStaffContext } from "@/lib/admin/session";
import { AdminInputError, createMenuItem, createPromotion, setMenuItemArchived, setMenuItemAvailability, updateMenuItem, updateSettings } from "@/lib/admin/repository";
import { parseMenuItemInput, type MenuItemInput } from "@/lib/admin/validation";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.GCLOUD_PROJECT?.startsWith("demo-")) {
  throw new Error("Refusing to run: emulator tests need the Firebase emulators and a demo- project (npm run test:emulator).");
}
const auth = getAuth(adminApp);
const deps = { auth, db };
const actor: StaffContext = { uid: "staff-owner", displayName: "Owner", roleIds: ["owner"], permissions: new Set(["menu.write"]) };

async function clearFirestore() {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${process.env.GCLOUD_PROJECT}/databases/(default)/documents`, { method: "DELETE" });
}
async function idTokenFor(email: string) {
  const res = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "correct-horse-1", returnSecureToken: true }),
  });
  const body = await res.json() as { idToken?: string };
  assert.ok(body.idToken, "emulator sign-in failed");
  return body.idToken;
}
const item = (overrides: Partial<Record<string, unknown>> = {}): MenuItemInput => {
  const parsed = parseMenuItemInput({ name: "Jollof + chicken", slug: "jollof-chicken", description: "Smoky.", categoryId: "rice", price: "35.50", prepMinutes: "20", isAvailable: true, modifierGroupIds: ["spice"], ...overrides });
  assert.ok(parsed.ok, JSON.stringify(!parsed.ok && parsed.errors)); return parsed.value;
};
const audits = async (entityId: string) => (await db.collection("auditLogs").where("entityId", "==", entityId).get()).docs.map((d) => d.data());
const rejects = (promise: Promise<unknown>, code: string) => assert.rejects(promise, (e: unknown) => (e instanceof AdminInputError && e.code === code) || (e instanceof AdminAccessError && e.reason === code));

before(async () => {
  for (const [uid, email] of [["staff-owner", "owner@example.com"], ["staff-inactive", "inactive@example.com"], ["not-staff", "guest@example.com"], ["staff-viewer", "viewer@example.com"]]) {
    await auth.createUser({ uid, email, password: "correct-horse-1" }).catch(() => undefined);
  }
});
after(async () => { await clearFirestore(); });

beforeEach(async () => {
  await clearFirestore();
  const batch = db.batch();
  batch.set(db.doc("roles/owner"), { name: "Owner", permissions: ["dashboard.read", "menu.read", "menu.write", "promotions.read", "promotions.write", "settings.read", "settings.write", "uploads.write"], isActive: true });
  batch.set(db.doc("roles/viewer"), { name: "Viewer", permissions: ["dashboard.read", "menu.read"], isActive: true });
  batch.set(db.doc("staff/staff-owner"), { authUid: "staff-owner", displayName: "Owner", roleIds: ["owner"], isActive: true });
  batch.set(db.doc("staff/staff-inactive"), { authUid: "staff-inactive", displayName: "Former", roleIds: ["owner"], isActive: false });
  batch.set(db.doc("staff/staff-viewer"), { authUid: "staff-viewer", displayName: "Viewer", roleIds: ["viewer"], isActive: true });
  batch.set(db.doc("categories/rice"), { name: "Rice", emoji: "🍚", isActive: true, sortOrder: 1 });
  batch.set(db.doc("modifiers/spice"), { name: "How much pepper?", selectionType: "single", min: 1, max: 1, isActive: true, options: [{ id: "mild", name: "Mild", priceAdjustmentPesewas: 0 }, { id: "hot", name: "Hot", priceAdjustmentPesewas: 0, isDefault: true }] });
  batch.set(db.doc("modifiers/retired"), { name: "Old sauces", min: 0, max: 1, isActive: false, options: [{ id: "x", name: "X", priceAdjustmentPesewas: 100 }] });
  await batch.commit();
});

describe("staff sessions (Auth emulator)", () => {
  test("active staff get a session cookie that resolves to their permissions", async () => {
    const { cookie, context } = await createAdminSession(await idTokenFor("owner@example.com"), deps);
    assert.ok(cookie.length > 20);
    assert.ok(context.permissions.has("settings.write"));
    const again = await readStaffContext(cookie, deps);
    assert.equal(again.uid, "staff-owner");
  });

  test("a signed-in non-staff user never gets a cookie", async () => {
    await rejects(createAdminSession(await idTokenFor("guest@example.com"), deps), "NOT_STAFF");
  });

  test("inactive staff can't sign in", async () => {
    await rejects(createAdminSession(await idTokenFor("inactive@example.com"), deps), "STAFF_INACTIVE");
  });

  test("deactivating staff cuts off an existing session immediately", async () => {
    const { cookie } = await createAdminSession(await idTokenFor("owner@example.com"), deps);
    await db.doc("staff/staff-owner").update({ isActive: false });
    await rejects(readStaffContext(cookie, deps), "STAFF_INACTIVE");
  });

  test("signing out (revoking) kills the session cookie", async () => {
    const { cookie } = await createAdminSession(await idTokenFor("owner@example.com"), deps);
    await new Promise((r) => setTimeout(r, 1100)); // revocation has 1-second granularity
    await auth.revokeRefreshTokens("staff-owner");
    await rejects(readStaffContext(cookie, deps), "NO_SESSION");
  });

  test("garbage and missing cookies are rejected", async () => {
    await rejects(readStaffContext(undefined, deps), "NO_SESSION");
    await rejects(readStaffContext("not-a-cookie", deps), "NO_SESSION");
    await rejects(createAdminSession("not-a-token-but-long-enough", deps), "NO_SESSION");
  });

  test("a staff member without a permission is forbidden from that action", async () => {
    const { context } = await createAdminSession(await idTokenFor("viewer@example.com"), deps);
    assert.doesNotThrow(() => assertPermission(context, "menu.read"));
    assert.throws(() => assertPermission(context, "menu.write"), (e: unknown) => e instanceof AdminAccessError && e.reason === "FORBIDDEN");
    assert.throws(() => assertPermission(context, "settings.write"), (e: unknown) => e instanceof AdminAccessError && e.reason === "FORBIDDEN");
  });
});

describe("menu items (Firestore emulator)", () => {
  test("create stores pesewas and a modifier snapshot, never the staff uid, and writes an audit entry", async () => {
    const requestId = randomUUID();
    const id = await createMenuItem(actor, item(), requestId, db);
    const doc = (await db.doc(`menuItems/${id}`).get()).data()!;
    assert.equal(doc.pricePesewas, 3550);
    assert.equal(doc.modifierGroups[0].options[1].priceAdjustmentPesewas, 0);
    assert.equal(doc.isArchived, false);
    assert.ok(!JSON.stringify(doc).includes("staff-owner"), "public menu doc must not contain staff uid");
    const [log] = await audits(id);
    assert.equal(log.action, "MENU_ITEM_CREATED"); assert.equal(log.actorId, "staff-owner"); assert.equal(log.requestId, requestId);
    assert.equal(log.before, null); assert.equal(log.after.pricePesewas, 3550);
  });

  test("slug collisions are rejected on create and update", async () => {
    const first = await createMenuItem(actor, item(), randomUUID(), db);
    await rejects(createMenuItem(actor, item({ name: "Other jollof" }), randomUUID(), db), "SLUG_TAKEN");
    const second = await createMenuItem(actor, item({ name: "Waakye", slug: "waakye" }), randomUUID(), db);
    await rejects(updateMenuItem(actor, second, item({ name: "Waakye", slug: "jollof-chicken" }), randomUUID(), db), "SLUG_TAKEN");
    assert.equal((await db.collection("menuItems").where("slug", "==", "jollof-chicken").get()).size, 1);
    // Renaming frees the old slug for reuse.
    await updateMenuItem(actor, first, item({ slug: "jollof-special" }), randomUUID(), db);
    await createMenuItem(actor, item({ name: "New jollof" }), randomUUID(), db);
  });

  test("slug collisions with seeded items that have no reservation are caught too", async () => {
    await db.doc("menuItems/seeded").set({ name: "Seeded", slug: "jollof-chicken", pricePesewas: 100, isAvailable: true });
    await rejects(createMenuItem(actor, item(), randomUUID(), db), "SLUG_TAKEN");
  });

  test("unknown category or inactive option group is rejected with nothing written", async () => {
    await rejects(createMenuItem(actor, item({ categoryId: "nope" }), randomUUID(), db), "INVALID_CATEGORY");
    await rejects(createMenuItem(actor, item({ modifierGroupIds: ["retired"] }), randomUUID(), db), "INVALID_MODIFIER");
    assert.equal((await db.collection("menuItems").get()).size, 0);
    assert.equal((await db.collection("auditLogs").get()).size, 0);
    assert.equal((await db.collection("menuItemSlugs").get()).size, 0);
  });

  test("update and availability changes are audited with before/after", async () => {
    const id = await createMenuItem(actor, item(), randomUUID(), db);
    await updateMenuItem(actor, id, item({ price: "40" }), randomUUID(), db);
    await setMenuItemAvailability(actor, id, false, randomUUID(), db);
    const logs = await audits(id);
    const update = logs.find((l) => l.action === "MENU_ITEM_UPDATED")!;
    assert.equal(update.before.pricePesewas, 3550); assert.equal(update.after.pricePesewas, 4000);
    const off = logs.find((l) => l.action === "MENU_ITEM_UNAVAILABLE")!;
    assert.equal(off.before.isAvailable, true); assert.equal(off.after.isAvailable, false);
  });

  test("archived dishes can't be made available until restored", async () => {
    const id = await createMenuItem(actor, item(), randomUUID(), db);
    await setMenuItemArchived(actor, id, true, randomUUID(), db);
    const archived = (await db.doc(`menuItems/${id}`).get()).data()!;
    assert.equal(archived.isArchived, true); assert.equal(archived.isAvailable, false);
    await rejects(setMenuItemAvailability(actor, id, true, randomUUID(), db), "ARCHIVED");
    await setMenuItemArchived(actor, id, false, randomUUID(), db);
    await setMenuItemAvailability(actor, id, true, randomUUID(), db);
  });
});

describe("promotions and settings (Firestore emulator)", () => {
  const promo = (title: string) => ({ title, subtitle: "", priceLabel: null, targetMenuItemId: null, imageUrl: null, startsAt: new Date(Date.now() - 60_000), endsAt: null, isActive: true, priority: 0 });

  test("only one homepage promotion is active; the other is paused and audited", async () => {
    const a = await createPromotion(actor, promo("A"), randomUUID(), db);
    const b = await createPromotion(actor, promo("B"), randomUUID(), db);
    assert.equal((await db.doc(`promotions/${a}`).get()).get("isActive"), false);
    assert.equal((await db.doc(`promotions/${b}`).get()).get("isActive"), true);
    assert.equal((await db.doc(`promotions/${b}`).get()).get("kind"), "homepage");
    assert.ok((await audits(a)).some((l) => l.action === "PROMOTION_PAUSED_BY_ACTIVATION"));
  });

  test("promotions can't target a missing dish", async () => {
    await rejects(createPromotion(actor, { ...promo("C"), targetMenuItemId: "missing" }, randomUUID(), db), "INVALID_TARGET");
  });

  test("settings changes merge, keep other public fields, and are audited", async () => {
    await db.doc("settings/public").set({ acceptingOrders: true, asapEnabled: true, minimumOrderPesewas: 2000 });
    await updateSettings(actor, { acceptingOrders: false, asapEnabled: true, notice: "Back at 11", supportPhone: null }, randomUUID(), db);
    const doc = (await db.doc("settings/public").get()).data()!;
    assert.equal(doc.acceptingOrders, false); assert.equal(doc.minimumOrderPesewas, 2000);
    const [log] = await audits("public");
    assert.equal(log.action, "SETTINGS_UPDATED"); assert.equal(log.before.acceptingOrders, true); assert.equal(log.after.acceptingOrders, false);
  });
});
