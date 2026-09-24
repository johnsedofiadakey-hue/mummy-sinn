"use client";
import type { ReactNode } from "react";

// Small, accessible form primitives for the admin portal.

export function FieldShell({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return <div>
    <label htmlFor={id} className="mb-1.5 block text-sm font-bold text-ink">{label}</label>
    {children}
    {hint && !error && <p id={`${id}-hint`} className="mt-1.5 text-xs text-stone-600">{hint}</p>}
    {error && <p id={`${id}-error`} className="mt-1.5 text-xs font-bold text-[#b3321f]">{error}</p>}
  </div>;
}

const inputClass = (error?: string) => `min-h-11 w-full rounded-xl border bg-white px-3.5 text-[15px] text-ink outline-none transition placeholder:text-stone-400 focus:border-coral focus:ring-2 focus:ring-coral/25 disabled:bg-stone-100 ${error ? "border-[#b3321f]" : "border-stone-200"}`;
const describedBy = (id: string, hint?: string, error?: string) => [hint && !error && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;

export function TextField({ id, label, hint, error, value, onChange, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & { id: string; label: string; hint?: string; error?: string; value: string; onChange: (v: string) => void }) {
  return <FieldShell id={id} label={label} hint={hint} error={error}><input id={id} {...props} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={describedBy(id, hint, error)} className={inputClass(error)} /></FieldShell>;
}

export function TextArea({ id, label, hint, error, value, onChange, ...props }: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & { id: string; label: string; hint?: string; error?: string; value: string; onChange: (v: string) => void }) {
  return <FieldShell id={id} label={label} hint={hint} error={error}><textarea id={id} {...props} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={describedBy(id, hint, error)} className={`${inputClass(error)} min-h-24 py-2.5`} /></FieldShell>;
}

export function SelectField({ id, label, hint, error, value, onChange, children, ...props }: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> & { id: string; label: string; hint?: string; error?: string; value: string; onChange: (v: string) => void }) {
  return <FieldShell id={id} label={label} hint={hint} error={error}><select id={id} {...props} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={describedBy(id, hint, error)} className={inputClass(error)}>{children}</select></FieldShell>;
}

export function Switch({ id, label, description, checked, onChange, disabled }: { id: string; label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <div className="flex items-start justify-between gap-4">
    <div><label htmlFor={id} className="block text-sm font-bold text-ink">{label}</label>{description && <p className="mt-0.5 text-xs text-stone-600">{description}</p>}</div>
    <button id={id} type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${checked ? "bg-leaf" : "bg-stone-300"}`}>
      <span aria-hidden className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? "left-[1.375rem]" : "left-0.5"}`} />
    </button>
  </div>;
}

export function FormMessage({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  return <p role={tone === "error" ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm font-bold ${tone === "error" ? "bg-coral/10 text-[#b3321f]" : "bg-leaf/10 text-leaf"}`}>{children}</p>;
}

export function PrimaryButton({ children, busy, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return <button {...props} disabled={props.disabled || busy} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-coral px-5 text-sm font-black text-white shadow-sm transition hover:brightness-95 disabled:bg-stone-300 disabled:text-stone-600 ${props.className ?? ""}`}>{busy ? "Saving…" : children}</button>;
}
export function SecondaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-bold text-ink transition hover:bg-stone-50 disabled:opacity-50 ${props.className ?? ""}`}>{children}</button>;
}
