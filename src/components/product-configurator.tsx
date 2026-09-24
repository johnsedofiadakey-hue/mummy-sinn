"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, Minus, Plus, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import type { MenuItem, ModifierGroup, ModifierOption } from "@/types/domain";
import { money, publicSettings } from "@/lib/mock-data";
import { fulfilmentProblem, useCart } from "@/components/cart-provider";
import { useNow } from "@/lib/use-online";

const inGroup = (selected: ModifierOption[], group: ModifierGroup) => selected.filter((entry) => group.options.some((option) => option.id === entry.id));

export function ProductConfigurator({ item }: { item: MenuItem }) {
  const router = useRouter(); const now = useNow();
  const { add, fulfilment, setFulfilment, lines } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [limitHint, setLimitHint] = useState<string | null>(null);
  const [selected, setSelected] = useState<ModifierOption[]>(item.modifierGroups.flatMap((group) => group.options.filter((option) => option.isDefault)));
  const unitPrice = useMemo(() => item.price + selected.reduce((sum, option) => sum + option.priceAdjustment, 0), [item.price, selected]);
  const missing = item.modifierGroups.filter((group) => inGroup(selected, group).length < group.min);
  const problem = now ? fulfilmentProblem(fulfilment, now) : null;

  const choose = (option: ModifierOption, group: ModifierGroup) => {
    const current = inGroup(selected, group); const isOn = current.some((entry) => entry.id === option.id);
    setLimitHint(null);
    if (group.max === 1) {
      if (isOn && group.required) return; // a required single choice can't be emptied
      setSelected((all) => [...all.filter((entry) => !group.options.some((o) => o.id === entry.id)), ...(isOn ? [] : [option])]);
      return;
    }
    if (isOn) { setSelected((all) => all.filter((entry) => entry.id !== option.id)); return; }
    if (current.length >= group.max) { setLimitHint(`${group.name}: up to ${group.max}. Untick one to swap.`); return; }
    setSelected((all) => [...all, option]);
  };

  const cta = !publicSettings.acceptingOrders ? "The kitchen is closed right now"
    : !item.isAvailable ? "Sold out today"
    : missing.length ? `Choose: ${missing[0].name}`
    : `Add ${quantity} to order`;
  const disabled = !publicSettings.acceptingOrders || !item.isAvailable || missing.length > 0;

  return <>
    <Link href="/menu" aria-label="Back to menu" className="absolute left-5 top-[max(1.25rem,env(safe-area-inset-top))] z-10 grid h-11 w-11 place-items-center rounded-full bg-white/90 shadow-lift"><ChevronLeft aria-hidden /></Link>
    <div className="relative -mt-8 rounded-t-[2rem] bg-cream px-5 pb-36 pt-7">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-sm font-bold text-stone-500">{item.isAvailable ? `${item.prepMinutes} min prep · Delivered to your hall` : "Sold out today"}</p><h1 className="mt-1 text-3xl font-black tracking-tight text-ink">{item.name}</h1></div>
        <span className="shrink-0 text-xl font-black text-coral">{money(item.price)}</span>
      </div>
      <p className="mt-4 leading-6 text-stone-600">{item.description}</p>

      {item.modifierGroups.map((group) => {
        const single = group.max === 1; const headingId = `group-${group.id}`;
        return <section key={group.id} className="mt-8">
          <div className="mb-3 flex items-baseline justify-between"><h2 id={headingId} className="font-black text-ink">{group.name}</h2><span className="text-xs font-bold text-stone-500">{group.required ? "Required" : single ? "Optional" : `Optional · up to ${group.max}`}</span></div>
          <div role={single ? "radiogroup" : "group"} aria-labelledby={headingId} className="space-y-2">
            {group.options.map((option) => {
              const active = selected.some((entry) => entry.id === option.id);
              return <button key={option.id} role={single ? "radio" : "checkbox"} aria-checked={active} onClick={() => choose(option, group)} className={`flex min-h-14 w-full items-center justify-between rounded-2xl border-2 px-4 text-left transition ${active ? "border-coral bg-white shadow-lift" : "border-transparent bg-white"}`}>
                <span className="font-bold text-ink">{option.name}</span>
                <span className="flex items-center gap-3 font-extrabold text-stone-600">{option.priceAdjustment ? `+${money(option.priceAdjustment)}` : ""}<span aria-hidden className={`grid h-6 w-6 place-items-center border-2 ${single ? "rounded-full" : "rounded-lg"} ${active ? "border-coral bg-coral text-white" : "border-stone-300"}`}>{active && <Check size={15} />}</span></span>
              </button>;
            })}
          </div>
        </section>;
      })}
      <p role="status" className="mt-3 min-h-5 text-sm font-bold text-[#b3321f]">{limitHint}</p>

      <section className="mt-5">
        <h2 id="when" className="mb-1 font-black text-ink">When should we bring it?</h2>
        <p className="mb-3 text-xs font-bold text-stone-500">{lines.length ? "This sets the delivery time for your whole order." : "One delivery time per order."}</p>
        <div role="radiogroup" aria-labelledby="when" className="grid grid-cols-2 gap-3">
          <button role="radio" aria-checked={fulfilment.type === "ASAP"} disabled={!publicSettings.asapEnabled} onClick={() => setFulfilment({ type: "ASAP" })} className={`min-h-16 rounded-2xl border-2 p-4 text-left disabled:opacity-50 ${fulfilment.type === "ASAP" ? "border-coral bg-white" : "border-transparent bg-white"}`}><b>⚡ ASAP</b><small className="mt-1 block text-stone-500">{publicSettings.asapEnabled ? `About ${publicSettings.asapWindow}` : "Paused right now"}</small></button>
          <button role="radio" aria-checked={fulfilment.type === "PREORDER"} onClick={() => router.push(`/preorder?return=/menu/${item.slug}`)} className={`min-h-16 rounded-2xl border-2 p-4 text-left ${fulfilment.type === "PREORDER" ? "border-coral bg-white" : "border-transparent bg-white"}`}><b>📅 Preorder</b><small className="mt-1 block text-stone-500">{fulfilment.type === "PREORDER" ? `${fulfilment.label} · Change` : "Pick a time"}</small></button>
        </div>
        {problem && <p role="alert" className="mt-3 text-sm font-bold text-[#b3321f]">{problem}</p>}
      </section>

      <div className="mt-8 flex items-center justify-center gap-5">
        <button onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1} aria-label="Decrease quantity" className="grid h-12 w-12 place-items-center rounded-full bg-white shadow-sm disabled:opacity-40"><Minus size={18} aria-hidden /></button>
        <b aria-live="polite" aria-label={`Quantity ${quantity}`} className="min-w-6 text-center text-lg">{quantity}</b>
        <button onClick={() => setQuantity(Math.min(20, quantity + 1))} aria-label="Increase quantity" className="grid h-12 w-12 place-items-center rounded-full bg-white shadow-sm"><Plus size={18} aria-hidden /></button>
      </div>
    </div>

    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] border-t border-stone-100 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <button disabled={disabled} onClick={() => { add(item, selected, quantity); router.push("/cart"); }} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl bg-coral px-5 font-black text-white shadow-float disabled:bg-stone-300 disabled:text-stone-600 disabled:shadow-none">
        <span className="flex items-center gap-2"><ShoppingBag size={19} aria-hidden /> {cta}</span>{!disabled && <span>{money(unitPrice * quantity)}</span>}
      </button>
    </div>
  </>;
}
