"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronRight, Rocket } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { BackLink, Skeleton } from "@/components/ui";
import { preorderSlots, publicSettings } from "@/lib/mock-data";
import { localDay, ORDER_CUTOFF_MINUTES, slotLabel, slotState, slotWindow } from "@/lib/slots";
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
    <header className="relative flex min-h-11 items-center justify-center"><span className="absolute left-0"><BackLink href={returnTo} label="Back" /></span><div className="text-center"><h1 className="text-xl font-black">Delivery time</h1><p className="text-[10px] font-semibold text-stone-500">Choose when we bring your food</p></div></header>
    <p className="mt-5 text-sm leading-5 text-stone-600">Order ahead and we&apos;ll time your meal around your campus day.{lines.length > 0 && " This applies to your whole cart."}</p>

    <button role="radio" aria-checked={choice?.type === "ASAP"} disabled={!publicSettings.asapEnabled} onClick={() => setChoice({ type: "ASAP" })} className={`mt-5 flex min-h-16 w-full items-center justify-between rounded-[18px] border-2 p-4 text-left disabled:bg-stone-100 disabled:opacity-60 ${choice?.type === "ASAP" ? "border-coral bg-[#fff8f5] shadow-sm" : "border-stone-100 bg-white"}`}>
      <div><h2 className="flex items-center gap-2 font-black"><Rocket size={18} className="text-coral"/> Deliver ASAP</h2><p className="mt-1 text-xs font-bold text-stone-500">{publicSettings.asapEnabled ? `35–45 minutes from now` : "ASAP is paused right now"}</p></div>
      <Radio on={choice?.type === "ASAP"} />
    </button>

    <h2 className="mt-7 font-black">Preorder a delivery window</h2>
    <div role="radiogroup" aria-label="Day" className="mt-3 grid grid-cols-2 rounded-xl bg-[#f4f1ef] p-1">
      {DAYS.map((entry) => <button key={entry} role="radio" aria-checked={day === entry} onClick={() => setDay(entry)} className={`min-h-10 rounded-lg text-sm font-black ${day === entry ? "bg-white text-ink shadow-sm" : "text-stone-500"}`}>{entry}</button>)}
    </div>

    <div role="radiogroup" aria-label={`${day} delivery windows`} className="mt-4 grid grid-cols-2 gap-2.5">
      {!now ? <><Skeleton className="h-20" /><Skeleton className="h-20" /></>
        : slots.length === 0 ? <div className="col-span-2 rounded-app bg-white p-5 text-center"><p className="font-black">No more windows {day.toLowerCase()}</p><p className="mt-1 text-sm text-stone-600">Orders close {ORDER_CUTOFF_MINUTES} minutes before each window.{day === "Today" && " Try tomorrow."}</p>{day === "Today" && <button onClick={() => setDay("Tomorrow")} className="mt-3 min-h-11 rounded-xl bg-cream px-4 font-black">See tomorrow</button>}</div>
        : slots.map((slot) => {
          const state = slotState(slot, now); const on = choice?.type === "PREORDER" && choice.slotId === slot.id;
          return <button key={slot.id} role="radio" aria-checked={on} aria-disabled={state !== "open"} disabled={state !== "open"} onClick={() => setChoice({ type: "PREORDER", slotId: slot.id })} className={`relative min-h-[86px] rounded-xl border-2 p-3 text-left transition ${state !== "open" ? "border-transparent bg-stone-100 opacity-60" : on ? "border-coral bg-[#fff8f5] shadow-sm" : "border-stone-100 bg-white"}`}>
            <div><h3 className="text-sm font-black">{slotWindow(slot)}</h3>
              <p className={`mt-1 text-[11px] font-bold ${state !== "open" ? "text-stone-600" : slot.availableCapacity <= 5 ? "text-[#b3321f]" : "text-leaf"}`}>{state === "open" ? `${slot.availableCapacity} spots left` : "Fully booked"}</p></div>
            <span className="absolute right-2 top-2"><Radio on={on} /></span>
          </button>;
        })}
    </div>

    <aside className="mt-5 rounded-[18px] bg-[#fff2e7] p-4"><p className="font-black">Kitchen capacity</p><p className="mt-1 text-xs leading-5 text-stone-700">Spots are held only once payment succeeds, so popular windows can fill while you check out.</p></aside>

    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] border-t border-stone-100 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <button disabled={!choice} onClick={confirm} className="flex min-h-14 w-full items-center justify-between rounded-2xl bg-coral px-5 font-black text-white shadow-float disabled:bg-stone-300 disabled:text-stone-600 disabled:shadow-none">
        <span>{!choice ? "Choose a delivery time" : choice.type === "ASAP" ? "Deliver ASAP" : `Deliver ${selectedSlot ? slotLabel(selectedSlot) : ""}`}</span><ChevronRight size={20} aria-hidden />
      </button>
    </div>
  </div>;
}

function Radio({ on }: { on: boolean }) { return <span aria-hidden className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${on ? "border-coral bg-coral text-white" : "border-stone-300"}`}>{on && <Check size={15} />}</span>; }
