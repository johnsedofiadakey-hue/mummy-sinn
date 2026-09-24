"use client";

import Link from "next/link";
import { ChevronRight, CircleHelp, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { useCart } from "@/components/cart-provider";
import { BackLink } from "@/components/ui";

export default function MorePage() {
  const { count } = useCart();
  return <><div className="min-h-screen px-5 pb-28 pt-[max(1.25rem,env(safe-area-inset-top))]">
    <header className="relative flex min-h-11 items-center justify-center"><span className="absolute left-0"><BackLink href="/" label="Back to home" /></span><h1 className="text-xl font-black">More</h1></header>
    <section className="mt-5 rounded-[20px] bg-[#fff2e7] p-5"><p className="brand-wordmark text-[1.5rem] text-coral">Mummy&apos;s Inn</p><p className="mt-1 text-sm text-stone-600">Good food. Brighter campus days.</p></section>
    <section className="mt-5 overflow-hidden rounded-[18px] bg-white shadow-sm">
      <Link href="/cart" className="flex min-h-16 items-center gap-3 border-b border-stone-100 px-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#fff2ee] text-coral"><ShoppingBag size={19} /></span><span className="min-w-0 flex-1"><b className="block">Your cart</b><small className="text-stone-500">{count ? `${count} item${count === 1 ? "" : "s"} ready to order` : "No items added yet"}</small></span><ChevronRight size={18} className="text-stone-400" /></Link>
      <Link href="/menu" className="flex min-h-16 items-center gap-3 border-b border-stone-100 px-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#fff7dc] text-[#a46308]"><UtensilsCrossed size={19} /></span><span className="min-w-0 flex-1"><b className="block">Browse the menu</b><small className="text-stone-500">Find your next craving</small></span><ChevronRight size={18} className="text-stone-400" /></Link>
      <div className="flex min-h-16 items-center gap-3 px-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#edf7ef] text-leaf"><CircleHelp size={19} /></span><span className="min-w-0 flex-1"><b className="block">Need help?</b><small className="text-stone-500">Kitchen support details coming soon</small></span></div>
    </section>
  </div><BottomNav /></>;
}
