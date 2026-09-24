import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export const runtime = "nodejs";
const authorized = (request: NextRequest) => { const secret = process.env.INTERNAL_TASK_SECRET; const header = request.headers.get("authorization"); return Boolean(secret && header === `Bearer ${secret}`); };

/** Call only from a trusted scheduler. It releases unpaid slot holds in small, idempotent batches. */
export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  if (!isFirebaseAdminConfigured()) return NextResponse.json({ code: "CHECKOUT_NOT_CONFIGURED" }, { status: 503 });
  const now = Timestamp.now(); const candidates = await adminDb.collection("orders").where("paymentStatus", "==", "PENDING").where("reservation.expiresAt", "<=", now).limit(50).get(); let expired = 0;
  for (const candidate of candidates.docs) await adminDb.runTransaction(async (transaction) => {
    const orderSnap = await transaction.get(candidate.ref); const order = orderSnap.data(); if (!order || order.paymentStatus !== "PENDING" || order.reservation?.status !== "HELD" || order.reservation?.expiresAt?.toMillis?.() > now.toMillis()) return;
    const updateAt = Timestamp.now();
    if (order.reservation.preorderSlotId && order.reservation.capacityUnits) transaction.update(adminDb.doc(`preorderSlots/${order.reservation.preorderSlotId}`), { reservedCapacity: FieldValue.increment(-Number(order.reservation.capacityUnits)), updatedAt: updateAt });
    transaction.update(candidate.ref, { paymentStatus: "ABANDONED", fulfillmentStatus: "PAYMENT_FAILED", "reservation.status": "RELEASED", updatedAt: updateAt });
    transaction.update(adminDb.doc(`payments/${candidate.id}`), { status: "ABANDONED", updatedAt: updateAt });
    transaction.set(adminDb.doc(`auditLogs/${candidate.id}-reservation-expired`), { actorType: "scheduler", action: "PAYMENT_HOLD_EXPIRED", entityType: "order", entityId: candidate.id, createdAt: updateAt }, { merge: true }); expired += 1;
  });
  return NextResponse.json({ expired, checked: candidates.size });
}
