import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Clock3, FlaskConical, Plus } from "lucide-react";
import type { MenuItem } from "@/types/domain";
import { money } from "@/lib/mock-data";

export function SectionHeading({ eyebrow, title, href }: { eyebrow?: string; title: string; href?: string }) {
  return <div className="mb-3 flex items-end justify-between gap-2 px-4"><div className="min-w-0">{eyebrow && <p className="mb-1 text-xs font-extrabold uppercase tracking-[.16em] text-coral">{eyebrow}</p>}<h2 className="text-[1.02rem] font-black tracking-tight text-ink">{title}</h2></div>{href && <Link className="-my-3 shrink-0 py-3 text-[11px] font-bold text-coral" href={href}>See all ›</Link>}</div>;
}

export function FoodCard({ item, compact = false }: { item: MenuItem; compact?: boolean }) {
  const soldOut = !item.isAvailable;
  return <Link href={`/menu/${item.slug}`} aria-label={`${item.name}, ${money(item.price)}${soldOut ? ", sold out" : ""}`} className={`group relative block overflow-hidden rounded-[17px] bg-white shadow-lift transition duration-200 active:scale-[.98] ${compact ? "w-[144px] shrink-0" : "w-full"}`}>
    <div className={`relative overflow-hidden ${compact ? "h-[112px]" : "h-44"}`}>
      <Image src={item.imageUrl} alt="" fill sizes="(max-width: 640px) 55vw, 240px" className={`object-cover transition duration-500 group-hover:scale-105 ${soldOut ? "grayscale" : ""}`} />
      {soldOut ? <span className="absolute left-2 top-2 rounded-full bg-ink px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white">Sold out</span>
        : item.badge && <span className="absolute left-2 top-2 rounded-full bg-coral px-2 py-1 text-[10px] font-black text-white">{item.badge}</span>}
      <span aria-hidden className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-ink shadow-sm">♡</span>
    </div>
    <div className="p-2.5">
      <h3 className="min-h-9 text-[.77rem] font-extrabold leading-[1.1rem] text-ink">{item.name}</h3>
      <div className="mt-1 flex items-center justify-between"><span className={`text-sm font-black ${soldOut ? "text-stone-500" : "text-coral"}`}>{money(item.price).replace(".00", "")}</span><span aria-hidden className={`grid h-7 w-7 place-items-center rounded-full text-white ${soldOut ? "bg-stone-300" : "bg-coral"}`}><Plus size={16} strokeWidth={3} /></span></div>
      {!compact && <p className="mt-2 flex items-center gap-1 text-xs font-bold text-stone-500"><Clock3 size={13} aria-hidden />{item.prepMinutes} min prep</p>}
    </div>
  </Link>;
}

export function Pill({ children, active = false }: { children: React.ReactNode; active?: boolean }) { return <span className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-sm font-extrabold ${active ? "bg-ink text-white" : "bg-white text-ink shadow-sm"}`}>{children}</span>; }

export function BackLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} aria-label={label} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white shadow-sm"><ChevronLeft size={20} aria-hidden /></Link>;
}

export function DemoNotice({ children }: { children: React.ReactNode }) {
  return <div role="note" className="flex gap-3 rounded-2xl border border-dashed border-mango bg-mango/15 p-3.5 text-sm text-ink"><FlaskConical size={18} className="mt-0.5 shrink-0 text-ink" aria-hidden /><div>{children}</div></div>;
}

export function Toast({ message, actionLabel, onAction, bottom = "bottom-[6.5rem]" }: { message: string; actionLabel?: string; onAction?: () => void; bottom?: string }) {
  return <div role="status" className={`fixed inset-x-5 ${bottom} z-50 mx-auto flex max-w-[440px] animate-float-in items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-2 text-sm font-bold text-white shadow-float`}>
    <span className="py-1.5">{message}</span>
    {actionLabel && onAction && <button onClick={onAction} className="min-h-11 shrink-0 px-2 font-black text-mango">{actionLabel}</button>}
  </div>;
}

export function Skeleton({ className = "" }: { className?: string }) { return <div aria-hidden className={`animate-pulse-soft rounded-app bg-stone-200/70 ${className}`} />; }
