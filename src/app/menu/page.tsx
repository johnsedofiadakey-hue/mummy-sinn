import { BottomNav } from "@/components/bottom-nav";
import { MenuBrowser } from "@/components/menu-browser";

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ category?: string; search?: string }> }) { const { category, search } = await searchParams; return <><MenuBrowser initialCategory={category} focusSearch={search === "1"}/><BottomNav/></>; }
