"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Megaphone, Settings2, UtensilsCrossed } from "lucide-react";

const ICONS = { dashboard: LayoutDashboard, menu: UtensilsCrossed, promotions: Megaphone, settings: Settings2 };
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

export function AdminNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return <nav aria-label="Admin" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
    {items.map(({ href, label, icon }) => {
      const Icon = ICONS[icon];
      const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
      return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-11 shrink-0 items-center gap-2.5 rounded-xl px-3 text-sm font-bold transition ${active ? "bg-coral/10 text-coral" : "text-stone-600 hover:bg-stone-100 hover:text-ink"}`}>
        <Icon size={18} aria-hidden /> {label}
      </Link>;
    })}
  </nav>;
}
