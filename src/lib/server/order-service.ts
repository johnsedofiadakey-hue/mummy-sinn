import "server-only";
import { createHash } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { quoteCheckoutInTransaction, type ServerQuote } from "@/lib/server/catalog-quote";
import { CheckoutError, type CheckoutInput } from "@/lib/server/checkout-contract";

const HOLD_MINUTES = 12;
export type PendingOrder = { orderId: string; orderNumber: string; trackingToken: string; quote: ServerQuote; paymentMethod: "mobile_money" | "card"; existing: boolean };
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const fingerprint = (input: CheckoutInput) => hash(JSON.stringify(input));
const orderNumber = () => `MI-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 90 + 10)}`;

export async function createPendingOrder(input: CheckoutInput): Promise<PendingOrder> {
  if (!isFirebaseAdminConfigured()) throw new CheckoutError("CHECKOUT_NOT_CONFIGURED", 503, "Checkout is being configured. Please try again later.");
  const orderRef = adminDb.doc(`orders/${input.idempotencyKey}`); const requestFingerprint = fingerprint(input);
  const trackingToken = input.trackingToken; const nextOrderNumber = orderNumber();
  return adminDb.runTransaction(async (transaction) => {
    const existing = await transaction.get(orderRef);
    if (existing.exists) {
      const data = existing.data() ?? {};
      if (data.requestFingerprint !== requestFingerprint) throw new CheckoutError("IDEMPOTENCY_CONFLICT", 409, "This checkout attempt has changed. Start again.");
      return { orderId: existing.id, orderNumber: String(data.orderNumber ?? ""), trackingToken, quote: data.quote as ServerQuote, paymentMethod: data.paymentMethod as "mobile_money" | "card", existing: true };
    }
    const quote = await quoteCheckoutInTransaction(input, adminDb, transaction);
    const now = Timestamp.now(); const expiresAt = Timestamp.fromMillis(now.toMillis() + HOLD_MINUTES * 60_000);
    if (input.fulfilment.type === "PREORDER") transaction.update(adminDb.doc(`preorderSlots/${input.fulfilment.preorderSlotId}`), { reservedCapacity: FieldValue.increment(quote.preorderCapacityUnits), updatedAt: now });
    transaction.create(orderRef, {
      orderNumber: nextOrderNumber, trackingTokenHash: hash(trackingToken), requestFingerprint,
      customer: input.delivery, paymentMethod: input.payment.method, quote,
      paymentStatus: "PENDING", fulfillmentStatus: "AWAITING_PAYMENT", orderType: input.fulfilment.type,
      reservation: { ...(input.fulfilment.type === "PREORDER" ? { preorderSlotId: input.fulfilment.preorderSlotId, capacityUnits: quote.preorderCapacityUnits } : {}), heldAt: now, expiresAt, status: "HELD" },
      createdAt: now, updatedAt: now,
    });
    transaction.create(adminDb.doc(`payments/${orderRef.id}`), { orderId: orderRef.id, provider: "paystack", status: "PENDING", amountPesewas: quote.totalPesewas, currency: "GHS", createdAt: now, updatedAt: now });
    transaction.create(adminDb.doc(`auditLogs/${orderRef.id}-created`), { actorType: "guest", action: "ORDER_PENDING_CREATED", entityType: "order", entityId: orderRef.id, requestId: input.idempotencyKey, createdAt: now });
    return { orderId: orderRef.id, orderNumber: nextOrderNumber, trackingToken, quote, paymentMethod: input.payment.method, existing: false };
  });
}
