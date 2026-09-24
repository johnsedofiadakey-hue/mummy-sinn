import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ghsToPesewas, isAllowedImageUrl, parseMenuItemInput, parsePromotionInput, parseSettingsInput, PUBLIC_IMAGE_PATH, publicImageUrl,
  slugify, storagePathFor, UPLOAD_MAX_BYTES, validateImageUpload,
} from "@/lib/admin/validation";

const validItem = { name: "Jollof + grilled chicken", slug: "", description: "Smoky jollof.", categoryId: "rice", price: "35.50", prepMinutes: "20", isAvailable: true, badge: "", imageUrl: "", modifierGroupIds: ["spice"] };

test("GHS → pesewas is exact integer arithmetic", () => {
  assert.equal(ghsToPesewas("35"), 3500);
  assert.equal(ghsToPesewas("35.5"), 3550);
  assert.equal(ghsToPesewas("19.99"), 1999);
  assert.equal(ghsToPesewas("0.10"), 10);
  assert.equal(ghsToPesewas(0.1 + 0.2), null); // 0.30000000000000004 is rejected, not rounded
  assert.equal(ghsToPesewas("GHS 12.00"), 1200);
  for (const bad of ["35.555", "-5", "1e3", "", "abc", "35,50", "123456"]) assert.equal(ghsToPesewas(bad), null, bad);
});

test("a valid menu item parses, derives its slug and stores pesewas", () => {
  const parsed = parseMenuItemInput(validItem);
  assert.ok(parsed.ok);
  assert.equal(parsed.value.slug, "jollof-grilled-chicken");
  assert.equal(parsed.value.pricePesewas, 3550);
  assert.equal(parsed.value.prepMinutes, 20);
  assert.equal("price" in parsed.value, false);
});

test("invalid menu data is rejected field by field", () => {
  const parsed = parseMenuItemInput({ name: "J", slug: "Bad Slug!", description: "x".repeat(301), categoryId: "../etc", price: "0", prepMinutes: "0", isAvailable: "yes", badge: "x".repeat(25), imageUrl: "http://evil.example/a.png", modifierGroupIds: ["ok", "bad/id"] });
  assert.equal(parsed.ok, false);
  if (parsed.ok) return;
  for (const field of ["name", "slug", "description", "categoryId", "price", "prepMinutes", "isAvailable", "badge", "imageUrl", "modifierGroupIds"]) assert.ok(parsed.errors[field], `expected an error for ${field}`);
  assert.equal(parseMenuItemInput(null).ok, false);
  assert.equal(parseMenuItemInput([validItem]).ok, false);
  assert.equal(parseMenuItemInput({ ...validItem, price: "10001" }).ok, false);
});

test("slugify produces valid slugs", () => {
  assert.equal(slugify("Jollof + Chicken!!"), "jollof-chicken");
  assert.equal(slugify("  Kelewele  "), "kelewele");
  assert.equal(slugify("Café Waakye"), "cafe-waakye");
});

test("image URLs must be our bucket's public paths, bundled images, or the sample CDN", () => {
  const good = publicImageUrl("mummy-sinn.firebasestorage.app", "public/menu-images/0b8f0c2e-8c4a-4a57-9c38-2f7f0cbb9a11.jpg");
  assert.ok(isAllowedImageUrl(good, "mummy-sinn.firebasestorage.app"));
  assert.ok(isAllowedImageUrl("/images/food/waakye-v1.png"));
  assert.ok(isAllowedImageUrl("https://images.unsplash.com/photo-1?w=100"));
  assert.equal(isAllowedImageUrl(good, "other-bucket.appspot.com"), false);
  assert.equal(isAllowedImageUrl(publicImageUrl("mummy-sinn.firebasestorage.app", "private/secret.jpg")), false);
  assert.equal(isAllowedImageUrl("/images/../../etc/passwd.png"), false);
  assert.equal(isAllowedImageUrl("javascript:alert(1)"), false);
  assert.equal(isAllowedImageUrl("https://user:pw@images.unsplash.com/x"), false);
});

