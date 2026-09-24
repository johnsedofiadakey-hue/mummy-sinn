import "server-only";
import { normaliseGhPhone } from "@/lib/phone";

export type CheckoutLineInput = { menuItemId: string; optionIds: string[]; quantity: number; note?: string };
export type FulfilmentInput = { type: "ASAP" } | { type: "PREORDER"; preorderSlotId: string };
export type CheckoutInput = {
  idempotencyKey: string;
  trackingToken: string;
  lines: CheckoutLineInput[];
  fulfilment: FulfilmentInput;
  delivery: { locationId: string; block?: string; roomOrLandmark: string; instructions?: string; name: string; phone: string };
  payment: { method: "mobile_money" | "card"; mobileMoney?: { provider: "mtn" | "telecel" | "at"; phone: string } };
};

export type ValidatedDelivery = Omit<CheckoutInput["delivery"], "phone" | "block" | "instructions"> & { phone: string; block?: string; instructions?: string };

export class CheckoutError extends Error {
  constructor(public readonly code: string, public readonly status = 400, message?: string) { super(message ?? code); }
}

const nonEmptyString = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;
const optionalString = (value: unknown, max: number) => value === undefined || (typeof value === "string" && value.trim().length <= max);

/** Parse untrusted browser JSON. Monetary values never cross this boundary. */
export function parseCheckoutInput(value: unknown): CheckoutInput {
  if (!value || typeof value !== "object") throw new CheckoutError("INVALID_REQUEST", 400, "Invalid checkout request.");
  const input = value as Partial<CheckoutInput>;
  if (typeof input.idempotencyKey !== "string" || !/^[a-zA-Z0-9._=-]{16,120}$/.test(input.idempotencyKey)) throw new CheckoutError("INVALID_IDEMPOTENCY_KEY", 400, "Start checkout again.");
  if (typeof input.trackingToken !== "string" || !/^[a-f0-9]{32,128}$/i.test(input.trackingToken)) throw new CheckoutError("INVALID_TRACKING_TOKEN", 400, "Start checkout again.");
  if (!Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > 20) throw new CheckoutError("INVALID_CART", 400, "Your cart needs between 1 and 20 items.");
  const lines = input.lines.map((line) => {
    if (!line || typeof line !== "object" || typeof line.menuItemId !== "string" || !Array.isArray(line.optionIds) || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20 || !optionalString(line.note, 300)) throw new CheckoutError("INVALID_CART_LINE", 400, "One of the items in your cart is invalid.");
    const optionIds = [...new Set(line.optionIds)];
    if (optionIds.some((id) => typeof id !== "string" || id.length > 100)) throw new CheckoutError("INVALID_OPTION", 400, "One of your choices is invalid.");
    return { menuItemId: line.menuItemId, optionIds, quantity: line.quantity, ...(line.note?.trim() ? { note: line.note.trim() } : {}) };
  });
  if (!input.fulfilment || typeof input.fulfilment !== "object" || !["ASAP", "PREORDER"].includes(input.fulfilment.type ?? "")) throw new CheckoutError("INVALID_FULFILMENT", 400, "Choose a delivery time.");
  const fulfilment: FulfilmentInput = input.fulfilment.type === "PREORDER"
    ? typeof input.fulfilment.preorderSlotId === "string" && input.fulfilment.preorderSlotId.length <= 100 ? { type: "PREORDER", preorderSlotId: input.fulfilment.preorderSlotId } : (() => { throw new CheckoutError("INVALID_SLOT", 400, "Choose a delivery window."); })()
    : { type: "ASAP" };
  if (!input.delivery || typeof input.delivery !== "object" || typeof input.delivery.locationId !== "string" || !nonEmptyString(input.delivery.roomOrLandmark, 160) || !nonEmptyString(input.delivery.name, 100) || !optionalString(input.delivery.block, 80) || !optionalString(input.delivery.instructions, 300)) throw new CheckoutError("INVALID_DELIVERY", 400, "Check your delivery details.");
  const phone = normaliseGhPhone(input.delivery.phone ?? "");
  if (!phone) throw new CheckoutError("INVALID_PHONE", 400, "Enter a valid Ghana mobile number.");
  const delivery: ValidatedDelivery = { locationId: input.delivery.locationId, roomOrLandmark: input.delivery.roomOrLandmark.trim(), name: input.delivery.name.trim(), phone, ...(input.delivery.block?.trim() ? { block: input.delivery.block.trim() } : {}), ...(input.delivery.instructions?.trim() ? { instructions: input.delivery.instructions.trim() } : {}) };
  if (!input.payment || typeof input.payment !== "object" || !["mobile_money", "card"].includes(input.payment.method ?? "")) throw new CheckoutError("INVALID_PAYMENT_METHOD", 400, "Choose a payment method.");
  const payment = input.payment.method === "mobile_money"
    ? (() => { const momo = input.payment?.mobileMoney; const momoPhone = normaliseGhPhone(momo?.phone ?? ""); if (!momo || !["mtn", "telecel", "at"].includes(momo.provider) || !momoPhone) throw new CheckoutError("INVALID_MOMO", 400, "Check your Mobile Money details."); return { method: "mobile_money" as const, mobileMoney: { provider: momo.provider, phone: momoPhone } }; })()
    : { method: "card" as const };
  return { idempotencyKey: input.idempotencyKey, trackingToken: input.trackingToken, lines, fulfilment, delivery, payment };
}
