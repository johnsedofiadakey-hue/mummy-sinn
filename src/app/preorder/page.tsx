"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronRight } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { BackLink, Skeleton } from "@/components/ui";
import { preorderSlots, publicSettings } from "@/lib/mock-data";
import { localDay, ORDER_CUTOFF_MINUTES, slotCutoff, slotLabel, slotState, slotWindow } from "@/lib/slots";
import { useNow } from "@/lib/use-online";

type Choice = { type: "ASAP" } | { type: "PREORDER"; slotId: string };
const DAYS = ["Today", "Tomorrow"] as const;

export default function PreorderPage() { return <Suspense><DeliveryTime /></Suspense>; }

function DeliveryTime() {
  const router = useRouter(); const params = useSearchParams(); const now = useNow();
  const { fulfilment, setFulfilment, hydrated, lines } = useCart();
  const raw = params.get("return"); const returnTo = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/menu";
  const [day, setDay] = useState<(typeof DAYS)[number]>("Today");
  const [choice, setChoice] = useState<Choice | null>(null);

  // Start from the cart's current choice once it has loaded, if that slot can still be used.
  useEffect(() => {
    if (!hydrated || !now || choice) return;
    if (fulfilment.type === "PREORDER") {
      const slot = preorderSlots.find((s) => s.id === fulfilment.slotId);
      if (slot && fulfilment.chosenOn === localDay(now) && slotState(slot, now) === "open") { setDay(slot.serviceDate as (typeof DAYS)[number]); setChoice({ type: "PREORDER", slotId: slot.id }); return; }
    }
    if (publicSettings.asapEnabled) setChoice({ type: "ASAP" });
  }, [hydrated, now, fulfilment, choice]);

  const slots = preorderSlots.filter((slot) => slot.serviceDate === day && (!now || slotState(slot, now) !== "closed"));
  const confirm = () => {
    if (!choice || !now) return;
    if (choice.type === "ASAP") setFulfilment({ type: "ASAP" });
    else { const slot = preorderSlots.find((s) => s.id === choice.slotId)!; setFulfilment({ type: "PREORDER", slotId: slot.id, label: slotLabel(slot), chosenOn: localDay(now) }); }
    router.push(returnTo);
  };
  const selectedSlot = choice?.type === "PREORDER" ? preorderSlots.find((s) => s.id === choice.slotId) : undefined;

  return <div className="min-h-screen px-5 pb-36 pt-[max(1.25rem,env(safe-area-inset-top))]">
    <header className="flex items-center gap-3"><BackLink href={returnTo} label="Back" /><div><p className="text-xs font-bold uppercase tracking-wider text-coral">Delivery time</p><h1 className="text-2xl font-black">When should we deliver?</h1></div></header>
    <p className="mt-5 leading-6 text-stone-600">Order ahead and we&apos;ll time your meal around your campus day.{lines.length > 0 && " This applies to everything in your cart."}</p>

    <button role="radio" aria-checked={choice?.type === "ASAP"} disabled={!publicSettings.asapEnabled} onClick={() => setChoice({ type: "ASAP" })} className={`mt-6 flex min-h-16 w-full items-center justify-between rounded-app border-2 p-5 text-left disabled:bg-stone-100 disabled:opacity-60 ${choice?.type === "ASAP" ? "border-coral bg-white shadow-lift" : "border-transparent bg-white"}`}>
      <div><h2 className="font-black">⚡ As soon as possible</h2><p className="mt-1 text-sm font-bold text-stone-500">{publicSettings.asapEnabled ? `About ${publicSettings.asapWindow}` : "ASAP is paused right now"}</p></div>
      <Radio on={choice?.type === "ASAP"} />
    </button>

    <h2 className="mt-8 font-black">Or preorder a window</h2>
    <div role="radiogroup" aria-label="Day" className="mt-3 grid grid-cols-2 rounded-2xl bg-white p-1.5">
      {DAYS.map((entry) => <button key={entry} role="radio" aria-checked={day === entry} onClick={() => setDay(entry)} className={`min-h-11 rounded-xl text-sm font-black ${day === entry ? "bg-ink text-white shadow-lift" : "text-stone-600"}`}>{entry}</button>)}
    </div>

    <div role="radiogroup" aria-label={`${day} delivery windows`} className="mt-4 space-y-3">
      {!now ? <><Skeleton className="h-20" /><Skeleton className="h-20" /></>
        : slots.length === 0 ? <div className="rounded-app bg-white p-5 text-center"><p className="font-black">No more windows {day.toLowerCase()}</p><p className="mt-1 text-sm text-stone-600">Orders close {ORDER_CUTOFF_MINUTES} minutes before each window.{day === "Today" && " Try tomorrow."}</p>{day === "Today" && <button onClick={() => setDay("Tomorrow")} className="mt-3 min-h-11 rounded-xl bg-cream px-4 font-black">See tomorrow</button>}</div>
        : slots.map((slot) => {
          const state = slotState(slot, now); const on = choice?.type === "PREORDER" && choice.slotId === slot.id;
          return <button key={slot.id} role="radio" aria-checked={on} aria-disabled={state !== "open"} disabled={state !== "open"} onClick={() => setChoice({ type: "PREORDER", slotId: slot.id })} className={`flex w-full items-center justify-between rounded-app border-2 p-5 text-left transition ${state !== "open" ? "border-transparent bg-stone-100 opacity-60" : on ? "border-coral bg-white shadow-lift" : "border-transparent bg-white"}`}>
            <div><h3 className="font-black">{slotWindow(slot)}</h3>
              <p className={`mt-1 text-sm font-bold ${state !== "open" ? "text-stone-600" : slot.availableCapacity <= 5 ? "text-[#b3321f]" : "text-leaf"}`}>{state === "open" ? `${slot.availableCapacity} spot${slot.availableCapacity === 1 ? "" : "s"} left · order by ${slotCutoff(slot)}` : "Fully booked"}</p></div>
            <Radio on={on} />
          </button>;
        })}
    </div>

    <aside className="mt-7 rounded-app bg-mango/20 p-5"><p className="font-black">How spots work</p><p className="mt-1 text-sm leading-5 text-stone-700">Each window has limited kitchen and rider capacity. Your spot is only held once your payment goes through, so popular windows can fill while you check out.</p></aside>

    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] border-t border-stone-100 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <button disabled={!choice} onClick={confirm} className="flex min-h-14 w-full items-center justify-between rounded-2xl bg-coral px-5 font-black text-white shadow-float disabled:bg-stone-300 disabled:text-stone-600 disabled:shadow-none">
        <span>{!choice ? "Choose a delivery time" : choice.type === "ASAP" ? "Deliver ASAP" : `Deliver ${selectedSlot ? slotLabel(selectedSlot) : ""}`}</span><ChevronRight size={20} aria-hidden />
      </button>
    </div>
  </div>;
}

function Radio({ on }: { on: boolean }) { return <span aria-hidden className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${on ? "border-coral bg-coral text-white" : "border-stone-300"}`}>{on && <Check size={15} />}</span>; }
