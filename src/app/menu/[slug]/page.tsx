import { notFound } from "next/navigation";
import Image from "next/image";
import { ProductConfigurator } from "@/components/product-configurator";
import { menuItems } from "@/lib/mock-data";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const item = menuItems.find((entry) => entry.slug === slug); if (!item) notFound(); return <div className="relative min-h-screen bg-cream"><div className="relative h-[320px]"><Image src={item.imageUrl} alt={item.name} fill priority sizes="480px" className={`object-cover ${item.isAvailable ? "" : "grayscale"}`}/></div><ProductConfigurator item={item}/></div>; }
