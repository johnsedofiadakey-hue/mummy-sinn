import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, Megaphone, Power, UtensilsCrossed } from "lucide-react";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdminPage } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { getDashboardSnapshot } from "@/lib/admin/repository";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboard() {
  const staff = await requireAdminPage();
  if (!can(staff, "dashboard.read")) redirect(can(staff, "menu.read") ? "/admin/menu" : can(staff, "promotions.read") ? "/admin/promotions" : can(staff, "settings.read") ? "/admin/settings" : "/admin/denied?reason=FORBIDDEN");
  const snap = await getDashboardSnapshot(adminDb);
  const slotLeft = snap.nextSlot ? Math.max(0, snap.nextSlot.totalCapacity - snap.nextSlot.reservedCapacity) : 0;

  return <>
    <header><p className="text-sm font-bold text-stone-500">Welcome, {staff.displayName}</p><h1 className="text-2xl font-black md:text-3xl">Today at the kitchen</h1></header>
    {!snap.settings.exists && <p className="mt-5 rounded-xl bg-mango/20 px-4 py-3 text-sm font-bold">Kitchen settings haven&apos;t been saved yet, so students see the app&apos;s built-in defaults. {can(staff, "settings.write") && <Link href="/admin/settings" className="underline">Set them now</Link>}</p>}
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <Card icon={<Power size={20} />} title="Ordering" href={can(staff, "settings.read") ? "/admin/settings" : undefined}>
        <p className={`text-2xl font-black ${snap.settings.acceptingOrders ? "text-leaf" : "text-[#b3321f]"}`}>{snap.settings.acceptingOrders ? "Open" : "Closed"}</p>
        <p className="mt-1 text-sm text-stone-600">ASAP delivery {snap.settings.asapEnabled ? "on" : "paused"}{snap.settings.notice ? ` · Notice: “${snap.settings.notice}”` : ""}</p>
      </Card>
      <Card icon={<UtensilsCrossed size={20} />} title="Menu" href={can(staff, "menu.read") ? "/admin/menu" : undefined}>
        <p className="text-2xl font-black">{snap.menu.available} <span className="text-base font-bold text-stone-500">available</span></p>
        <p className="mt-1 text-sm text-stone-600">{snap.menu.unavailable} unavailable · {snap.menu.archived} archived</p>
      </Card>
      <Card icon={<Megaphone size={20} />} title="Homepage promotion" href={can(staff, "promotions.read") ? "/admin/promotions" : undefined}>
        {snap.livePromotion ? <><p className="text-lg font-black">{snap.livePromotion.title}</p><p className="mt-1 text-sm text-stone-600">Live now{snap.livePromotion.endsAt ? ` until ${new Date(snap.livePromotion.endsAt).toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" })}` : ""}</p></>
          : <><p className="text-lg font-black">None live</p><p className="mt-1 text-sm text-stone-600">Students see the built-in hero.</p></>}
      </Card>
      <Card icon={<CalendarClock size={20} />} title="Next preorder window">
        {snap.nextSlot ? <><p className="text-lg font-black">{snap.nextSlot.serviceDate} · {snap.nextSlot.startsAt}–{snap.nextSlot.endsAt}</p><p className="mt-1 text-sm text-stone-600">{slotLeft} of {snap.nextSlot.totalCapacity} spots left</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100" role="img" aria-label={`${snap.nextSlot.reservedCapacity} of ${snap.nextSlot.totalCapacity} spots booked`}><div className="h-full rounded-full bg-coral" style={{ width: `${snap.nextSlot.totalCapacity ? Math.min(100, (snap.nextSlot.reservedCapacity / snap.nextSlot.totalCapacity) * 100) : 0}%` }} /></div></>
          : <><p className="text-lg font-black">No open windows</p><p className="mt-1 text-sm text-stone-600">No preorder slots are open from today.</p></>}
      </Card>
    </div>
  </>;
}

function Card({ icon, title, href, children }: { icon: React.ReactNode; title: string; href?: string; children: React.ReactNode }) {
  const body = <><p className="mb-3 flex items-center gap-2 text-sm font-bold text-stone-500"><span aria-hidden className="text-coral">{icon}</span>{title}</p>{children}</>;
  return href ? <Link href={href} className="block rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-coral/40">{body}</Link> : <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">{body}</div>;
}
