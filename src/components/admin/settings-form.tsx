"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "@/components/admin/api";
import { FormMessage, PrimaryButton, Switch, TextField } from "@/components/admin/fields";

export type SettingsValues = { acceptingOrders: boolean; asapEnabled: boolean; notice: string; supportPhone: string };

export function SettingsForm({ initial, canWrite }: { initial: SettingsValues; canWrite: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof SettingsValues>(key: K, value: SettingsValues[K]) => { setValues((v) => ({ ...v, [key]: value })); setErrors((e) => ({ ...e, [key]: "" })); setMessage(null); };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy || !canWrite) return;
    if (initial.acceptingOrders && !values.acceptingOrders && !window.confirm("Close the kitchen? Students won't be able to check out until you reopen it.")) return;
    setBusy(true);
    const result = await adminFetch("/api/admin/settings", { method: "PUT", body: values });
    setBusy(false);
    if (!result.ok) { setErrors(result.fieldErrors); setMessage({ tone: "error", text: result.message }); return; }
    setMessage({ tone: "success", text: "Saved. Students see the change within a minute." }); router.refresh();
  };

  return <form onSubmit={submit} noValidate className="space-y-5">
    {message && <FormMessage tone={message.tone}>{message.text}</FormMessage>}
    <fieldset disabled={!canWrite} className="space-y-5">
      <div className="space-y-5 rounded-2xl border border-stone-200 bg-white p-5">
        <Switch id="acceptingOrders" label="Kitchen is taking orders" description="Off closes checkout for everyone. Students can still browse." checked={values.acceptingOrders} onChange={(v) => set("acceptingOrders", v)} disabled={!canWrite} />
        <div className="border-t border-stone-100" />
        <Switch id="asapEnabled" label="ASAP delivery" description="Off leaves preorders open but pauses on-demand delivery." checked={values.asapEnabled} onChange={(v) => set("asapEnabled", v)} disabled={!canWrite} />
      </div>
      <div className="space-y-5 rounded-2xl border border-stone-200 bg-white p-5">
        <TextField id="notice" label="Public notice (optional)" placeholder="Back at 11:00 AM after the power cut." hint="Shown to students when the kitchen is closed." value={values.notice} onChange={(v) => set("notice", v)} error={errors.notice} maxLength={140} />
        <TextField id="supportPhone" label="Support phone (optional)" type="tel" inputMode="tel" placeholder="024 123 4567" hint="Shown on order tracking so students can call the kitchen." value={values.supportPhone} onChange={(v) => set("supportPhone", v)} error={errors.supportPhone} />
      </div>
    </fieldset>
    {canWrite ? <PrimaryButton type="submit" busy={busy}>Save settings</PrimaryButton> : <p className="text-sm text-stone-600">You can view settings but not change them.</p>}
  </form>;
}