test("promotion windows must be valid and end after they start", () => {
  const base = { title: "Jollof Friday", subtitle: "", priceLabel: "From GHS 30", targetMenuItemId: "", imageUrl: "", startsAt: "2026-10-01T10:00:00.000Z", endsAt: "", isActive: true, priority: "5" };
  const ok = parsePromotionInput(base);
  assert.ok(ok.ok && ok.value.endsAt === null && ok.value.priority === 5);
  const backwards = parsePromotionInput({ ...base, endsAt: "2026-09-30T10:00:00.000Z" });
  assert.ok(!backwards.ok && backwards.errors.endsAt);
  const junk = parsePromotionInput({ ...base, title: "", startsAt: "not a date", priority: 500, isActive: "true" });
  assert.ok(!junk.ok && junk.errors.title && junk.errors.startsAt && junk.errors.priority && junk.errors.isActive);
});

test("settings accept only the four safe fields, with a Ghana support phone", () => {
  const ok = parseSettingsInput({ acceptingOrders: false, asapEnabled: true, notice: "Back at 11", supportPhone: "024 123 4567", minimumOrderPesewas: 1 });
  assert.ok(ok.ok);
  assert.deepEqual(ok.value, { acceptingOrders: false, asapEnabled: true, notice: "Back at 11", supportPhone: "+233241234567" });
  const bad = parseSettingsInput({ acceptingOrders: "no", asapEnabled: true, supportPhone: "12345" });
  assert.ok(!bad.ok && bad.errors.acceptingOrders && bad.errors.supportPhone);
});

// ---- Upload validation ----
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const webp = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP"), 0]);

test("uploads: real JPG/PNG/WebP bytes are accepted", () => {
  assert.deepEqual(validateImageUpload({ declaredType: "image/png", size: png.length, bytes: png }), { ok: true, value: { contentType: "image/png", ext: "png" } });
  assert.ok(validateImageUpload({ declaredType: "image/jpeg", size: jpeg.length, bytes: jpeg }).ok);
  assert.ok(validateImageUpload({ declaredType: "image/webp", size: webp.length, bytes: webp }).ok);
});

test("uploads: mismatched, disguised, empty and oversized files are rejected", () => {
  assert.equal(validateImageUpload({ declaredType: "image/jpeg", size: png.length, bytes: png }).ok, false); // PNG claiming to be JPG
  const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>");
  assert.equal(validateImageUpload({ declaredType: "image/svg+xml", size: svg.length, bytes: svg }).ok, false);
  const html = new TextEncoder().encode("<html>hi</html>");
  assert.equal(validateImageUpload({ declaredType: "image/png", size: html.length, bytes: html }).ok, false);
  assert.equal(validateImageUpload({ declaredType: "image/png", size: 0, bytes: new Uint8Array() }).ok, false);
  const big = new Uint8Array(UPLOAD_MAX_BYTES + 1); big.set(png);
  assert.equal(validateImageUpload({ declaredType: "image/png", size: big.length, bytes: big }).ok, false);
});

test("uploads: storage paths are server-generated and constrained", () => {
  const path = storagePathFor("menu-item", "png", "0b8f0c2e-8c4a-4a57-9c38-2f7f0cbb9a11");
  assert.equal(path, "public/menu-images/0b8f0c2e-8c4a-4a57-9c38-2f7f0cbb9a11.png");
  assert.match(storagePathFor("promotion", "webp", "0b8f0c2e-8c4a-4a57-9c38-2f7f0cbb9a11"), /^public\/promotions\//);
  assert.throws(() => storagePathFor("menu-item", "png", "../../evil"));
  assert.throws(() => storagePathFor("menu-item", "png", "photo.png"));
  assert.equal(PUBLIC_IMAGE_PATH.test("public/menu-images/../staff.png"), false);
});
