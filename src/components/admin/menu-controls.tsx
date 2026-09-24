"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { adminFetch } from "@/components/admin/api";
import { SecondaryButton } from "@/components/admin/fields";

export function AvailabilityToggle({ id, name, isAvailable, disabled }: { id: string; name: string; isAvailable: boolean; disabled?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(isAvailable); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const toggle = async () => {
    const next = !value; setBusy(true); setError(null); setValue(next);
    const result = await adminFetch(`/api/admin/menu-items/${id}`, { method: "PATCH", body: { action: "setAvailability", isAvailable: next } });
    setBusy(false);
    if (!result.ok) { setValue(!next); setError(result.message); return; }
    router.refresh();
  };
  return <div className="flex flex-col items-end">
    <button type="button" role="switch" aria-checked={value} aria-label={`${name} available`} disabled={disabled || busy} onClick={toggle} className={`relative h-7 w-12 rounded-full transition disabled:opacity-50 ${value ? "bg-leaf" : "bg-stone-300"}`}>
      <span aria-hidden className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${value ? "left-[1.375rem]" : "left-0.5"}`} />
    </button>
    {error && <p role="alert" className="mt-1 max-w-40 text-right text-[11px] font-bold text-[#b3321f]">{error}</p>}
  </div>;
}

export function ArchiveButton({ id, isArchived }: { id: string; isArchived: boolean }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const run = async () => {
    if (!isArchived && !window.confirm("Archive this dish? It disappears from the student menu. You can restore it later.")) return;
    setBusy(true); setError(null);
    const result = await adminFetch(`/api/admin/menu-items/${id}`, { method: "PATCH", body: { action: isArchived ? "restore" : "archive" } });
    setBusy(false);
    if (!result.ok) { setError(result.message); return; }
    router.refresh();
  };
  return <div>
    <SecondaryButton type="button" onClick={run} disabled={busy}>{isArchived ? <><ArchiveRestore size={16} aria-hidden /> Restore dish</> : <><Archive size={16} aria-hidden /> Archive dish</>}</SecondaryButton>
    {error && <p role="alert" className="mt-2 text-xs font-bold text-[#b3321f]">{error}</p>}
  </div>;
}
