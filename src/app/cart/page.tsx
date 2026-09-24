"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { cartLinePrice, fulfilmentProblem, useCart } from "@/components/cart-provider";
import { FulfilmentSummary } from "@/components/fulfilment-summary";
import { BackLink, Skeleton, Toast } from "@/components/ui";
import { money, publicSettings } from "@/lib/mock-data";
import { useNow } from "@/lib/use-online";

export default function CartPage() {
  const { lines, subtotal, updateQuantity, remove, hydrated, lastRemoved, undoRemove, requote, fulfilment } = useCart();
  const now = useNow();
  const [notice, setNotice] = useState<string | null>(null);
  const [undoVisible, setUndoVisible] = useState(false);
  const checked = useRef(false);

  useEffect(() => {
    if (!hydrated || checked.current) return; checked.current = true;
    const { priceChanged, removed } = requote();
    if (removed.length) setNotice(`${removed.join(", ")} ${removed.length === 1 ? "is" : "are"} sold out and ${removed.length === 1 ? "was" : "were"} removed.`);
    else if (priceChanged.length) setNotice(`Prices updated for ${priceChanged.join(", ")}.`);
  }, [hydrated, requote]);
  useEffect(() => { if (!lastRemoved) return; setUndoVisible(true); const id = window.setTimeout(() => setUndoVisible(false), 5000); return () => window.clearTimeout(id); }, [lastRemoved]);

  const blocked = !publicSettings.acceptingOrders || (now ? fulfilmentProblem(fulfilment, now) : null);

  return <><div className="min-h-screen px-5 pb-44 pt-[max(1.25rem,env(safe-area-inset-top))]">
    <header className="relative flex min-h-11 items-center justify-center"><span className="absolute left-0"><BackLink href="/menu" label="Back to menu" /></span><h1 className="text-xl font-black">Your order{lines.length ? ` (${lines.reduce((sum, line) => sum + line.quantity, 0)} items)` : ""}</h1></header>
    {!hydrated ? <div className="mt-7 space-y-3" aria-busy="true" aria-label="Loading your cart"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-20" /></div>
      : lines.length === 0 ? <div className="grid min-h-[55vh] place-items-center text-center"><div><span aria-hidden className="text-6xl">🥡</span><h2 className="mt-5 text-xl font-black">Nothing delicious here yet.</h2><Link href="/menu" className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-coral px-5 font-black text-white">Browse the menu</Link></div></div>
      : <>
        {notice && <p role="status" className="mt-5 rounded-2xl bg-mango/20 p-4 text-sm font-bold">{notice}</p>}
        <div className="mt-6"><FulfilmentSummary returnTo="/cart" /></div>
        <ul className="mt-5 space-y-3">{lines.map((line) => <li key={line.id} className="rounded-[18px] bg-white p-3 shadow-sm">
          <div className="flex gap-3">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl"><Image src={line.menuItem.imageUrl} alt="" fill sizes="80px" className="object-cover" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2"><h2 className="pt-1 font-black leading-5">{line.menuItem.name}</h2><button onClick={() => remove(line.id)} aria-label={`Remove ${line.menuItem.name}`} className="-mr-2 -mt-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-stone-500 active:bg-cream"><Trash2 size={18} aria-hidden /></button></div>
              <p className="text-xs text-stone-600">{line.selectedOptions.map((option) => option.name).join(" · ") || "Just as it comes"}</p>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQuantity(line.id, line.quantity - 1)} aria-label={line.quantity === 1 ? `Remove ${line.menuItem.name}` : `One less ${line.menuItem.name}`} className="grid h-11 w-11 place-items-center rounded-full bg-cream"><Minus size={16} aria-hidden /></button>
                  <b className="min-w-7 text-center" aria-label={`Quantity ${line.quantity}`}>{line.quantity}</b>
                  <button onClick={() => updateQuantity(line.id, Math.min(20, line.quantity + 1))} aria-label={`One more ${line.menuItem.name}`} className="grid h-11 w-11 place-items-center rounded-full bg-cream"><Plus size={16} aria-hidden /></button>
                </div>
                <b>{money(cartLinePrice(line) * line.quantity)}</b>
              </div>
            </div>
          </div>
        </li>)}</ul>
        <section className="mt-6 space-y-3 border-t border-stone-200 pt-5 text-sm">
          <div className="flex justify-between text-lg font-black"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          <p className="text-stone-600">Delivery fee depends on your hall or hostel. You&apos;ll see it before you pay.</p>
        </section>
        {!publicSettings.acceptingOrders && <p role="alert" className="mt-4 rounded-2xl bg-ink p-4 text-sm font-bold text-white">The kitchen is closed right now, so checkout is paused. Your cart is saved.</p>}
        <div className="fixed inset-x-0 bottom-[4.4rem] z-20 mx-auto w-full max-w-[430px] px-5 pb-[env(safe-area-inset-bottom)]">
          {blocked ? <span aria-disabled="true" className="flex min-h-14 items-center justify-center rounded-2xl bg-stone-300 px-5 font-black text-stone-600">{publicSettings.acceptingOrders ? "Choose a delivery time to continue" : "Checkout paused"}</span>
            : <Link href="/checkout" className="flex min-h-14 items-center justify-between rounded-2xl bg-coral px-5 font-black text-white shadow-float"><span>Continue to delivery</span><span>{money(subtotal)}</span></Link>}
        </div>
      </>}
  </div>
  {undoVisible && lastRemoved && <Toast bottom="bottom-[9.2rem]" message={`Removed ${lastRemoved.menuItem.name}`} actionLabel="Undo" onAction={() => { undoRemove(); setUndoVisible(false); }} />}
  <BottomNav /></>;
}
