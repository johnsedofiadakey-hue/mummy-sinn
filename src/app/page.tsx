import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Clock3, Search, Sparkles, Timer } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { HomeHeader, TimingChips } from "@/components/home-client";
import { FoodCard, SectionHeading } from "@/components/ui";
import { categories, menuItems, money } from "@/lib/mock-data";

const categoryThemes = ["bg-[#fff0df]", "bg-[#eff7e9]", "bg-[#fff0ee]", "bg-[#f4efff]", "bg-[#eaf8f7]"];

export default function Home() { const popular = menuItems.filter((item) => item.isAvailable).slice(0, 4); const quick = menuItems.filter((item) => item.isAvailable && item.price < 30).slice(0, 2); const feature = popular[0]; return <><div className="pb-28"><HomeHeader/>
  <section className="hero-orb hero-sheen relative mx-5 min-h-[274px] overflow-hidden rounded-[2rem] px-6 py-6 text-white shadow-float">
    <span aria-hidden className="hero-spark hero-spark-one"/><span aria-hidden className="hero-spark hero-spark-two"/>
    <div className="relative z-10 max-w-[210px]"><span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/15 px-3 py-1 text-xs font-extrabold backdrop-blur"><Sparkles size={13} aria-hidden/> Freshly made on campus</span><h2 className="mt-4 text-[2.05rem] font-black leading-[.98] tracking-tight">Your next good meal is close.</h2><p className="mt-3 text-sm font-medium leading-5 text-white/90">Cooked to order. Sent right to your hall.</p><Link href="/menu" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-ink shadow-lift">Order now <ArrowRight size={16} aria-hidden/></Link></div>
    {feature && <div className="hero-food absolute -bottom-6 -right-9 h-[230px] w-[230px] overflow-hidden rounded-full border-[9px] border-white/20 shadow-2xl"><Image src={feature.imageUrl} alt="" fill priority sizes="230px" className="object-cover"/></div>}
    <div className="absolute bottom-5 right-5 z-10 flex items-center gap-1.5 rounded-full bg-ink/70 px-3 py-1.5 text-[11px] font-black text-white backdrop-blur"><Timer size={13} aria-hidden/> 25–35 min</div>
  </section>
  <TimingChips/>
  <Link href="/menu?search=1" className="mx-5 mt-5 flex min-h-12 items-center gap-3 rounded-2xl bg-white px-4 text-sm font-semibold text-stone-500 shadow-lift"><Search size={20} aria-hidden/> What are you eating today?</Link>
  <section className="mt-8 page-enter"><SectionHeading title="Pick your craving"/><div className="flex gap-3 overflow-x-auto px-5 pb-2 hide-scrollbar">{categories.map((category, index) => <Link href={`/menu?category=${category.id}`} key={category.id} className={`grid min-h-[104px] min-w-[84px] place-items-center gap-2 rounded-2xl px-3 py-4 shadow-sm transition duration-200 active:scale-95 ${categoryThemes[index % categoryThemes.length]}`}><span aria-hidden className="grid h-11 w-11 place-items-center rounded-2xl bg-white/70 text-2xl shadow-sm">{category.emoji}</span><span className="text-xs font-extrabold">{category.name}</span></Link>)}</div></section>
  <section className="mt-9 page-enter page-enter-delay"><SectionHeading eyebrow="Popular right now" title="The crowd favourites" href="/menu"/><div className="flex gap-4 overflow-x-auto px-5 pb-2 hide-scrollbar">{popular.map((item) => <FoodCard key={item.id} item={item} compact/>)}</div></section>
  {quick.length > 0 && <section className="mt-9"><SectionHeading title="Quick meals under GHS 30"/><div className="space-y-3 px-5">{quick.map((item) => <Link key={item.id} href={`/menu/${item.slug}`} className="flex items-center gap-4 rounded-app bg-white p-3 shadow-lift"><div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl"><Image src={item.imageUrl} alt="" fill sizes="80px" className="object-cover"/></div><div className="min-w-0 flex-1"><h3 className="font-black">{item.name}</h3><p className="mt-1 line-clamp-2 text-xs text-stone-500">{item.description}</p><span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-stone-500"><Clock3 size={13} aria-hidden/>{item.prepMinutes} min prep</span></div><b className="shrink-0 text-coral">{money(item.price)}</b></Link>)}</div></section>}
 </div><BottomNav/></>; }
