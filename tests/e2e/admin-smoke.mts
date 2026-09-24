// End-to-end smoke test of the admin portal over HTTP against a running `next start` wired to the
// Firebase emulators (demo project). Run via `npm run test:e2e` after `npm run build`.
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3290";
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.GCLOUD_PROJECT?.startsWith("demo-")) throw new Error("Refusing to run outside the emulators.");
const app = initializeApp({ projectId: process.env.GCLOUD_PROJECT }, "smoke");
const auth = getAuth(app); const db = getFirestore(app);
const origin = new URL(BASE).origin;
let passed = 0;
const check = async (name: string, fn: () => Promise<void>) => { await fn(); passed++; console.log(`  ✔ ${name}`); };

async function idToken(uid: string, email: string) {
  await auth.createUser({ uid, email, password: "correct-horse-1" }).catch(() => undefined);
  const res = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "correct-horse-1", returnSecureToken: true }) });
  return ((await res.json()) as { idToken: string }).idToken;
}
async function signIn(uid: string, email: string) {
  const res = await fetch(`${BASE}/api/admin/session`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ idToken: await idToken(uid, email) }) });
  const cookie = res.headers.get("set-cookie")?.split(";")[0] ?? null;
  return { res, cookie };
}
const api = (path: string, cookie: string | null, init: { method: string; body?: unknown; form?: FormData; origin?: string }) => fetch(`${BASE}${path}`, {
  method: init.method, redirect: "manual",
  headers: { Origin: init.origin ?? origin, ...(cookie ? { Cookie: cookie } : {}), ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) },
  body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
});
const page = (path: string, cookie?: string | null) => fetch(`${BASE}${path}`, { redirect: "manual", headers: cookie ? { Cookie: cookie } : {} });
const auditCount = async () => (await db.collection("auditLogs").count().get()).data().count;
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);

// Seed staff, roles and a minimal catalog.
const batch = db.batch();
batch.set(db.doc("roles/owner"), { name: "Owner", isActive: true, permissions: ["dashboard.read", "menu.read", "menu.write", "promotions.read", "promotions.write", "settings.read", "settings.write", "uploads.write"] });
batch.set(db.doc("roles/viewer"), { name: "Viewer", isActive: true, permissions: ["dashboard.read", "menu.read"] });
batch.set(db.doc("staff/owner-1"), { authUid: "owner-1", displayName: "Ama (Owner)", roleIds: ["owner"], isActive: true });
batch.set(db.doc("staff/viewer-1"), { authUid: "viewer-1", displayName: "Kojo", roleIds: ["viewer"], isActive: true });
batch.set(db.doc("staff/former-1"), { authUid: "former-1", displayName: "Former", roleIds: ["owner"], isActive: false });
batch.set(db.doc("categories/rice"), { name: "Rice", emoji: "🍚", isActive: true, sortOrder: 1 });
batch.set(db.doc("modifiers/spice"), { name: "How much pepper?", min: 1, max: 1, isActive: true, options: [{ id: "mild", name: "Mild", priceAdjustmentPesewas: 0 }, { id: "hot", name: "Hot", priceAdjustmentPesewas: 0, isDefault: true }] });
batch.set(db.doc("settings/public"), { acceptingOrders: true, asapEnabled: true });
await batch.commit();

console.log("Admin portal smoke test");
await check("guests are redirected from /admin to sign-in", async () => {
  const res = await page("/admin"); assert.equal(res.status, 307); assert.match(res.headers.get("location") ?? "", /\/admin\/sign-in$/);
});
await check("guest API writes are refused (401) and cross-origin writes are blocked (403)", async () => {
  assert.equal((await api("/api/admin/menu-items", null, { method: "POST", body: {} })).status, 401);
  assert.equal((await api("/api/admin/settings", null, { method: "PUT", body: {}, origin: "https://evil.example" })).status, 403);
});
await check("inactive staff and non-staff get no session cookie", async () => {
  const former = await signIn("former-1", "former@example.com"); assert.equal(former.res.status, 403); assert.equal(former.cookie, null);
  const guest = await signIn("guest-1", "guest@example.com"); assert.equal(guest.res.status, 403); assert.equal(guest.cookie, null);
});

const viewer = (await signIn("viewer-1", "viewer@example.com")).cookie;
await check("a viewer can read the menu but is forbidden from writes and settings", async () => {
  assert.equal((await page("/admin/menu", viewer)).status, 200);
  const write = await api("/api/admin/menu-items", viewer, { method: "POST", body: {} }); assert.equal(write.status, 403);
  const settings = await page("/admin/settings", viewer); assert.equal(settings.status, 307); assert.match(settings.headers.get("location") ?? "", /denied\?reason=FORBIDDEN/);
});

