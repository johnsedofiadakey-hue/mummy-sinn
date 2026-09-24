"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BellRing, CalendarDays, ChevronRight, MapPin, Moon, ReceiptText, Rocket, ShoppingCart } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { deliveryLocations, money, publicSettings, type PublicSettings } from "@/lib/mock-data";
import { loadDeviceOrders, loadSavedDetails, type DeviceOrder } from "@/lib/device-storage";

const FINISHED = new Set(["DELIVERED", "CANCELLED", "REFUNDED", "PAYMENT_FAILED"]);

export function HomeHeader() {
  const [hall, setHall] = useState<string | null>(null);
  const [active, setActive] = useState<DeviceOrder | null>(null);
  useEffect(() => {
    const saved = loadSavedDetails();
    setHall(deliveryLocations.find((location) => location.id === saved?.locationId)?.name ?? null);
    setActive(loadDeviceOrders().find((order) => !FINISHED.has(order.fulfillmentStatus) && Date.now() - Date.parse(order.createdAt) < 86_400_000) ?? null);
  }, []);
  return <header className="px-4 pb-1.5 pt-[max(1rem,env(safe-area-inset-top))]">
    <div className="flex items-center justify-between gap-3">
      <div><h1 className="brand-wordmark text-[1.65rem] leading-none text-coral">Mummy&apos;s Inn</h1><p className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-stone-500"><MapPin size={12} className="text-coral" aria-hidden />{hall ? <>Delivering to {hall}</> : "Delivering around campus"}</p></div>
      {active && <Link href={`/orders/${active.trackingToken}`} className="flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-black text-ink shadow-lift"><ReceiptText size={17} aria-hidden /> Track {active.orderNumber}</Link>}
      {!active && <button aria-label="Notifications" className="relative grid h-10 w-10 place-items-center rounded-full bg-white text-ink shadow-[0_3px_12px_rgba(40,25,15,.08)]"><BellRing size={19} strokeWidth={2.2} aria-hidden /><span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-coral ring-2 ring-white" /></button>}
    </div>
  </header>;
}

/** `settings` is the live public settings from the server; defaults to the bundled sample. */
export function TimingChips({ settings = publicSettings }: { settings?: PublicSettings }) {
  const router = useRouter(); const { setFulfilment } = useCart();
  if (!settings.acceptingOrders) return <div role="status" className="mx-5 mt-6 flex gap-3 rounded-app bg-ink p-5 text-white">
    <Moon size={22} className="shrink-0 text-mango" aria-hidden />
    <div><p className="font-black">The kitchen is closed right now</p><p className="mt-1 text-sm text-white/75">{settings.notice ?? "You can still browse the menu. Ordering opens again soon."}</p></div>
  </div>;
  return <div className="mt-3 grid grid-cols-2 gap-1.5 px-4">
    <button disabled={!settings.asapEnabled} onClick={() => { setFulfilment({ type: "ASAP" }); router.push("/menu"); }} className="flex min-h-[49px] items-center justify-center gap-2 rounded-xl bg-coral px-3 text-[13px] font-extrabold text-white shadow-sm disabled:bg-stone-300 disabled:text-stone-600">
      <Rocket size={17} strokeWidth={2.4} aria-hidden/><span>ASAP <small className="block text-[9px] font-semibold leading-3 text-white/85">{settings.asapEnabled ? settings.asapWindow : "Paused"}</small></span>
    </button>
    <Link href="/preorder?return=/menu" className="flex min-h-[49px] items-center justify-center gap-2 rounded-xl bg-[#fafafa] px-3 text-[13px] font-extrabold shadow-sm"><CalendarDays size={17} strokeWidth={2.2} aria-hidden/><span>Preorder <small className="block text-[9px] font-semibold leading-3 text-stone-500">Choose a time</small></span></Link>
  </div>;
}

/** Home-only cart dock mirrors the fast return-to-cart affordance in the mobile design. */
export function CartDock() {
  const { count, subtotal } = useCart();
  if (!count) return null;
  return <Link href="/cart" className="fixed inset-x-5 bottom-[4.55rem] z-30 mx-auto flex min-h-[52px] max-w-[440px] items-center justify-between rounded-[17px] bg-[#08783f] px-4 text-sm font-black text-white shadow-[0_10px_26px_rgba(5,92,45,.28)]">
    <span className="flex items-center gap-3"><span className="relative grid h-9 w-9 place-items-center rounded-full bg-white/15"><ShoppingCart size={20} aria-hidden /><span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 text-[9px]">{count}</span></span>{count} item{count === 1 ? "" : "s"} · {money(subtotal).replace(".00", "")}</span><span className="flex items-center gap-1 text-xs">View cart <ChevronRight size={15} /></span>
  </Link>;
}
