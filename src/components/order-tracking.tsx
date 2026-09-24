"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Check, Circle, Copy, Eye, EyeOff, MapPin, Phone, RefreshCw, Share2, ShoppingBag } from "lucide-react";
import type { FulfillmentStatus } from "@/types/domain";
import { BackLink, DemoNotice, Skeleton, Toast } from "@/components/ui";
import { findDeviceOrder, type DeviceOrder } from "@/lib/device-storage";
import { DEMO_MODE } from "@/lib/demo";
import { money, publicSettings } from "@/lib/mock-data";
import { formatTime } from "@/lib/slots";

const JOURNEY: { label: string; statuses: FulfillmentStatus[]; detail: string }[] = [
  { label: "Payment confirmed", statuses: ["PAYMENT_CONFIRMED"], detail: "We've received your payment." },
  { label: "Order confirmed", statuses: ["CONFIRMED", "SCHEDULED", "QUEUED_FOR_KITCHEN"], detail: "Your order is in the kitchen queue." },
  { label: "Preparing your food", statuses: ["PREPARING"], detail: "Cooking up your good food now." },
  { label: "Packing your order", statuses: ["READY_FOR_PACKING", "PACKING", "PACKED"], detail: "Almost ready to leave the kitchen." },
  { label: "Waiting for a rider", statuses: ["AWAITING_DISPATCH", "RIDER_ASSIGNED"], detail: "A rider is being matched to your hall." },
  { label: "Out for delivery", statuses: ["OUT_FOR_DELIVERY"], detail: "Keep your phone close. Have your PIN ready." },
  { label: "Delivered", statuses: ["DELIVERED"], detail: "Enjoy your meal!" },
];
const EXCEPTIONS: Partial<Record<FulfillmentStatus, { title: string; body: string; action?: { label: string; href: string } }>> = {
  AWAITING_PAYMENT: { title: "Waiting for your payment", body: "We'll start cooking as soon as your payment is confirmed.", action: { label: "Back to checkout", href: "/checkout" } },
  PAYMENT_FAILED: { title: "Payment didn't go through", body: "This order wasn't placed. Your cart may still be saved on this phone.", action: { label: "Try again", href: "/cart" } },
  CANCELLED: { title: "Order cancelled", body: "This order was cancelled. If you paid, your refund status will show here." },
  DELIVERY_FAILED: { title: "We couldn't complete delivery", body: "Something went wrong on the way. The kitchen will contact you about a refund or a new delivery." },
  CUSTOMER_UNREACHABLE: { title: "Our rider couldn't reach you", body: "Keep your phone on and nearby. We'll try calling again shortly." },
  REFUND_PENDING: { title: "Refund in progress", body: "Your refund has started. Mobile Money refunds usually arrive within a few working days." },
  REFUNDED: { title: "Refunded", body: "Your refund has been sent to the account you paid with." },
};
const ALL_STATUSES = new Set<string>([...JOURNEY.flatMap((step) => step.statuses), ...Object.keys(EXCEPTIONS)]);
const maskRoom = (room: string) => room.length <= 2 ? "••" : `${room.slice(0, -2)}••`;

