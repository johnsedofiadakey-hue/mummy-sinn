import Link from "next/link";
import { Plus } from "lucide-react";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdminPage } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { listCategories, listMenuItems } from "@/lib/admin/repository";
import { pesewasToGhs } from "@/lib/admin/validation";
import { AvailabilityToggle } from "@/components/admin/menu-controls";

export const metadata = { title: "Menu" };
const FILTERS = [{ id: "all", label: "All" }, { id: "available", label: "Available" }, { id: "unavailable", label: "Unavailable" }, { id: "archived", label: "Archived" }] as const;

export default async function AdminMenuPage({ searchParams }: { searchParams: Promise<{ status?: string; category?: string }> }) {
  const staff = await requireAdminPage("menu.read");
  const { status = "all", category } = await searchParams;
  const [items, categories] = await Promise.all([listMenuItems(adminDb), listCategories(adminDb)]);
  const categoryName = new Map(categories.map((c) => [c.id, `${c.emoji} ${c.name}`.trim()]));
  const visible = items.filter((i) => (!category || i.categoryId === category) && (
    status === "available" ? i.isAvailable && !i.isArchived : status === "unavailable" ? !i.isAvailable && !i.isArchived : status === "archived" ? i.isArchived : !i.isArchived));
  const writable = can(staff, "menu.write");
  const href = (next: { status?: string; category?: string }) => { const p = new URLSearchParams({ ...(status !== "all" ? { status } : {}), ...(category ? { category } : {}), ...next }); if (p.get("status") === "all") p.delete("status"); if (!p.get("category")) p.delete("category"); const q = p.toString(); return `/admin/menu${q ? `?${q}` : ""}`; };

  return <>
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-black md:text-3xl">Menu</h1><p className="mt-1 text-sm text-stone-600">{(() => { const n = items.filter((i) => !i.isArchived).length; return `${n} ${n === 1 ? "dish" : "dishes"}`; })()} · changes reach students within a minute</p></div>
      {writable && <Link href="/admin/menu/new" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-coral px-4 text-sm font-black text-white"><Plus size={16} aria-hidden /> New dish</Link>}
    </header>

    <div className="mt-5 flex flex-wrap gap-2">
      {FILTERS.map((f) => <Link key={f.id} href={href({ status: f.id })} aria-current={status === f.id ? "page" : undefined} className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-bold ${status === f.id ? "bg-ink text-white" : "border border-stone-200 bg-white text-stone-700"}`}>{f.label}</Link>)}
      <span className="mx-1 hidden w-px bg-stone-200 sm:block" />
      <Link href={href({ category: "" })} className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-bold ${!category ? "bg-coral/10 text-coral" : "border border-stone-200 bg-white text-stone-700"}`}>All categories</Link>
      {categories.map((c) => <Link key={c.id} href={href({ category: c.id })} className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-bold ${category === c.id ? "bg-coral/10 text-coral" : "border border-stone-200 bg-white text-stone-700"}`}>{c.emoji} {c.name}{!c.isActive && " (hidden)"}</Link>)}
    </div>

    {items.length === 0 ? <div className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center"><p className="font-black">No dishes in Firestore yet</p><p className="mt-1 text-sm text-stone-600">Students currently see the app&apos;s sample menu. Seed the catalog (see docs/admin-portal.md) or create your first dish.</p></div>
      : visible.length === 0 ? <p className="mt-8 text-center text-sm text-stone-600">No dishes match this filter.</p>
      : <ul className="mt-5 divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white">
        {visible.map((item) => <li key={item.id} className="flex items-center gap-4 px-4 py-3">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-stone-100">
            {/* eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail */}
            {item.imageUrl && <img src={item.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />}
          </div>
          <Link href={`/admin/menu/${item.id}`} className="min-w-0 flex-1">
            <p className="truncate font-black">{item.name}</p>
            <p className="truncate text-xs text-stone-500">{categoryName.get(item.categoryId) ?? item.categoryId} · GHS {pesewasToGhs(item.pricePesewas)} · {item.prepMinutes} min</p>
            {item.isArchived && <span className="mt-1 inline-block rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-bold">Archived</span>}
          </Link>
          {!item.isArchived && <AvailabilityToggle id={item.id} name={item.name} isAvailable={item.isAvailable} disabled={!writable} />}
        </li>)}
      </ul>}
  </>;
}
