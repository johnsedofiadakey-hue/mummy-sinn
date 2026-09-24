import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdminPage } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { getMenuItem, listCategories, listModifierGroups } from "@/lib/admin/repository";
import { isDocId, pesewasToGhs } from "@/lib/admin/validation";
import { MenuItemForm } from "@/components/admin/menu-item-form";
import { ArchiveButton } from "@/components/admin/menu-controls";
import { ImageUploader } from "@/components/admin/image-uploader";
import { FormMessage } from "@/components/admin/fields";
import { describeGroup } from "@/components/admin/menu-format";

export const metadata = { title: "Edit dish" };

export default async function EditMenuItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const staff = await requireAdminPage("menu.read");
  const { id } = await params; const { created } = await searchParams;
  if (!isDocId(id)) notFound();
  const [item, categories, groups] = await Promise.all([getMenuItem(id, adminDb), listCategories(adminDb), listModifierGroups(adminDb)]);
  if (!item) notFound();
  const canWrite = can(staff, "menu.write");
  const canUpload = canWrite && can(staff, "uploads.write");

  return <>
    <Link href="/admin/menu" className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-stone-600"><ChevronLeft size={16} aria-hidden /> Menu</Link>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-black md:text-3xl">{item.name}</h1>
      {!item.isArchived && <Link href={`/menu/${item.slug}`} target="_blank" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-coral">View as student <ExternalLink size={14} aria-hidden /></Link>}
    </div>
    {created && <div className="mb-5"><FormMessage tone="success">Dish created. Add a photo below, then switch it on when it&apos;s ready to sell.</FormMessage></div>}
    {item.isArchived && <p className="mb-5 rounded-xl bg-stone-200 px-4 py-3 text-sm font-bold">This dish is archived and hidden from students.</p>}
    {!canWrite && <p className="mb-5 rounded-xl bg-stone-100 px-4 py-3 text-sm font-bold">You can view this dish but not change it.</p>}

    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <section className="rounded-2xl border border-stone-200 bg-white p-5 md:p-6">
        <MenuItemForm itemId={item.id} canWrite={canWrite}
          categories={categories.map((c) => ({ id: c.id, name: `${c.emoji} ${c.name}`.trim(), detail: c.isActive ? undefined : "(hidden)" }))}
          modifierGroups={groups.filter((g) => g.isActive || item.modifierGroupIds.includes(g.id)).map((g) => ({ id: g.id, name: g.name, detail: `${describeGroup(g)}${g.isActive ? "" : " · INACTIVE"}` }))}
          initial={{ name: item.name, slug: item.slug, description: item.description, categoryId: item.categoryId, price: pesewasToGhs(item.pricePesewas), prepMinutes: String(item.prepMinutes), isAvailable: item.isAvailable, badge: item.badge ?? "", imageUrl: item.imageUrl ?? "", modifierGroupIds: item.modifierGroupIds }} />
      </section>
      <aside className="space-y-6">
        <section className="rounded-2xl border border-stone-200 bg-white p-5"><h2 className="mb-3 font-black">Photo</h2><ImageUploader purpose="menu-item" targetId={item.id} currentUrl={item.imageUrl} disabled={!canUpload} /></section>
        {canWrite && <section className="rounded-2xl border border-stone-200 bg-white p-5"><h2 className="mb-1 font-black">{item.isArchived ? "Restore" : "Archive"}</h2><p className="mb-3 text-xs text-stone-600">{item.isArchived ? "Brings the dish back as unavailable." : "Hides the dish from students without deleting its history."}</p><ArchiveButton id={item.id} isArchived={item.isArchived} /></section>}
      </aside>
    </div>
  </>;
}
