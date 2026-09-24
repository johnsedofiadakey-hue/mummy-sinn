// One-time catalog bootstrap for a project owner. Create-only: never overwrites an existing document.
//   GOOGLE_CLOUD_PROJECT=mummy-sinn npx tsx scripts/seed-catalog.mts --project mummy-sinn --confirm
// Requires Application Default Credentials (`gcloud auth application-default login`) for an owner account.
// Seeds categories, modifier groups, the sample menu (prices in pesewas), delivery locations and settings/public.
// It does NOT create staff, roles, orders, payments or preorder slots.
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { categories, deliveryLocations, menuItems, publicSettings } from "../src/lib/mock-data.ts";

const args = process.argv.slice(2);
const project = args[args.indexOf("--project") + 1];
if (!args.includes("--project") || !project || !args.includes("--confirm")) {
  console.error("Usage: npx tsx scripts/seed-catalog.mts --project <firebase-project-id> --confirm");
  process.exit(1);
}
const db = getFirestore(initializeApp({ projectId: project }));
const toPesewas = (ghs: number) => Math.round(ghs * 100); // sample prices have ≤ 2 decimals
const now = FieldValue.serverTimestamp();
let created = 0; let skipped = 0;

async function createIfMissing(path: string, data: Record<string, unknown>) {
  try { await db.doc(path).create({ ...data, createdAt: now, updatedAt: now }); created++; console.log(`  + ${path}`); }
  catch (error) { if ((error as { code?: number }).code === 6) { skipped++; console.log(`  = ${path} (exists, left unchanged)`); } else throw error; }
}

console.log(`Seeding catalog into project "${project}" (create-only)…`);
for (const c of categories) await createIfMissing(`categories/${c.id}`, { name: c.name, emoji: c.emoji, sortOrder: c.sortOrder, isActive: c.isActive });

const groups = new Map(menuItems.flatMap((item) => item.modifierGroups).map((g) => [g.id, g]));
for (const g of groups.values()) await createIfMissing(`modifiers/${g.id}`, {
  name: g.name, selectionType: g.max === 1 ? "single" : "multiple", min: g.min, max: g.max, isActive: true,
  options: g.options.map((o) => ({ id: o.id, name: o.name, priceAdjustmentPesewas: toPesewas(o.priceAdjustment), ...(o.isDefault ? { isDefault: true } : {}) })),
});

for (const item of menuItems) {
  await createIfMissing(`menuItems/${item.id}`, {
    name: item.name, slug: item.slug, description: item.description, categoryId: item.categoryId, pricePesewas: toPesewas(item.price),
    prepMinutes: item.prepMinutes, isAvailable: item.isAvailable, isArchived: false, badge: item.badge ?? null, imageUrl: item.imageUrl, imagePath: null,
    capacityUnits: 1, sortOrder: 100, modifierGroupIds: item.modifierGroups.map((g) => g.id),
    modifierGroups: item.modifierGroups.map((g) => ({ id: g.id, name: g.name, min: g.min, max: g.max, required: g.min > 0, options: g.options.map((o) => ({ id: o.id, name: o.name, priceAdjustmentPesewas: toPesewas(o.priceAdjustment), ...(o.isDefault ? { isDefault: true } : {}) })) })),
  });
  await createIfMissing(`menuItemSlugs/${item.slug}`, { menuItemId: item.id });
}

for (const l of deliveryLocations) await createIfMissing(`deliveryLocations/${l.id}`, { name: l.name, area: l.area, deliveryFeePesewas: toPesewas(l.deliveryFee), isActive: l.isActive, sortOrder: l.sortOrder });
await createIfMissing("settings/public", { acceptingOrders: publicSettings.acceptingOrders, asapEnabled: publicSettings.asapEnabled, notice: publicSettings.notice, supportPhone: publicSettings.supportPhone });

console.log(`Done: ${created} created, ${skipped} already existed.`);
process.exit(0);