const { res: ownerRes, cookie: owner } = await signIn("owner-1", "owner@example.com");
let itemId = "";
await check("owner signs in with an httpOnly, SameSite=Strict session cookie", async () => {
  assert.equal(ownerRes.status, 200); const header = ownerRes.headers.get("set-cookie") ?? "";
  assert.match(header, /__session=/); assert.match(header, /HttpOnly/i); assert.match(header, /SameSite=Strict/i);
});
await check("invalid menu data is rejected with field errors and nothing is audited", async () => {
  const before = await auditCount();
  const res = await api("/api/admin/menu-items", owner, { method: "POST", body: { name: "X", price: "3.555", categoryId: "rice", prepMinutes: 0, isAvailable: true } });
  assert.equal(res.status, 422); const body = await res.json() as { error: { fieldErrors: Record<string, string> } };
  assert.ok(body.error.fieldErrors.name && body.error.fieldErrors.price && body.error.fieldErrors.prepMinutes);
  assert.equal(await auditCount(), before);
});
await check("owner creates a menu item (stored in pesewas, audited)", async () => {
  const res = await api("/api/admin/menu-items", owner, { method: "POST", body: { name: "Smoke Test Jollof", slug: "smoke-test-jollof", description: "E2E dish", categoryId: "rice", price: "42.50", prepMinutes: "18", isAvailable: true, modifierGroupIds: ["spice"] } });
  assert.equal(res.status, 201); itemId = ((await res.json()) as { id: string }).id;
  assert.equal((await db.doc(`menuItems/${itemId}`).get()).get("pricePesewas"), 4250);
});
await check("a duplicate slug is refused (409)", async () => {
  const res = await api("/api/admin/menu-items", owner, { method: "POST", body: { name: "Another", slug: "smoke-test-jollof", categoryId: "rice", price: "10", prepMinutes: "5", isAvailable: true } });
  assert.equal(res.status, 409);
});
await check("image upload: a disguised file is rejected, a real PNG is stored and linked", async () => {
  const bad = new FormData(); bad.append("file", new Blob([new TextEncoder().encode("<svg onload=alert(1)>")], { type: "image/png" }), "../../evil.png");
  assert.equal((await api(`/api/admin/uploads?purpose=menu-item&targetId=${itemId}`, owner, { method: "POST", form: bad })).status, 422);
  const good = new FormData(); good.append("file", new Blob([png], { type: "image/png" }), "../../../etc/passwd.png");
  const res = await api(`/api/admin/uploads?purpose=menu-item&targetId=${itemId}`, owner, { method: "POST", form: good });
  assert.equal(res.status, 201); const { path } = await res.json() as { path: string };
  assert.match(path, /^public\/menu-images\/[0-9a-f-]{36}\.png$/);
  assert.equal((await db.doc(`menuItems/${itemId}`).get()).get("imagePath"), path);
});
await check("viewer can't upload", async () => {
  const form = new FormData(); form.append("file", new Blob([png], { type: "image/png" }), "a.png");
  assert.equal((await api(`/api/admin/uploads?purpose=menu-item&targetId=${itemId}`, viewer, { method: "POST", form })).status, 403);
});
await check("owner toggles availability off and on", async () => {
  assert.equal((await api(`/api/admin/menu-items/${itemId}`, owner, { method: "PATCH", body: { action: "setAvailability", isAvailable: false } })).status, 200);
  assert.equal((await db.doc(`menuItems/${itemId}`).get()).get("isAvailable"), false);
  assert.equal((await api(`/api/admin/menu-items/${itemId}`, owner, { method: "PATCH", body: { action: "setAvailability", isAvailable: true } })).status, 200);
});
await check("owner publishes a homepage promotion and closes the kitchen", async () => {
  const promo = await api("/api/admin/promotions", owner, { method: "POST", body: { title: "Smoke Friday", subtitle: "E2E promo", priceLabel: "GHS 42", targetMenuItemId: itemId, startsAt: new Date(Date.now() - 60_000).toISOString(), endsAt: "", isActive: true, priority: 1 } });
  assert.equal(promo.status, 201);
  const settings = await api("/api/admin/settings", owner, { method: "PUT", body: { acceptingOrders: false, asapEnabled: true, notice: "Smoke test closure", supportPhone: "024 123 4567" } });
  assert.equal(settings.status, 200);
});
await check("the student Home page reflects the catalog, promotion and kitchen setting", async () => {
  let html = "";
  // Home is ISR: after revalidateTag the next request may still serve the old page while it regenerates.
  for (let i = 0; i < 40 && !(html.includes("Smoke Friday") && html.includes("Smoke test closure")); i++) { html = await (await page("/")).text(); if (!html.includes("Smoke Friday")) await new Promise((r) => setTimeout(r, 500)); }
  assert.ok(html.includes("Smoke Friday"), "promotion title on Home");
  assert.ok(html.includes(`/menu/smoke-test-jollof`), "promotion links to the dish");
  assert.ok(html.includes("The kitchen is closed right now") && html.includes("Smoke test closure"), "kitchen closed notice on Home");
  assert.ok((await (await page("/menu/smoke-test-jollof")).text()).includes("Smoke Test Jollof"), "new dish page renders");
});
await check("every admin write produced an audit record", async () => {
  const actions = (await db.collection("auditLogs").where("actorId", "==", "owner-1").get()).docs.map((d) => d.get("action")).sort();
  for (const expected of ["MENU_ITEM_CREATED", "MENU_ITEM_IMAGE_UPLOADED", "MENU_ITEM_UNAVAILABLE", "MENU_ITEM_AVAILABLE", "PROMOTION_CREATED", "SETTINGS_UPDATED"]) assert.ok(actions.includes(expected), `missing ${expected}`);
});
await check("sign-out revokes the session", async () => {
  await new Promise((r) => setTimeout(r, 1100));
  assert.equal((await api("/api/admin/session", owner, { method: "DELETE" })).status, 200);
  assert.equal((await api("/api/admin/settings", owner, { method: "PUT", body: { acceptingOrders: true, asapEnabled: true } })).status, 401);
});
console.log(`\n${passed} checks passed`);
process.exit(0);
