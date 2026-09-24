import Link from "next/link";
import Image from "next/image";
import { CupSoda, Flame, Search, Smile } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { CartDock, HomeHeader, TimingChips } from "@/components/home-client";
import { FoodCard, SectionHeading } from "@/components/ui";
import { PromotionBanner } from "@/components/home-promotion";
import { getHomepagePromotion, getPublicCatalog, getPublicSettings } from "@/lib/public-content";

// Catalog, kitchen settings and the homepage promotion come from Firestore (sample data when not configured).
export const revalidate = 60;

const categoryImages = ["/images/food/jollof-chicken-v1.png", "/images/food/waakye-v1.png", "/images/food/local-pork-v1.png", "/images/food/check-check-v1.png", "/images/food/sobolo-v1.png"];

export default async function Home() { const [{ categories, menuItems }, settings, promo] = await Promise.all([getPublicCatalog(), getPublicSettings(), getHomepagePromotion()]); const popular = menuItems.filter((item) => item.isAvailable).slice(0, 5); const quick = menuItems.filter((item) => item.isAvailable && item.price <= 30).slice(0, 3); const feature = popular[0]; return <><div className="pb-28"><HomeHeader/>
  <h2 className="flex items-center gap-1.5 px-4 pt-1.5 text-[1.18rem] font-black tracking-[-.035em] text-ink">What are you eating today? <Smile size={20} className="text-mango" aria-hidden/></h2>
  <Link href="/menu?search=1" className="mx-4 mt-2.5 flex min-h-[43px] items-center gap-3 rounded-[15px] border border-stone-100 bg-[#f7f7f7] px-3.5 text-[12px] font-medium text-stone-500"><Search size={18} aria-hidden/> Search meals, drinks, combos...</Link>
  <TimingChips settings={settings}/>
  {promo ? <PromotionBanner promo={promo}/> : feature && <Link href={`/menu/${feature.slug}`} className="relative mx-4 mt-3 block h-[135px] overflow-hidden rounded-[19px] bg-[#ffc42e] p-3.5 shadow-sm"><div className="relative z-10 max-w-[142px]"><p className="brand-wordmark text-[1.6rem] leading-[.78] text-[#a12e19]">Campus Lunch Deal</p><p className="mt-2 text-[12px] font-black leading-3 text-[#732b1c]">Jollof + Chicken + Drink</p><span className="mt-2.5 inline-block rounded-full bg-coral px-3 py-1 text-[17px] font-black text-white">GHS 35</span></div><div className="absolute -bottom-11 right-0 h-[170px] w-[205px] overflow-hidden rounded-full border-4 border-white/50 shadow-lg"><Image src={feature.imageUrl} alt="Jollof and grilled chicken" fill priority sizes="205px" className="object-cover"/></div><CupSoda size={20} className="absolute right-3 top-3 text-[#a12e19]" aria-hidden/></Link>}
  <section className="mt-3.5"><div className="flex justify-between gap-2 overflow-x-auto px-4 pb-1 hide-scrollbar">{categories.map((category, index) => <Link href={`/menu?category=${category.id}`} key={category.id} className="grid min-w-[58px] place-items-center gap-1.5 text-center transition active:scale-95"><span className="relative h-[54px] w-[54px] overflow-hidden rounded-[13px] border-2 border-white shadow-sm"><Image src={categoryImages[index % categoryImages.length]} alt="" fill sizes="54px" className="object-cover"/></span><span className="text-[9px] font-extrabold leading-[11px] text-ink">{category.name}</span></Link>)}</div></section>
  <section className="mt-5 page-enter"><SectionHeading title="Popular right now" icon={<Flame size={18} className="text-coral" aria-hidden/>} href="/menu"/><div className="flex gap-2.5 overflow-x-auto px-4 pb-2 hide-scrollbar">{popular.map((item) => <FoodCard key={item.id} item={item} compact/>)}</div></section>
  {quick.length > 0 && <section className="mt-5"><SectionHeading title="Quick meals under GHS 30" href="/menu"/><div className="flex gap-2.5 overflow-x-auto px-4 pb-2 hide-scrollbar">{quick.map((item) => <FoodCard key={item.id} item={item} compact/>)}</div></section>}
 </div><CartDock/><BottomNav/></>; }
