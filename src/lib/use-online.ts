"use client";
import { useEffect, useState } from "react";

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return online;
}

/** Current time, refreshed every minute. Null until mounted so server and client render the same HTML. */
export function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const id = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(id); }, []);
  return now;
}
