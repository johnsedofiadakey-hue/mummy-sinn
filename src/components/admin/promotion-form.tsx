"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "@/components/admin/api";
import { FormMessage, PrimaryButton, SecondaryButton, SelectField, Switch, TextField } from "@/components/admin/fields";

export type PromotionFormValues = { title: string; subtitle: string; priceLabel: string; targetMenuItemId: string; imageUrl: string; startsAt: number | null; endsAt: number | null; isActive: boolean; priority: string };

// <input type="datetime-local"> works in the staff member's local time; the server stores an exact instant.
const toLocalInput = (ms: number | null) => { if (ms === null) return ""; const d = new Date(ms); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : "");

export function PromotionForm({ promotionId, initial, dishes, canWrite }: { promotionId?: string; initial: PromotionFormValues; dishes: { id: string; name: string }[]; canWrite: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState({ ...initial, startsAt: toLocalInput(initial.startsAt ?? Date.now()), endsAt: toLocalInput(initial.endsAt) });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => { setValues((v) => ({ ...v, [key]: value })); setErrors((e) => ({ ...e, [key]: "" })); };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy || !canWrite) return;
    setBusy(true); setMessage(null);
    const promotion = { ...values, startsAt: fromLocalInput(values.startsAt), endsAt: fromLocalInput(values.endsAt) };
    const result = promotionId
      ? await adminFetch(`/api/admin/promotions/${promotionId}`, { method: "PATCH", body: { action: "update", promotion } })
      : await adminFetch<{ id: string }>("/api/admin/promotions", { method: "POST", body: promotion });
    setBusy(false);
    if (!result.ok) { setErrors(result.fieldErrors); setMessage({ tone: "error", text: result.message }); return; }
    if (!promotionId) { router.push(`/admin/promotions?edit=${(result.data as { id: string }).id}&created=1`); return; }
    setMessage({ tone: "success", text: values.isActive ? "Saved. It shows on the student Home page within a minute (inside its date window)." : "Saved as paused." }); router.refresh();
  };

  return <form onSubmit={submit} noValidate className="space-y-5">
    {message && <FormMessage tone={message.tone}>{message.text}</FormMessage>}
    <fieldset disabled={!canWrite} className="space-y-5">
      <TextField id="title" label="Headline" placeholder="Jollof Friday" value={values.title} onChange={(v) => set("title", v)} error={errors.title} maxLength={60} />
      <TextField id="subtitle" label="Subtitle" placeholder="Smoky jollof with grilled chicken, all day." value={values.subtitle} onChange={(v) => set("subtitle", v)} error={errors.subtitle} maxLength={120} />
      <div className="grid gap-5 md:grid-cols-2">
        <TextField id="priceLabel" label="Price label (optional)" placeholder="From GHS 30" value={values.priceLabel} onChange={(v) => set("priceLabel", v)} error={errors.priceLabel} maxLength={24} />
        <SelectField id="targetMenuItemId" label="Links to dish" value={values.targetMenuItemId} onChange={(v) => set("targetMenuItemId", v)} error={errors.targetMenuItemId} hint="Students tap the promotion to open this dish.">
          <option value="">Whole menu</option>{dishes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </SelectField>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <TextField id="startsAt" label="Starts" type="datetime-local" value={values.startsAt} onChange={(v) => set("startsAt", v)} error={errors.startsAt} />
        <TextField id="endsAt" label="Ends (optional)" type="datetime-local" value={values.endsAt} onChange={(v) => set("endsAt", v)} error={errors.endsAt} />
        <TextField id="priority" label="Priority" inputMode="numeric" hint="Higher shows first (0–100)." value={values.priority} onChange={(v) => set("priority", v.replace(/\D/g, ""))} error={errors.priority} />
      </div>
      <TextField id="imageUrl" label="Image URL (optional)" hint={promotionId ? "Or upload an image. If empty, the linked dish's photo is used." : "You can upload an image after saving."} value={values.imageUrl} onChange={(v) => set("imageUrl", v)} error={errors.imageUrl} />
      <div className="rounded-xl border border-stone-200 bg-white p-4"><Switch id="isActive" label="Live on the Home page" description="Only one promotion can be live. Turning this on pauses any other." checked={values.isActive} onChange={(v) => set("isActive", v)} /></div>
    </fieldset>
    {canWrite && <PrimaryButton type="submit" busy={busy}>{promotionId ? "Save promotion" : "Create promotion"}</PrimaryButton>}
  </form>;
}

export function PromotionToggle({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  return <div className="flex flex-col items-end">
    <SecondaryButton type="button" disabled={busy} onClick={async () => {
      setBusy(true); setError(null);
      const result = await adminFetch(`/api/admin/promotions/${id}`, { method: "PATCH", body: { action: isActive ? "pause" : "activate" } });
      setBusy(false); if (!result.ok) { setError(result.message); return; } router.refresh();
    }}>{busy ? "…" : isActive ? "Pause" : "Make live"}</SecondaryButton>
    {error && <p role="alert" className="mt-1 text-xs font-bold text-[#b3321f]">{error}</p>}
  </div>;
}
