import type { PreorderSlot } from "@/types/domain";
import { preorderSlots } from "@/lib/mock-data";

// Orders for a slot close this many minutes before it starts, so the kitchen can plan the batch.
export const ORDER_CUTOFF_MINUTES = 30;

const toMinutes = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const clock = (minutes: number, withSuffix = true) => {
  const h = Math.floor(minutes / 60) % 24; const m = minutes % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")}${withSuffix ? (h >= 12 ? " PM" : " AM") : ""}`;
};
const suffix = (minutes: number) => (Math.floor(minutes / 60) % 24 >= 12 ? "PM" : "AM");

export const formatClock = (hhmm: string) => clock(toMinutes(hhmm));
export const formatTime = (date: Date) => clock(date.getHours() * 60 + date.getMinutes());

/** "12:30 – 1:00 PM", or "11:30 AM – 12:00 PM" when the window crosses noon. */
export function slotWindow(slot: PreorderSlot) {
  const start = toMinutes(slot.startsAt); const end = toMinutes(slot.endsAt);
  return suffix(start) === suffix(end) ? `${clock(start, false)} – ${clock(end)}` : `${clock(start)} – ${clock(end)}`;
}
export const slotLabel = (slot: PreorderSlot) => `${slot.serviceDate} · ${slotWindow(slot)}`;
export const slotCutoff = (slot: PreorderSlot) => clock(toMinutes(slot.startsAt) - ORDER_CUTOFF_MINUTES);

export type SlotState = "open" | "full" | "closed";
export function slotState(slot: PreorderSlot, now: Date): SlotState {
  if (slot.serviceDate === "Today" && now.getHours() * 60 + now.getMinutes() >= toMinutes(slot.startsAt) - ORDER_CUTOFF_MINUTES) return "closed";
  if (!slot.isOpen || slot.availableCapacity <= 0) return "full";
  return "open";
}
export const findSlot = (id?: string) => preorderSlots.find((slot) => slot.id === id);
export const localDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
