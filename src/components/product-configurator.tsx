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
    : "Add to cart";
  const disabled = !publicSettings.acceptingOrders || !item.isAvailable || missing.length > 0;

  return <>
    <Link href="/menu" aria-label="Back to menu" className="absolute left-5 top-[max(1.25rem,env(safe-area-inset-top))] z-10 grid h-11 w-11 place-items-center rounded-full bg-white/90 shadow-lift"><ChevronLeft aria-hidden /></Link>
    <div className="relative -mt-7 rounded-t-[1.7rem] bg-cream px-5 pb-36 pt-6 shadow-[0_-8px_24px_rgba(60,30,15,.08)]">
      <div className="mx-auto mb-5 h-1.5 w-11 rounded-full bg-stone-300" />
      <div>
        <h1 className="text-[1.55rem] font-black tracking-tight text-ink">{item.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-stone-500"><span className="text-[1.35rem] font-black text-coral">{money(item.price).replace(".00", "")}</span><span>◷ {item.prepMinutes}–{item.prepMinutes + 5} min prep</span>{item.badge && <span className="rounded-full bg-[#fff1cf] px-2 py-1 text-[#9a5411]">🔥 {item.badge}</span>}</div>
      </div>
      <p className="mt-3 text-sm leading-5 text-stone-600">{item.description}</p>

      {item.modifierGroups.map((group) => {
        const single = group.max === 1; const headingId = `group-${group.id}`;
        return <section key={group.id} className="mt-8">
          <div className="mb-3 flex items-baseline justify-between"><h2 id={headingId} className="font-black text-ink">{group.name}</h2>{group.id === "extras" && <span className="text-xs font-bold text-stone-500">(optional)</span>}</div>
          <div role={single ? "radiogroup" : "group"} aria-labelledby={headingId} className={`gap-2 ${group.id === "protein-choice" || group.id === "extras" || group.id === "spice" ? "grid grid-cols-3" : "space-y-2"}`}>
            {group.options.map((option) => {
              const active = selected.some((entry) => entry.id === option.id);
              const icon = group.id === "protein-choice" ? option.id === "fish" ? "🐟" : option.id === "pork" ? "🥩" : "🍗" : group.id === "extras" ? option.id === "egg" ? "🍳" : option.id === "plantain" ? "🍌" : "🍗" : option.id === "mild" ? "🫑" : option.id === "medium" ? "🌶️" : "🌶️";
              return <button key={option.id} role={single ? "radio" : "checkbox"} aria-checked={active} onClick={() => choose(option, group)} className={`relative min-h-[72px] rounded-xl border-2 p-2 text-left transition ${group.id === "protein-choice" || group.id === "extras" || group.id === "spice" ? "flex flex-col items-center justify-center" : "flex w-full items-center justify-between px-4"} ${active ? "border-coral bg-white shadow-sm" : "border-stone-100 bg-white"}`}>
                {(group.id === "protein-choice" || group.id === "extras" || group.id === "spice") && <span className="mb-1 text-xl" aria-hidden>{icon}</span>}<span className="text-center text-[11px] font-bold leading-4 text-ink">{option.name}</span>
                {option.priceAdjustment ? <span className={`text-[10px] font-black ${option.priceAdjustment > 0 ? "text-coral" : "text-leaf"}`}>+{money(option.priceAdjustment).replace(".00", "")}</span> : null}
                <span aria-hidden className={`absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center border ${single ? "rounded-full" : "rounded"} ${active ? "border-coral bg-coral text-white" : "border-stone-300 bg-white"}`}>{active && <Check size={10} />}</span>
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
          <button role="radio" aria-checked={fulfilment.type === "ASAP"} disabled={!publicSettings.asapEnabled} onClick={() => setFulfilment({ type: "ASAP" })} className={`min-h-16 rounded-xl border-2 p-3 text-center disabled:opacity-50 ${fulfilment.type === "ASAP" ? "border-coral bg-white" : "border-stone-100 bg-white"}`}><b>⚡ ASAP</b><small className="mt-1 block text-[10px] text-stone-500">{publicSettings.asapEnabled ? `About ${publicSettings.asapWindow}` : "Paused right now"}</small></button>
          <button role="radio" aria-checked={fulfilment.type === "PREORDER"} onClick={() => router.push(`/preorder?return=/menu/${item.slug}`)} className={`min-h-16 rounded-xl border-2 p-3 text-center ${fulfilment.type === "PREORDER" ? "border-coral bg-coral text-white" : "border-stone-100 bg-white"}`}><b>📅 Preorder</b><small className={`mt-1 block text-[10px] ${fulfilment.type === "PREORDER" ? "text-white/85" : "text-stone-500"}`}>{fulfilment.type === "PREORDER" ? `${fulfilment.label} · Change` : "Choose a time"}</small></button>
        </div>
        {problem && <p role="alert" className="mt-3 text-sm font-bold text-[#b3321f]">{problem}</p>}
      </section>

      <div className="mt-8 flex items-center justify-center gap-5">
        <button onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1} aria-label="Decrease quantity" className="grid h-12 w-12 place-items-center rounded-full bg-white shadow-sm disabled:opacity-40"><Minus size={18} aria-hidden /></button>
        <b aria-live="polite" aria-label={`Quantity ${quantity}`} className="min-w-6 text-center text-lg">{quantity}</b>
        <button onClick={() => setQuantity(Math.min(20, quantity + 1))} aria-label="Increase quantity" className="grid h-12 w-12 place-items-center rounded-full bg-white shadow-sm"><Plus size={18} aria-hidden /></button>
      </div>
    </div>

    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] border-t border-stone-100 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <button disabled={disabled} onClick={() => { add(item, selected, quantity); router.push("/cart"); }} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl bg-coral px-5 font-black text-white shadow-float disabled:bg-stone-300 disabled:text-stone-600 disabled:shadow-none">
        <span className="flex items-center gap-2"><ShoppingBag size={19} aria-hidden /> {cta}</span>{!disabled && <span>{money(unitPrice * quantity).replace(".00", "")}</span>}
      </button>
    </div>
  </>;
}
