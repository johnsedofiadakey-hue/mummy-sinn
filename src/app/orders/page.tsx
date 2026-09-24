"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, ReceiptText, Trash2 } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { BackLink, Skeleton } from "@/components/ui";
import { loadDeviceOrders, removeDeviceOrder, type DeviceOrder } from "@/lib/device-storage";
import { money } from "@/lib/mock-data";

const STATUS_LABEL: Record<string, string> = { SCHEDULED: "Scheduled", CONFIRMED: "Confirmed", PREPARING: "Preparing", OUT_FOR_DELIVERY: "On the way", DELIVERED: "Delivered", CANCELLED: "Cancelled", PAYMENT_FAILED: "Payment failed", REFUNDED: "Refunded" };

export default function OrdersPage() {
  const [orders, setOrders] = useState<DeviceOrder[] | null>(null);
  useEffect(() => setOrders(loadDeviceOrders()), []);
  return <><div className="min-h-screen px-5 pb-28 pt-[max(1.25rem,env(safe-area-inset-top))]">
    <header className="relative flex min-h-11 items-center justify-center"><span className="absolute left-0"><BackLink href="/" label="Back to home" /></span><h1 className="text-xl font-black">Your orders</h1></header>
    <p className="mt-4 rounded-[18px] bg-[#fff2e7] p-3 text-xs leading-5 text-stone-700">No account needed. Recent orders stay on this phone, and each order has a shareable tracking link.</p>
    {orders === null ? <div className="mt-6 space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      : orders.length === 0 ? <div className="grid min-h-[50vh] place-items-center text-center"><div><span aria-hidden className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-coral/10 text-coral"><ReceiptText size={31}/></span><h2 className="mt-5 text-xl font-black">No orders on this phone yet</h2><p className="mt-1 text-sm text-stone-600">When you place an order, you can track it here.</p><Link href="/menu" className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-coral px-5 font-black text-white">Browse the menu</Link></div></div>
      : <ul className="mt-5 space-y-3">{orders.map((order) => <li key={order.trackingToken} className="flex items-stretch rounded-[18px] bg-white shadow-sm">
          <Link href={`/orders/${order.trackingToken}`} className="flex min-w-0 flex-1 items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-black">{order.orderNumber}<span className="rounded-full bg-[#fff2ee] px-2 py-0.5 text-[11px] font-extrabold text-coral">{STATUS_LABEL[order.fulfillmentStatus] ?? "In progress"}</span>{order.demo && <span className="rounded-full bg-mango/25 px-2 py-0.5 text-[11px] font-extrabold">Preview</span>}</p>
              <p className="mt-1 truncate text-sm text-stone-600">{order.itemsSummary}</p>
              <p className="mt-1 text-xs font-bold text-stone-500">{new Date(order.createdAt).toLocaleDateString("en-GH", { weekday: "short", day: "numeric", month: "short" })} · {money(order.total)}</p>
            </div>
            <ChevronRight size={18} aria-hidden className="shrink-0 text-stone-400" />
          </Link>
          <button onClick={() => { removeDeviceOrder(order.trackingToken); setOrders(loadDeviceOrders()); }} aria-label={`Remove order ${order.orderNumber} from this phone`} className="grid w-12 shrink-0 place-items-center border-l border-stone-100 text-stone-500"><Trash2 size={17} aria-hidden /></button>
        </li>)}</ul>}
  </div><BottomNav /></>;
}
