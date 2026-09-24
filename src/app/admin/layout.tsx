import type { Metadata } from "next";

// Staff-only area. No auth here (sign-in and denied pages live under it); the (portal) layout and every page/API guard themselves.
export const metadata: Metadata = { title: { default: "Admin · Mummy's Inn", template: "%s · Mummy's Inn Admin" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-root min-h-dvh bg-[#f7f5f2] text-ink">{children}</div>;
}
