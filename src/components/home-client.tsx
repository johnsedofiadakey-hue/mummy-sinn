"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MapPin, Moon, ReceiptText } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { deliveryLocations, publicSettings } from "@/lib/mock-data";
import { loadDeviceOrders, loadSavedDetails, type DeviceOrder } from "@/lib/device-storage";
import { useNow } from "@/lib/use-online";

const FINISHED = new Set(["DELIVERED", "CANCELLED", "REFUNDED", "PAYMENT_FAILED"]);

export function HomeHeader() {
  const now = useNow();
  const [hall, setHall] = useState<string | null>(null);
  const [active, setActive] = useState<DeviceOrder | null>(null);
  useEffect(() => {
    const saved = loadSavedDetails();
    setHall(deliveryLocations.find((location) => location.id === saved?.locationId)?.name ?? null);
    setActive(loadDeviceOrders().find((order) => !FINISHED.has(order.fulfillmentStatus) && Date.now() - Date.parse(order.createdAt) < 86_400_000) ?? null);
  }, []);
  const hour = now?.getHours();
  const greeting = hour === undefined ? "Hello," : hour < 12 ? "Good morning," : hour < 17 ? "Good afternoon," : "Good evening,";
  return <header className="px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
    <div className="flex items-center justify-between gap-3">
      <div><p className="text-sm font-bold text-stone-500">{greeting}</p><h1 className="font-black tracking-tight text-ink">Mummy&apos;s Inn <span aria-hidden className="inline-block -rotate-12">🍲</span></h1></div>
      {active && <Link href={`/orders/${active.trackingToken}`} className="flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-black text-ink shadow-lift"><ReceiptText size={17} aria-hidden /> Track {active.orderNumber}</Link>}
    </div>
    <p className="mt-4 flex items-center gap-1.5 text-sm font-bold text-stone-600"><MapPin size={15} aria-hidden className="text-coral" />{hall ? <>Delivering to <span className="text-ink">{hall}</span></> : "We deliver to halls and hostels on campus"}</p>
  </header>;
}

export function TimingChips() {
  const router = useRouter(); const { setFulfilment } = useCart();
  if (!publicSettings.acceptingOrders) return <div role="status" className="mx-5 mt-6 flex gap-3 rounded-app bg-ink p-5 text-white">
    <Moon size={22} className="shrink-0 text-mango" aria-hidden />
    <div><p className="font-black">The kitchen is closed right now</p><p className="mt-1 text-sm text-white/75">{publicSettings.notice ?? "You can still browse the menu. Ordering opens again soon."}</p></div>
  </div>;
  return <div className="mt-6 flex gap-3 overflow-x-auto px-5 hide-scrollbar">
    <button disabled={!publicSettings.asapEnabled} onClick={() => { setFulfilment({ type: "ASAP" }); router.push("/menu"); }} className="flex min-h-12 shrink-0 items-center gap-2 rounded-2xl bg-ink px-4 text-sm font-extrabold text-white disabled:bg-stone-300 disabled:text-stone-600">
      <span aria-hidden>⚡</span> ASAP <small className="font-semibold opacity-75">{publicSettings.asapEnabled ? publicSettings.asapWindow : "Paused right now"}</small>
    </button>
    <Link href="/preorder?return=/menu" className="flex min-h-12 shrink-0 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-extrabold shadow-lift"><span aria-hidden>📅</span> Preorder <small className="font-semibold text-stone-500">Choose a time</small></Link>
  </div>;
}
