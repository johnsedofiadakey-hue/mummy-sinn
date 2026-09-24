import { BottomNav } from "@/components/bottom-nav";
import { MenuBrowser } from "@/components/menu-browser";
import { getPublicCatalog } from "@/lib/public-content";

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ category?: string; search?: string }> }) { const [{ category, search }, catalog] = await Promise.all([searchParams, getPublicCatalog()]); return <><MenuBrowser initialCategory={category} focusSearch={search === "1"} categories={catalog.categories} menuItems={catalog.menuItems}/><BottomNav/></>; }
