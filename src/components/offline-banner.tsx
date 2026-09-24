"use client";
import { WifiOff } from "lucide-react";
import { useOnline } from "@/lib/use-online";

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return <div role="status" className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-ink px-4 py-2 pt-[max(.5rem,env(safe-area-inset-top))] text-xs font-bold text-white">
    <WifiOff size={14} aria-hidden /> You&apos;re offline. Your cart is saved on this phone.
  </div>;
}
