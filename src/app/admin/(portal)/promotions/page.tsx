import Link from "next/link";
import { ChevronLeft, Plus } from "lucide-react";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdminPage } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { isPromotionLive, listHomepagePromotions, listMenuItems, type AdminPromotion } from "@/lib/admin/repository";
import { isDocId } from "@/lib/admin/validation";
import { PromotionForm, PromotionToggle } from "@/components/admin/promotion-form";
import { ImageUploader } from "@/components/admin/image-uploader";
import { FormMessage } from "@/components/admin/fields";

export const metadata = { title: "Homepage promotion" };

const status = (p: AdminPromotion, now: number) => !p.isActive ? { label: "Paused", tone: "bg-stone-200 text-stone-700" }
  : isPromotionLive(p, now) ? { label: "Live", tone: "bg-leaf/15 text-leaf" }
  : p.endsAt !== null && p.endsAt <= now ? { label: "Ended", tone: "bg-stone-200 text-stone-700" } : { label: "Scheduled", tone: "bg-mango/25 text-ink" };
const when = (ms: number | null) => (ms === null ? "—" : new Date(ms).toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" }));

export default async function AdminPromotionsPage({ searchParams }: { searchParams: Promise<{ edit?: string; created?: string }> }) {
  const staff = await requireAdminPage("promotions.read");
  const { edit, created } = await searchParams;
  const [promotions, items] = await Promise.all([listHomepagePromotions(adminDb), listMenuItems(adminDb)]);
  const canWrite = can(staff, "promotions.write"); const canUpload = canWrite && can(staff, "uploads.write");
  const dishes = items.filter((i) => !i.isArchived).map((i) => ({ id: i.id, name: i.name }));
  const now = Date.now();

  if (edit) {
    const existing = edit !== "new" && isDocId(edit) ? promotions.find((p) => p.id === edit) : undefined;
    if (edit !== "new" && !existing) return <><BackLink /><p className="mt-6 text-sm">That promotion no longer exists.</p></>;
    if (edit === "new" && !canWrite) return <><BackLink /><p className="mt-6 text-sm">You can view promotions but not create them.</p></>;
    return <>
      <BackLink />
      <h1 className="mb-6 text-2xl font-black md:text-3xl">{existing ? "Edit promotion" : "New homepage promotion"}</h1>
      {created && <div className="mb-5"><FormMessage tone="success">Promotion created. Add an image if you like.</FormMessage></div>}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 md:p-6">
          <PromotionForm promotionId={existing?.id} canWrite={canWrite} dishes={dishes}
            initial={{ title: existing?.title ?? "", subtitle: existing?.subtitle ?? "", priceLabel: existing?.priceLabel ?? "", targetMenuItemId: existing?.targetMenuItemId ?? "", imageUrl: existing?.imageUrl ?? "", startsAt: existing?.startsAt ?? null, endsAt: existing?.endsAt ?? null, isActive: existing?.isActive ?? false, priority: String(existing?.priority ?? 0) }} />
        </section>
        {existing && <aside><section className="rounded-2xl border border-stone-200 bg-white p-5"><h2 className="mb-3 font-black">Image</h2><ImageUploader purpose="promotion" targetId={existing.id} currentUrl={existing.imageUrl} disabled={!canUpload} /></section></aside>}
      </div>
    </>;
  }

  return <>
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-black md:text-3xl">Homepage promotion</h1><p className="mt-1 text-sm text-stone-600">One promotion can be live at a time. With none live, students see the built-in hero.</p></div>
      {canWrite && <Link href="/admin/promotions?edit=new" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-coral px-4 text-sm font-black text-white"><Plus size={16} aria-hidden /> New promotion</Link>}
    </header>
    {promotions.length === 0 ? <div className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center"><p className="font-black">No promotions yet</p><p className="mt-1 text-sm text-stone-600">Create one to feature a dish on the student Home page.</p></div>
      : <ul className="mt-6 space-y-3">{promotions.map((p) => { const s = status(p, now); return <li key={p.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4">
        <Link href={`/admin/promotions?edit=${p.id}`} className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-black"><span className="truncate">{p.title}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${s.tone}`}>{s.label}</span></p>
          <p className="mt-0.5 truncate text-sm text-stone-600">{p.subtitle || "No subtitle"}</p>
          <p className="mt-1 text-xs text-stone-500">{when(p.startsAt)} → {p.endsAt ? when(p.endsAt) : "no end date"} · priority {p.priority}</p>
        </Link>
        {canWrite && <PromotionToggle id={p.id} isActive={p.isActive} />}
      </li>; })}</ul>}
  </>;
}

function BackLink() { return <Link href="/admin/promotions" className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-stone-600"><ChevronLeft size={16} aria-hidden /> Promotions</Link>; }
