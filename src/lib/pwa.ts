"use client";
import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // In development a cached shell hides code changes, so remove any worker left from a production build.
    if (process.env.NODE_ENV !== "production") { navigator.serviceWorker.getRegistrations().then((all) => all.forEach((r) => r.unregister())).catch(() => undefined); return; }
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
