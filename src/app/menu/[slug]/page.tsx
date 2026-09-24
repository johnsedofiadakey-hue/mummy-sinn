import { notFound } from "next/navigation";
import Image from "next/image";
import { Heart } from "lucide-react";
import { ProductConfigurator } from "@/components/product-configurator";
import { getPublicCatalog } from "@/lib/public-content";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const { menuItems } = await getPublicCatalog(); const item = menuItems.find((entry) => entry.slug === slug); if (!item) notFound(); return <div className="relative min-h-screen bg-cream"><div className="relative h-[300px]"><Image src={item.imageUrl} alt={item.name} fill priority sizes="480px" className={`object-cover ${item.isAvailable ? "" : "grayscale"}`}/><button aria-label={`Save ${item.name}`} className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] grid h-10 w-10 place-items-center rounded-full bg-white/95 text-coral shadow-sm"><Heart size={20}/></button><span aria-hidden className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5"><i className="h-2 w-2 rounded-full bg-white"/><i className="h-2 w-2 rounded-full bg-white/55"/></span></div><ProductConfigurator item={item}/></div>; }
