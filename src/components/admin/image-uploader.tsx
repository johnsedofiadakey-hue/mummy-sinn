"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUp } from "lucide-react";
import { adminFetch } from "@/components/admin/api";
import { FormMessage } from "@/components/admin/fields";

const MAX_BYTES = 3 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Uploads go to the server, which checks permission, file bytes and size, stores the file and links it. */
export function ImageUploader({ purpose, targetId, currentUrl, disabled }: { purpose: "menu-item" | "promotion"; targetId: string; currentUrl: string | null; disabled?: boolean }) {
  const router = useRouter(); const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl); const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const upload = async (file: File) => {
    setMessage(null);
    // Friendly early checks only; the server re-checks everything.
    if (!TYPES.includes(file.type)) { setMessage({ tone: "error", text: "Choose a JPG, PNG or WebP image." }); return; }
    if (file.size > MAX_BYTES) { setMessage({ tone: "error", text: "Images must be 3 MB or smaller." }); return; }
    const form = new FormData(); form.append("file", file);
    setBusy(true);
    const result = await adminFetch<{ imageUrl: string }>(`/api/admin/uploads?purpose=${purpose}&targetId=${encodeURIComponent(targetId)}`, { method: "POST", form });
    setBusy(false);
    if (input.current) input.current.value = "";
    if (!result.ok) { setMessage({ tone: "error", text: result.message }); return; }
    setPreview(result.data.imageUrl); setMessage({ tone: "success", text: "Image uploaded and saved." });
    router.refresh();
  };

  return <div className="space-y-3">
    <div className="flex items-center gap-4">
      <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
        {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of a just-uploaded file */}
        {preview ? <img src={preview} alt="" className="h-full w-full object-cover" onError={() => setPreview(null)} /> : <ImageUp className="text-stone-400" aria-hidden />}
      </div>
      <div>
        <input ref={input} id={`upload-${purpose}`} type="file" accept={TYPES.join(",")} className="sr-only" disabled={disabled || busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); }} />
        <label htmlFor={`upload-${purpose}`} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-bold text-ink hover:bg-stone-50 ${disabled || busy ? "pointer-events-none opacity-50" : ""}`}>
          <ImageUp size={16} aria-hidden /> {busy ? "Uploading…" : preview ? "Replace image" : "Upload image"}
        </label>
        <p className="mt-1.5 text-xs text-stone-600">JPG, PNG or WebP, up to 3 MB. Square photos look best.</p>
      </div>
    </div>
    {message && <FormMessage tone={message.tone}>{message.text}</FormMessage>}
  </div>;
}