export function OrderTracking({ token }: { token: string }) {
  const [order, setOrder] = useState<DeviceOrder | null | undefined>(undefined);
  const [override, setOverride] = useState<FulfillmentStatus | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = async () => {
    const local = findDeviceOrder(token);
    if (local || DEMO_MODE) { setOrder(local ?? null); setCheckedAt(new Date()); return; }
    try {
      const response = await fetch(`/api/orders/track/${encodeURIComponent(token)}`, { cache: "no-store" });
      if (!response.ok) { setOrder(null); return; }
      const live = await response.json() as { orderNumber: string; paymentStatus: DeviceOrder["paymentStatus"]; fulfillmentStatus: DeviceOrder["fulfillmentStatus"]; orderType: DeviceOrder["orderType"]; createdAt: string | null; totalPesewas: number | null; delivery: { hallOrHostel: string | null; block: string | null; roomOrLandmark: string | null }; items: { name: string; quantity: number }[] };
      setOrder({ trackingToken: token, orderNumber: live.orderNumber, createdAt: live.createdAt ?? new Date().toISOString(), demo: false, itemsSummary: live.items.map((item) => `${item.quantity}× ${item.name}`).join(", "), itemCount: live.items.reduce((sum, item) => sum + item.quantity, 0), total: (live.totalPesewas ?? 0) / 100, fulfilmentLabel: live.orderType === "ASAP" ? "ASAP delivery" : "Preorder", orderType: live.orderType, hallName: live.delivery.hallOrHostel ?? "", block: live.delivery.block ?? "", room: live.delivery.roomOrLandmark ?? "", pin: "", paymentStatus: live.paymentStatus, fulfillmentStatus: live.fulfillmentStatus });
    } catch { setOrder(null); } finally { setCheckedAt(new Date()); }
  };
  useEffect(() => {
    void refresh();
    const status = new URLSearchParams(window.location.search).get("status");
    if (DEMO_MODE && status && ALL_STATUSES.has(status)) setOverride(status as FulfillmentStatus); // QA: preview each state
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(null), 2500); return () => window.clearTimeout(id); }, [toast]);

  const copy = async (text: string, done: string) => { try { await navigator.clipboard.writeText(text); setToast(done); } catch { setToast("Couldn't copy. Long-press to copy instead."); } };
  const share = async () => {
    const url = window.location.origin + window.location.pathname;
    if (navigator.share) { try { await navigator.share({ title: `Mummy's Inn order ${order?.orderNumber}`, url }); return; } catch { return; } }
    copy(url, "Tracking link copied");
  };

  if (order === undefined) return <div className="space-y-4 px-5 pt-[max(1.25rem,env(safe-area-inset-top))]" aria-busy="true"><Skeleton className="h-12 w-48" /><Skeleton className="h-52" /><Skeleton className="h-64" /></div>;
  if (order === null) return <div className="min-h-screen px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
    <header className="flex items-center gap-3"><BackLink href="/orders" label="Back to orders" /><h1 className="text-2xl font-black">Order tracking</h1></header>
    <div className="grid min-h-[60vh] place-items-center text-center"><div className="max-w-[300px]">
      <span aria-hidden className="text-6xl">🧾</span><h2 className="mt-5 text-xl font-black">We couldn&apos;t find that order</h2>
      <p className="mt-2 text-sm text-stone-600">Check that you opened the full tracking link from your order.{DEMO_MODE && " In this demo, orders can only be tracked on the phone that placed them."}</p>
      <Link href="/orders" className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-coral px-5 font-black text-white">See orders on this phone</Link>
    </div></div>
  </div>;

  const status = override ?? order.fulfillmentStatus;
  const exception = EXCEPTIONS[status];
  const currentIndex = JOURNEY.findIndex((step) => step.statuses.includes(status));
  const created = new Date(order.createdAt);
  const eta = order.orderType === "ASAP" ? `${formatTime(new Date(created.getTime() + 25 * 60_000))} – ${formatTime(new Date(created.getTime() + 35 * 60_000))}` : order.fulfilmentLabel;
  const address = [order.hallName, order.block, showAddress ? order.room : maskRoom(order.room)].filter(Boolean).join(" · ");

  return <div className="min-h-screen px-5 pb-12 pt-[max(1.25rem,env(safe-area-inset-top))]">
    <header className="flex items-center gap-3"><BackLink href="/orders" label="Back to orders" /><div><p className="text-xs font-bold uppercase tracking-wider text-coral">Order tracking</p><h1 className="text-2xl font-black">{order.orderNumber}</h1></div></header>
    {order.demo && <div className="mt-5"><DemoNotice><b>Sample tracking.</b> This status is not live and won&apos;t change by itself.</DemoNotice></div>}

    {exception ? <section role="status" className="mt-5 rounded-[2rem] bg-coral/10 p-6">
      <AlertTriangle className="text-[#b3321f]" aria-hidden /><h2 className="mt-3 text-2xl font-black">{exception.title}</h2><p className="mt-2 text-stone-700">{exception.body}</p>
      {exception.action && <Link href={exception.action.href} className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-coral px-5 font-black text-white">{exception.action.label}</Link>}
    </section> : <section className="mt-5 overflow-hidden rounded-[2rem] bg-ink p-6 text-white">
      <h2 className="text-2xl font-black">{status === "DELIVERED" ? "Delivered. Enjoy!" : status === "SCHEDULED" ? "Booked in for later." : "We're making it fresh."}</h2>
      <p className="mt-2 text-white/75">For {order.hallName}{order.orderType === "PREORDER" ? ", in your chosen window." : "."}</p>
      {status !== "DELIVERED" && <div className="mt-5 rounded-2xl bg-white/10 p-4"><p className="text-xs font-bold uppercase tracking-widest text-white/65">{order.orderType === "ASAP" ? "Estimated arrival" : "Delivery window"}</p><p className="mt-1 text-lg font-black">{eta}</p></div>}
    </section>}

    <p className="mt-3 flex items-center justify-between text-xs font-bold text-stone-600"><span>Last checked {checkedAt ? formatTime(checkedAt) : ""}</span><button onClick={() => void refresh()} className="flex min-h-11 items-center gap-1.5 px-2 text-coral"><RefreshCw size={14} aria-hidden /> Refresh</button></p>

    {!exception && <section className="mt-4"><h2 className="font-black">Your order journey</h2><ol className="mt-5">{JOURNEY.map((step, index) => {
      const done = index < currentIndex || status === "DELIVERED"; const current = index === currentIndex && status !== "DELIVERED";
      return <li key={step.label} aria-current={current ? "step" : undefined} className="relative flex gap-4 pb-6">
        <div className="relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cream">{done ? <span className="grid h-6 w-6 place-items-center rounded-full bg-leaf text-white"><Check size={14} aria-hidden /></span> : current ? <span className="h-3 w-3 rounded-full bg-coral" /> : <Circle size={15} className="text-stone-300" aria-hidden />}</div>
        {index < JOURNEY.length - 1 && <span aria-hidden className={`absolute left-[13px] top-7 h-6 w-px ${done ? "bg-leaf" : "bg-stone-200"}`} />}
        <div><p className={`font-bold ${current ? "text-[#b3321f]" : done ? "text-ink" : "text-stone-500"}`}>{step.label}<span className="sr-only">{done ? " (done)" : current ? " (current)" : ""}</span></p>{current && <p className="mt-0.5 text-sm text-stone-600">{step.detail}</p>}</div>
      </li>;
    })}</ol></section>}

    {!exception && status !== "DELIVERED" && order.pin && <section className="mt-2 rounded-app bg-white p-5 shadow-lift">
      <p className="font-black">Your delivery PIN</p><p className="mt-1 text-sm text-stone-600">Give it to the rider only when your food is in your hands.</p>
      <div className="mt-3 flex gap-2">
        <button onClick={() => setShowPin((v) => !v)} aria-label={showPin ? "Hide delivery PIN" : "Show delivery PIN"} className="flex min-h-12 flex-1 items-center justify-between rounded-xl bg-cream px-4 text-lg font-black tracking-[.3em]">{showPin ? order.pin : "••••"}{showPin ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}</button>
        <button onClick={() => copy(order.pin, "PIN copied")} aria-label="Copy delivery PIN" className="grid h-12 w-12 place-items-center rounded-xl bg-cream"><Copy size={17} aria-hidden /></button>
      </div>
    </section>}

    <section className="mt-4 rounded-app bg-mango/15 p-5">
      <p className="flex items-start gap-2 font-black"><ShoppingBag size={18} className="mt-0.5 shrink-0" aria-hidden /> {order.itemsSummary}</p>
      <p className="mt-2 text-sm font-bold text-stone-700">{money(order.total)}{status === "PAYMENT_FAILED" || status === "AWAITING_PAYMENT" ? "" : " · paid"}</p>
      <p className="mt-2 flex items-center gap-2 text-sm text-stone-700"><MapPin size={15} aria-hidden className="shrink-0" /> <span>{address}</span> <button onClick={() => setShowAddress((v) => !v)} className="min-h-11 px-1 text-xs font-black text-coral">{showAddress ? "Hide" : "Show room"}</button></p>
      <p className="flex items-center gap-2 text-sm text-stone-700"><Phone size={15} aria-hidden /> The rider will call your number on arrival</p>
    </section>

    <section className="mt-4 rounded-app bg-white p-5 shadow-lift">
      <p className="font-black">Keep this link</p>
      <p className="mt-1 text-sm text-stone-600">No account needed. This link is how you get back to your order, and it&apos;s saved under Orders on this phone.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={share} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cream text-sm font-black"><Share2 size={16} aria-hidden /> Share link</button>
        {publicSettings.supportPhone ? <a href={`tel:${publicSettings.supportPhone}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cream text-sm font-black"><Phone size={16} aria-hidden /> Call kitchen</a>
          : <Link href="/menu" className="flex min-h-12 items-center justify-center rounded-xl bg-cream text-sm font-black">Order more</Link>}
      </div>
    </section>
    {toast && <Toast bottom="bottom-6" message={toast} />}
  </div>;
}
