import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdminPage } from "@/lib/admin/guard";
import { listCategories, listModifierGroups } from "@/lib/admin/repository";
import { MenuItemForm } from "@/components/admin/menu-item-form";
import { describeGroup } from "@/components/admin/menu-format";

export const metadata = { title: "New dish" };

export default async function NewMenuItemPage() {
  await requireAdminPage("menu.write");
  const [categories, groups] = await Promise.all([listCategories(adminDb), listModifierGroups(adminDb)]);
  return <>
    <Link href="/admin/menu" className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-stone-600"><ChevronLeft size={16} aria-hidden /> Menu</Link>
    <h1 className="mb-6 text-2xl font-black md:text-3xl">New dish</h1>
    {!categories.length && <p className="mb-5 rounded-xl bg-mango/20 px-4 py-3 text-sm font-bold">There are no categories in Firestore yet. Seed the catalog first (docs/admin-portal.md).</p>}
    <MenuItemForm canWrite categories={categories.map((c) => ({ id: c.id, name: `${c.emoji} ${c.name}`.trim(), detail: c.isActive ? undefined : "(hidden)" }))}
      modifierGroups={groups.filter((g) => g.isActive).map((g) => ({ id: g.id, name: g.name, detail: describeGroup(g) }))}
      initial={{ name: "", slug: "", description: "", categoryId: "", price: "", prepMinutes: "15", isAvailable: false, badge: "", imageUrl: "", modifierGroupIds: [] }} />
  </>;
}
