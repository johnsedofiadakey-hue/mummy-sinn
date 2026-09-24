"use client";
import { useState } from "react";
import { getAuth, inMemoryPersistence, setPersistence, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { LockKeyhole } from "lucide-react";
import { firebaseApp } from "@/lib/firebase/client";
import { FormMessage, PrimaryButton, TextField } from "@/components/admin/fields";

const AUTH_ERRORS: Record<string, string> = {
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/network-request-failed": "No connection. Check your internet and try again.",
  "auth/operation-not-allowed": "Email sign-in isn't enabled for this project yet.",
};

export default function AdminSignInPage() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(null);
    const auth = getAuth(firebaseApp);
    try {
      // The browser never keeps a Firebase session: it only needs one fresh ID token to exchange for the httpOnly cookie.
      await setPersistence(auth, inMemoryPersistence);
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await credential.user.getIdToken();
      const response = await fetch("/api/admin/session", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) });
      await signOut(auth);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
        setError(payload.error?.message ?? "Sign-in failed. Please try again."); setBusy(false); return;
      }
      window.location.assign("/admin");
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      setError(AUTH_ERRORS[code] ?? "Sign-in failed. Please try again."); setBusy(false);
      await signOut(auth).catch(() => undefined);
    }
  };

  return <div className="grid min-h-dvh place-items-center px-5 py-10">
    <div className="w-full max-w-sm">
      <div className="text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-coral text-white shadow-sm"><LockKeyhole size={24} aria-hidden /></span><h1 className="mt-4 text-2xl font-black">Staff sign in</h1><p className="mt-1 text-sm text-stone-600">Mummy&apos;s Inn kitchen admin. Students don&apos;t need an account.</p></div>
      <form onSubmit={submit} className="mt-8 space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm" noValidate>
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <TextField id="email" label="Work email" type="email" autoComplete="username" inputMode="email" value={email} onChange={setEmail} required />
        <TextField id="password" label="Password" type="password" autoComplete="current-password" value={password} onChange={setPassword} required />
        <PrimaryButton type="submit" busy={busy} disabled={!email || !password} className="w-full">Sign in</PrimaryButton>
        <p className="text-center text-xs text-stone-500">Forgot your password? Ask the kitchen manager to reset it.</p>
      </form>
    </div>
  </div>;
}
