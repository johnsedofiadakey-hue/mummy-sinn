import Link from "next/link";
import Image from "next/image";
import { Sparkles } from "lucide-react";
import type { HomepagePromotion } from "@/lib/public-content";

/** The admin-managed homepage promotion, in the same banner style as the built-in "Campus Lunch Deal". */
export function PromotionBanner({ promo }: { promo: HomepagePromotion }) {
  return <Link href={promo.href} className="relative mx-4 mt-3 block h-[135px] overflow-hidden rounded-[19px] bg-[#ffc42e] p-3.5 shadow-sm">
    <div className="relative z-10 max-w-[150px]">
      <p className="brand-wordmark text-[1.6rem] leading-[.85] text-[#a12e19]">{promo.title}</p>
      {promo.subtitle && <p className="mt-2 line-clamp-2 text-[12px] font-black leading-[14px] text-[#732b1c]">{promo.subtitle}</p>}
      {promo.priceLabel && <span className="mt-2 inline-block rounded-full bg-coral px-3 py-1 text-[15px] font-black text-white">{promo.priceLabel}</span>}
    </div>
    {promo.imageUrl && <div className="absolute -bottom-11 right-0 h-[170px] w-[205px] overflow-hidden rounded-full border-4 border-white/50 shadow-lg"><Image src={promo.imageUrl} alt="" fill priority sizes="205px" className="object-cover" /></div>}
    <Sparkles size={20} className="absolute right-3 top-3 text-[#a12e19]" aria-hidden />
  </Link>;
}
