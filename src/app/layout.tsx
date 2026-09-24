import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/cart-provider";
import { OfflineBanner } from "@/components/offline-banner";
import { PwaRegistration } from "@/lib/pwa";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = { title: "Mummy's Inn", description: "Campus food delivery, made easy.", manifest: "/manifest.webmanifest", appleWebApp: { capable: true, title: "Mummy's Inn", statusBarStyle: "default" } };
// No maximumScale: students must be able to pinch-zoom (WCAG 1.4.4).
export const viewport: Viewport = { themeColor: "#ff5f45", width: "device-width", initialScale: 1, viewportFit: "cover" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en-GH" className={inter.variable}><body className="font-sans"><CartProvider><PwaRegistration/><main className="app-shell"><OfflineBanner/>{children}</main></CartProvider></body></html>; }
