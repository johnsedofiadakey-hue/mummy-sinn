"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, MapPin, Search, X } from "lucide-react";
import { deliveryLocations, money } from "@/lib/mock-data";

/** Campus-native location picker: a searchable list of halls and hostels, never a free-text address. */
export function HallPicker({ value, onChange, error }: { value: string; onChange: (id: string) => void; error?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const trigger = useRef<HTMLButtonElement>(null); const search = useRef<HTMLInputElement>(null);
  const chosen = deliveryLocations.find((location) => location.id === value);
  const visible = deliveryLocations.filter((location) => location.isActive && `${location.name} ${location.area}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => a.sortOrder - b.sortOrder);

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("keydown", onKey); document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);
  const close = () => { setOpen(false); setQuery(""); trigger.current?.focus(); };

  return <div>
    <span id="hall-label" className="mb-1.5 block text-xs font-extrabold text-stone-600">Hall / Hostel</span>
    <button id="hall" ref={trigger} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-labelledby="hall-label hall" aria-invalid={Boolean(error)} aria-describedby={error ? "hall-error" : undefined} className={`flex min-h-12 w-full items-center justify-between gap-2 rounded-xl bg-cream px-3.5 text-left text-sm font-semibold ${error ? "ring-2 ring-[#b3321f]" : ""}`}>
      <span className={`flex items-center gap-2 ${chosen ? "text-ink" : "text-stone-500"}`}><MapPin size={16} aria-hidden className="text-coral" />{chosen ? chosen.name : "Choose your hall or hostel"}</span><ChevronDown size={18} aria-hidden className="text-stone-500" />
    </button>
    {error && <p id="hall-error" className="mt-1.5 text-xs font-bold text-[#b3321f]">{error}</p>}

    {open && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40" onClick={close}>
      <div role="dialog" aria-modal="true" aria-labelledby="hall-dialog-title" onClick={(event) => event.stopPropagation()} className="flex max-h-[85dvh] w-full max-w-[480px] animate-float-in flex-col rounded-t-[2rem] bg-cream pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between px-5 pt-5"><h2 id="hall-dialog-title" className="text-lg font-black">Where are you staying?</h2><button type="button" onClick={close} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full bg-white"><X size={18} aria-hidden /></button></div>
        <label className="mx-5 mt-4 flex min-h-12 items-center gap-3 rounded-2xl bg-white px-4 focus-within:ring-2 focus-within:ring-coral">
          <Search size={18} aria-hidden className="text-stone-500" /><span className="sr-only">Search halls and hostels</span>
          <input ref={search} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search e.g. Pentagon, Volta" className="min-w-0 flex-1 bg-transparent py-3 text-sm font-semibold outline-none placeholder:text-stone-500" />
        </label>
        <ul className="mt-3 flex-1 overflow-y-auto px-5 pb-5">
          {visible.map((location) => <li key={location.id}><button type="button" onClick={() => { onChange(location.id); close(); }} className="flex min-h-14 w-full items-center justify-between gap-3 border-b border-stone-200/70 text-left">
            <span><b className="block text-ink">{location.name}</b><small className="text-stone-600">{location.area} · delivery {money(location.deliveryFee)}</small></span>
            {location.id === value && <Check size={18} className="text-coral" aria-label="Selected" />}
          </button></li>)}
          {visible.length === 0 && <li className="py-8 text-center text-sm text-stone-600">We don&apos;t deliver to “{query.trim()}” yet. Pick the nearest hall and add a landmark.</li>}
        </ul>
      </div>
    </div>}
  </div>;
}
