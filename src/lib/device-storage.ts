// Guest data that lives only on this phone. Nothing here is a customer profile or leaves the device.
import type { FulfillmentStatus, PaymentStatus } from "@/types/domain";

export function readJson<T>(storage: "local" | "session", key: string): T | null {
  try {
    const raw = (storage === "local" ? window.localStorage : window.sessionStorage).getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { removeKey(storage, key); return null; }
}
export function writeJson(storage: "local" | "session", key: string, value: unknown) {
  try { (storage === "local" ? window.localStorage : window.sessionStorage).setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked: the app keeps working in memory */ }
}
export function removeKey(storage: "local" | "session", key: string) {
  try { (storage === "local" ? window.localStorage : window.sessionStorage).removeItem(key); } catch { /* ignore */ }
}

// Opt-in "remember my delivery details" (off by default for shared phones).
export interface SavedDetails { locationId: string; block: string; room: string; name: string; phone: string; }
const DETAILS_KEY = "mi-delivery-details";
export const loadSavedDetails = () => readJson<SavedDetails>("local", DETAILS_KEY);
export const saveDetails = (details: SavedDetails) => writeJson("local", DETAILS_KEY, details);
export const forgetDetails = () => removeKey("local", DETAILS_KEY);

// Orders placed from this phone. In the live app the server owns this data; the device only keeps the
// tracking link. The demo keeps a small display snapshot so the tracking screen has something to show.
export interface DeviceOrder {
  trackingToken: string; orderNumber: string; createdAt: string; demo: boolean;
  itemsSummary: string; itemCount: number; total: number;
  fulfilmentLabel: string; orderType: "ASAP" | "PREORDER";
  hallName: string; block: string; room: string;
  pin: string; paymentStatus: PaymentStatus; fulfillmentStatus: FulfillmentStatus;
}
const ORDERS_KEY = "mi-orders";
const KEEP_DAYS = 14;
export function loadDeviceOrders(): DeviceOrder[] {
  const orders = readJson<DeviceOrder[]>("local", ORDERS_KEY) ?? [];
  const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
  return orders.filter((order) => Date.parse(order.createdAt) > cutoff);
}
export const findDeviceOrder = (token: string) => loadDeviceOrders().find((order) => order.trackingToken === token);
export const saveDeviceOrder = (order: DeviceOrder) => writeJson("local", ORDERS_KEY, [order, ...loadDeviceOrders().filter((o) => o.trackingToken !== order.trackingToken)].slice(0, 10));
export const removeDeviceOrder = (token: string) => writeJson("local", ORDERS_KEY, loadDeviceOrders().filter((order) => order.trackingToken !== token));
