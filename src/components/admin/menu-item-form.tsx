"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "@/components/admin/api";
import { FormMessage, PrimaryButton, SelectField, Switch, TextArea, TextField } from "@/components/admin/fields";
import { slugify } from "@/lib/admin/validation";

export type MenuFormValues = { name: string; slug: string; description: string; categoryId: string; price: string; prepMinutes: string; isAvailable: boolean; badge: string; imageUrl: string; modifierGroupIds: string[] };
type Option = { id: string; name: string; detail?: string };

export function MenuItemForm({ itemId, initial, categories, modifierGroups, canWrite }: { itemId?: string; initial: MenuFormValues; categories: Option[]; modifierGroups: Option[]; canWrite: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [slugEdited, setSlugEdited] = useState(Boolean(itemId));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof MenuFormValues>(key: K, value: MenuFormValues[K]) => { setValues((v) => ({ ...v, [key]: value, ...(key === "name" && !slugEdited ? { slug: slugify(String(value)) } : {}) })); setErrors((e) => ({ ...e, [key]: "" })); };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy || !canWrite) return;
    setBusy(true); setMessage(null);
    const item = { ...values, prepMinutes: values.prepMinutes };
    const result = itemId
      ? await adminFetch(`/api/admin/menu-items/${itemId}`, { method: "PATCH", body: { action: "update", item } })
      : await adminFetch<{ id: string }>("/api/admin/menu-items", { method: "POST", body: item });
    setBusy(false);
    if (!result.ok) { setErrors(result.fieldErrors); setMessage({ tone: "error", text: result.message }); document.getElementById(Object.keys(result.fieldErrors)[0] ?? "")?.focus(); return; }
    if (!itemId) { router.push(`/admin/menu/${(result.data as { id: string }).id}?created=1`); return; }
    setMessage({ tone: "success", text: "Saved. Students will see the change within a minute." }); router.refresh();
  };

  return <form onSubmit={submit} noValidate className="space-y-5">
    {message && <FormMessage tone={message.tone}>{message.text}</FormMessage>}
    <fieldset disabled={!canWrite} className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <TextField id="name" label="Dish name" value={values.name} onChange={(v) => set("name", v)} error={errors.name} maxLength={80} required />
        <TextField id="slug" label="Web address (slug)" hint={`Appears as /menu/${values.slug || "…"}`} value={values.slug} onChange={(v) => { setSlugEdited(true); set("slug", v.toLowerCase()); }} error={errors.slug} maxLength={80} />
      </div>
      <TextArea id="description" label="Description" value={values.description} onChange={(v) => set("description", v)} error={errors.description} maxLength={300} />
      <div className="grid gap-5 md:grid-cols-3">
        <SelectField id="categoryId" label="Category" value={values.categoryId} onChange={(v) => set("categoryId", v)} error={errors.categoryId}>
          <option value="">Choose…</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.detail ? ` ${c.detail}` : ""}</option>)}
        </SelectField>
        <TextField id="price" label="Price (GHS)" inputMode="decimal" placeholder="35.00" value={values.price} onChange={(v) => set("price", v)} error={errors.price} hint="Saved exactly in pesewas." />
        <TextField id="prepMinutes" label="Prep time (minutes)" inputMode="numeric" value={values.prepMinutes} onChange={(v) => set("prepMinutes", v.replace(/\D/g, ""))} error={errors.prepMinutes} />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <TextField id="badge" label="Badge (optional)" placeholder="Bestseller" value={values.badge} onChange={(v) => set("badge", v)} error={errors.badge} maxLength={24} />
        <TextField id="imageUrl" label="Image URL (optional)" hint={itemId ? "Or upload a photo below." : "You can upload a photo after saving."} value={values.imageUrl} onChange={(v) => set("imageUrl", v)} error={errors.imageUrl} />
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-bold">Option groups</legend>
        {modifierGroups.length ? <div className="grid gap-2 sm:grid-cols-2">{modifierGroups.map((g) => <label key={g.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-stone-200 bg-white px-3 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-coral" checked={values.modifierGroupIds.includes(g.id)} onChange={(e) => set("modifierGroupIds", e.target.checked ? [...values.modifierGroupIds, g.id] : values.modifierGroupIds.filter((id) => id !== g.id))} />
          <span><b>{g.name}</b>{g.detail && <span className="block text-xs text-stone-500">{g.detail}</span>}</span>
        </label>)}</div> : <p className="text-sm text-stone-600">No option groups exist yet.</p>}
        {errors.modifierGroupIds && <p className="mt-1.5 text-xs font-bold text-[#b3321f]">{errors.modifierGroupIds}</p>}
      </fieldset>
      <div className="rounded-xl border border-stone-200 bg-white p-4"><Switch id="isAvailable" label="Available to order" description="Turn off when it sells out. Students see “Sold out today”." checked={values.isAvailable} onChange={(v) => set("isAvailable", v)} /></div>
    </fieldset>
    {canWrite && <PrimaryButton type="submit" busy={busy}>{itemId ? "Save changes" : "Create dish"}</PrimaryButton>}
  </form>;
}
