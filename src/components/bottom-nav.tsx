"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, UtensilsCrossed, ReceiptText, ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart-provider";

const nav = [{ href: "/", label: "Home", icon: House }, { href: "/menu", label: "Menu", icon: UtensilsCrossed }, { href: "/orders", label: "Orders", icon: ReceiptText }, { href: "/cart", label: "Cart", icon: ShoppingBag }];
const isActive = (pathname: string, href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

export function BottomNav() {
  const pathname = usePathname(); const { count } = useCart();
  return <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-[480px] items-center justify-around border-t border-stone-100 bg-white/95 px-3 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur">
    {nav.map(({ href, label, icon: Icon }) => {
      const active = isActive(pathname, href); const badge = href === "/cart" && count > 0;
      return <Link key={href} href={href} aria-current={active ? "page" : undefined} aria-label={badge ? `Cart, ${count} item${count === 1 ? "" : "s"}` : undefined} className={`relative grid min-h-12 min-w-16 place-items-center gap-0.5 text-[11px] font-bold ${active ? "text-coral" : "text-stone-600"}`}>
        <Icon size={22} strokeWidth={active ? 2.8 : 2} aria-hidden />{label}
        {badge && <span aria-hidden className="absolute right-2.5 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 text-[10px] text-white">{count}</span>}
      </Link>;
    })}
  </nav>;
}
