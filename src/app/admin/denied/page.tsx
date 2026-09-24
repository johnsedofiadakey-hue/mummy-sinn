import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { denialMessage, type AccessDenial } from "@/lib/admin/permissions";
import { SignOutButton } from "@/components/admin/sign-out-button";

export const metadata = { title: "Access denied" };

export default async function AdminDeniedPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const message = reason === "NOT_CONFIGURED" ? "The admin portal isn't connected to Firebase on this server yet." : denialMessage[(reason ?? "FORBIDDEN") as AccessDenial] ?? denialMessage.FORBIDDEN;
  return <div className="grid min-h-dvh place-items-center px-5">
    <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-coral/10 text-coral"><ShieldAlert size={26} aria-hidden /></span>
      <h1 className="mt-4 text-xl font-black">Access denied</h1>
      <p className="mt-2 text-sm text-stone-600">{message}</p>
      <div className="mt-6 flex flex-col items-center gap-2">
        {reason === "FORBIDDEN" && <Link href="/admin" className="inline-flex min-h-11 items-center rounded-xl bg-coral px-5 text-sm font-black text-white">Back to dashboard</Link>}
        <SignOutButton />
      </div>
    </div>
  </div>;
}
