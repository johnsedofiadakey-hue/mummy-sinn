"use client";
import Link from "next/link";
import { AlertTriangle, CalendarDays, Rocket } from "lucide-react";
import { fulfilmentProblem, useCart } from "@/components/cart-provider";
import { publicSettings } from "@/lib/mock-data";
import { useNow } from "@/lib/use-online";

/** Cart-level "when" line with a Change link and any problem with the chosen time. */
export function FulfilmentSummary({ returnTo }: { returnTo: string }) {
  const { fulfilment } = useCart(); const now = useNow();
  const problem = now ? fulfilmentProblem(fulfilment, now) : null;
  const timingIcon = fulfilment.type === "ASAP" ? <Rocket size={16} className="text-coral"/> : <CalendarDays size={16} className="text-coral"/>;
  const text = fulfilment.type === "ASAP" ? `ASAP · about ${publicSettings.asapWindow}` : fulfilment.label;
  return <div className={`rounded-[18px] p-3.5 ${problem ? "bg-coral/10" : "bg-white shadow-sm"}`}>
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0"><p className="text-xs font-extrabold uppercase tracking-wider text-stone-500">Delivery time</p><p className="mt-0.5 flex items-center gap-1.5 font-black text-ink">{timingIcon}{text}</p></div>
      <Link href={`/preorder?return=${encodeURIComponent(returnTo)}`} className="grid min-h-10 shrink-0 place-items-center rounded-lg bg-[#f7f4f2] px-3 text-xs font-black text-coral">Edit</Link>
    </div>
    {problem && <p role="alert" className="mt-3 flex gap-2 text-sm font-bold text-[#b3321f]"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />{problem}</p>}
  </div>;
}
