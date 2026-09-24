// Security-rules tests against the Firestore and Storage emulators, using the repo's firestore.rules / storage.rules.
import { after, before, beforeEach, describe, test } from "node:test";
import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { getBytes, ref, uploadBytes } from "firebase/storage";

const [fsHost, fsPort] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080").split(":");
const [stHost, stPort] = (process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? "127.0.0.1:9199").split(":");
const IMAGE = "public/menu-images/0b8f0c2e-8c4a-4a57-9c38-2f7f0cbb9a11.jpg";
let env: RulesTestEnvironment;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: process.env.GCLOUD_PROJECT ?? "demo-mummy-sinn",
    firestore: { host: fsHost, port: Number(fsPort), rules: readFileSync("firestore.rules", "utf8") },
    storage: { host: stHost, port: Number(stPort), rules: readFileSync("storage.rules", "utf8") },
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "settings/public"), { acceptingOrders: true, asapEnabled: true });
    await setDoc(doc(db, "menuItems/live"), { name: "Jollof", isAvailable: true, pricePesewas: 3500 });
    await setDoc(doc(db, "menuItems/archived"), { name: "Old", isAvailable: false, isArchived: true, pricePesewas: 100 });
    await setDoc(doc(db, "promotions/home"), { kind: "homepage", isActive: true, title: "Jollof Friday" });
    await setDoc(doc(db, "promotions/code"), { kind: "code", code: "STAFF100", isActive: true, value: 100 });
    await setDoc(doc(db, "staff/staff-1"), { authUid: "staff-1", roleIds: ["owner"], isActive: true });
    await setDoc(doc(db, "roles/owner"), { name: "Owner", permissions: ["menu.write"] });
    await setDoc(doc(db, "auditLogs/a1"), { actorId: "staff-1", action: "X" });
    await setDoc(doc(db, "menuItemSlugs/jollof"), { menuItemId: "live" });
    const storage = ctx.storage();
    await uploadBytes(ref(storage, IMAGE), new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), { contentType: "image/jpeg" });
    await uploadBytes(ref(storage, "public/menu-images/not-a-uuid.jpg"), new Uint8Array([0xff, 0xd8, 0xff]), { contentType: "image/jpeg" });
    await uploadBytes(ref(storage, "private/receipt.jpg"), new Uint8Array([0xff, 0xd8, 0xff]), { contentType: "image/jpeg" });
  });
});

describe("Firestore rules", () => {
  test("guests can read public catalog data only", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, "settings/public")));
    await assertSucceeds(getDoc(doc(db, "menuItems/live")));
    await assertFails(getDoc(doc(db, "menuItems/archived")));
    await assertSucceeds(getDoc(doc(db, "promotions/home")));
    await assertFails(getDoc(doc(db, "promotions/code"))); // promo codes are not public
    await assertFails(getDoc(doc(db, "settings/private")));
  });

  test("guests can't write anything", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "menuItems/live"), { pricePesewas: 1 }));
    await assertFails(setDoc(doc(db, "settings/public"), { acceptingOrders: false }));
    await assertFails(setDoc(doc(db, "promotions/new"), { kind: "homepage", isActive: true }));
    await assertFails(setDoc(doc(db, "orders/o1"), { total: 1 }));
  });

  for (const [who, ctx] of [["a guest", () => env.unauthenticatedContext()], ["signed-in staff (from the browser)", () => env.authenticatedContext("staff-1")]] as const) {
    test(`${who} can't read or write admin records`, async () => {
      const db = ctx().firestore();
      for (const path of ["staff/staff-1", "roles/owner", "auditLogs/a1", "menuItemSlugs/jollof"]) {
        await assertFails(getDoc(doc(db, path)));
        await assertFails(setDoc(doc(db, path), { hacked: true }));
        await assertFails(deleteDoc(doc(db, path)));
      }
      await assertFails(getDocs(collection(db, "auditLogs")));
      await assertFails(getDocs(collection(db, "staff")));
    });
  }
});

describe("Storage rules", () => {
  test("guests can read server-named food images only", async () => {
    const storage = env.unauthenticatedContext().storage();
    await assertSucceeds(getBytes(ref(storage, IMAGE)));
    await assertFails(getBytes(ref(storage, "public/menu-images/not-a-uuid.jpg")));
    await assertFails(getBytes(ref(storage, "private/receipt.jpg")));
  });

  test("nobody can upload from a browser, signed in or not", async () => {
    for (const ctx of [env.unauthenticatedContext(), env.authenticatedContext("staff-1")]) {
      const storage = ctx.storage();
      await assertFails(uploadBytes(ref(storage, "public/menu-images/0b8f0c2e-8c4a-4a57-9c38-2f7f0cbb9a12.jpg"), new Uint8Array([0xff, 0xd8, 0xff]), { contentType: "image/jpeg" }));
      await assertFails(uploadBytes(ref(storage, "anything.html"), new Uint8Array([60]), { contentType: "text/html" }));
    }
  });
});
