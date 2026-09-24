"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { BackLink, FoodCard, Pill } from "@/components/ui";
import { categories, menuItems } from "@/lib/mock-data";

// Filtering runs on the phone: the menu is small, and a network round-trip per tap is slow on campus Wi-Fi.
export function MenuBrowser({ initialCategory, focusSearch }: { initialCategory?: string; focusSearch?: boolean }) {
  const [active, setActive] = useState(categories.some((c) => c.id === initialCategory) ? initialCategory : undefined);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (focusSearch) input.current?.focus(); }, [focusSearch]);
  useEffect(() => {
    window.history.replaceState(null, "", active ? `/menu?category=${active}` : "/menu");
    document.querySelector<HTMLElement>('[data-category][aria-pressed="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return menuItems
      .filter((item) => !active || item.categoryId === active)
      .filter((item) => !q || [item.name, item.description, ...(item.tags ?? []), categories.find((c) => c.id === item.categoryId)?.name ?? ""].join(" ").toLowerCase().includes(q))
      .sort((a, b) => Number(b.isAvailable) - Number(a.isAvailable));
  }, [active, query]);
  const activeName = categories.find((c) => c.id === active)?.name;

  return <div className="min-h-screen pb-24">
    <header className="sticky top-0 z-20 bg-[#fffdf9]/95 px-5 pb-3 pt-[max(1.25rem,env(safe-area-inset-top))] backdrop-blur">
      <div className="relative flex min-h-11 items-center justify-center"><span className="absolute left-0"><BackLink href="/" label="Back to home" /></span><h1 className="text-xl font-black">Menu</h1></div>
      <label className="mt-3 flex min-h-11 items-center gap-3 rounded-xl border border-stone-100 bg-[#f7f7f7] px-4 text-sm font-semibold focus-within:ring-2 focus-within:ring-coral">
        <Search size={19} className="shrink-0 text-stone-500" aria-hidden />
        <span className="sr-only">Search the menu</span>
        <input ref={input} type="search" enterKeyHint="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search jollof, noodles, drinks…" className="min-w-0 flex-1 bg-transparent py-3 text-ink outline-none placeholder:text-stone-500" />
        {query && <button onClick={() => { setQuery(""); input.current?.focus(); }} aria-label="Clear search" className="-mr-2 grid h-11 w-11 place-items-center text-stone-500"><X size={18} aria-hidden /></button>}
      </label>
      <div role="group" aria-label="Categories" className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 hide-scrollbar">
        <button data-category onClick={() => setActive(undefined)} aria-pressed={!active}><Pill active={!active}>All</Pill></button>
        {categories.map((category) => <button key={category.id} data-category onClick={() => setActive(category.id)} aria-pressed={active === category.id}><Pill active={active === category.id}><span aria-hidden className="mr-1">{category.emoji}</span>{category.name}</Pill></button>)}
      </div>
    </header>
    <p className="sr-only" role="status">{visible.length} dishes shown</p>
    {visible.length ? <div className="grid grid-cols-2 gap-3 px-5 pt-3">{visible.map((item) => <FoodCard key={item.id} item={item} />)}</div>
      : <div className="grid min-h-[45vh] place-items-center px-8 text-center"><div>
          <span aria-hidden className="text-5xl">🔍</span>
          <h2 className="mt-4 text-lg font-black">{query ? `No results for “${query.trim()}”` : `Nothing in ${activeName ?? "this category"} right now`}</h2>
          <p className="mt-1 text-sm text-stone-600">{query ? "Try a different word, like rice or chicken." : "Check back later, or try another category."}</p>
          <button onClick={() => { setQuery(""); setActive(undefined); }} className="mt-4 min-h-11 rounded-xl bg-coral px-5 font-black text-white">Show all food</button>
        </div></div>}
  </div>;
}
