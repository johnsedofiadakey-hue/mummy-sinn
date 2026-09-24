"use client";
import { useState } from "react";
import { LogOut } from "lucide-react";

export function SignOutButton({ className = "" }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  return <button type="button" disabled={busy} onClick={async () => {
    setBusy(true);
    await fetch("/api/admin/session", { method: "DELETE", credentials: "same-origin" }).catch(() => undefined);
    window.location.assign("/admin/sign-in");
  }} className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-stone-700 hover:bg-stone-100 disabled:opacity-60 ${className}`}>
    <LogOut size={16} aria-hidden /> {busy ? "Signing out…" : "Sign out"}
  </button>;
}
