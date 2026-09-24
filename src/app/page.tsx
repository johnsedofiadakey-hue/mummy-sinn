import Link from "next/link";
import Image from "next/image";
import { Search } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { CartDock, HomeHeader, TimingChips } from "@/components/home-client";
import { FoodCard, SectionHeading } from "@/components/ui";
import { categories, menuItems } from "@/lib/mock-data";

const categoryImages = ["/images/food/jollof-chicken-v1.png", "/images/food/waakye-v1.png", "/images/food/local-pork-v1.png", "/images/food/check-check-v1.png", "/images/food/attieke-fish-v1.png"];

export default function Home() { const popular = menuItems.filter((item) => item.isAvailable).slice(0, 5); const quick = menuItems.filter((item) => item.isAvailable && item.price <= 30).slice(0, 3); const feature = popular[0]; return <><div className="pb-28"><HomeHeader/>
  <h2 className="px-5 pt-2 text-[1.35rem] font-black tracking-tight text-ink">What are you eating today? <span aria-hidden>😋</span></h2>
  <Link href="/menu?search=1" className="mx-5 mt-3 flex min-h-11 items-center gap-3 rounded-xl border border-stone-100 bg-[#f7f7f7] px-4 text-[13px] font-medium text-stone-500"><Search size={19} aria-hidden/> Search meals, drinks, combos...</Link>
  <TimingChips/>
  {feature && <Link href={`/menu/${feature.slug}`} className="relative mx-5 mt-4 block min-h-[135px] overflow-hidden rounded-[20px] bg-[#ffc12f] p-4 shadow-sm"><div className="relative z-10 max-w-[165px]"><p className="brand-wordmark text-[1.4rem] leading-none text-[#a82715]">Campus Lunch Deal</p><p className="mt-1 text-[13px] font-black text-[#6d2417]">Jollof + Chicken + Drink</p><span className="mt-3 inline-block rounded-full bg-coral px-3 py-1.5 text-lg font-black text-white">GHS 35</span></div><div className="absolute -bottom-12 right-1 h-[180px] w-[210px] overflow-hidden rounded-full border-4 border-white/45 shadow-lg"><Image src={feature.imageUrl} alt="Jollof and grilled chicken" fill priority sizes="210px" className="object-cover"/></div><span className="absolute right-3 top-3 text-2xl" aria-hidden>🥤</span></Link>}
  <section className="mt-4"><div className="flex gap-3 overflow-x-auto px-5 pb-2 hide-scrollbar">{categories.map((category, index) => <Link href={`/menu?category=${category.id}`} key={category.id} className="grid min-w-[61px] place-items-center gap-1.5 text-center transition active:scale-95"><span className="relative h-[58px] w-[58px] overflow-hidden rounded-[15px] border-2 border-white shadow-sm"><Image src={categoryImages[index]} alt="" fill sizes="58px" className="object-cover"/></span><span className="text-[10px] font-extrabold leading-3 text-ink">{category.name}</span></Link>)}</div></section>
  <section className="mt-6 page-enter"><SectionHeading title="Popular right now 🔥" href="/menu"/><div className="flex gap-3 overflow-x-auto px-5 pb-2 hide-scrollbar">{popular.map((item) => <FoodCard key={item.id} item={item} compact/>)}</div></section>
  {quick.length > 0 && <section className="mt-7"><SectionHeading title="Quick meals under GHS 30" href="/menu"/><div className="flex gap-3 overflow-x-auto px-5 pb-2 hide-scrollbar">{quick.map((item) => <FoodCard key={item.id} item={item} compact/>)}</div></section>}
 </div><CartDock/><BottomNav/></>; }
