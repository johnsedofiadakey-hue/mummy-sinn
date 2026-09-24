import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { AdminNav, type NavItem } from "@/components/admin/admin-nav";
import { SignOutButton } from "@/components/admin/sign-out-button";

// Any active staff member with at least one role gets the shell; each page then checks its own permission.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireAdminPage();
  const items: NavItem[] = [
    ...(can(staff, "dashboard.read") ? [{ href: "/admin", label: "Dashboard", icon: "dashboard" as const }] : []),
    ...(can(staff, "menu.read") ? [{ href: "/admin/menu", label: "Menu", icon: "menu" as const }] : []),
    ...(can(staff, "promotions.read") ? [{ href: "/admin/promotions", label: "Homepage promo", icon: "promotions" as const }] : []),
    ...(can(staff, "settings.read") ? [{ href: "/admin/settings", label: "Kitchen settings", icon: "settings" as const }] : []),
  ];
  return <div className="md:flex">
    <aside className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur md:h-dvh md:w-60 md:shrink-0 md:border-b-0 md:border-r md:px-3 md:py-5">
      <div className="mb-3 flex items-center justify-between md:mb-6 md:block md:px-2">
        <Link href="/admin" className="block"><p className="text-lg font-black text-coral">Mummy&apos;s Inn</p><p className="text-xs font-bold uppercase tracking-wider text-stone-500">Staff admin</p></Link>
        <SignOutButton className="md:hidden" />
      </div>
      <AdminNav items={items} />
      <div className="mt-6 hidden border-t border-stone-100 px-2 pt-4 md:block">
        <p className="truncate text-sm font-bold">{staff.displayName}</p><p className="text-xs text-stone-500">{staff.roleIds.join(", ")}</p>
        <SignOutButton className="-ml-3 mt-2" />
      </div>
    </aside>
    <div className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-8"><div className="mx-auto max-w-5xl">{children}</div></div>
  </div>;
}
