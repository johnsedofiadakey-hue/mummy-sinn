import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { verifyPaystackSignature, verifyPaystackTransaction } from "@/lib/payments/paystack-server";

export const runtime = "nodejs";
type PaystackEvent = { event?: string; data?: { reference?: string; amount?: number; currency?: string } };

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!verifyPaystackSignature(raw, request.headers.get("x-paystack-signature"))) return NextResponse.json({ code: "INVALID_SIGNATURE" }, { status: 401 });
  try {
    const event = JSON.parse(raw) as PaystackEvent;
    if (event.event !== "charge.success" || !event.data?.reference) return NextResponse.json({ received: true });
    const verified = await verifyPaystackTransaction(event.data.reference);
    if (verified.status !== "success" || verified.reference !== event.data.reference || verified.currency !== "GHS") return NextResponse.json({ received: true });
    const paymentQuery = await adminDb.collection("payments").where("providerReference", "==", verified.reference).limit(1).get();
    if (paymentQuery.empty) return NextResponse.json({ received: true });
    const paymentRef = paymentQuery.docs[0].ref;
    await adminDb.runTransaction(async (transaction) => {
      const paymentSnap = await transaction.get(paymentRef); const payment = paymentSnap.data(); if (!payment || payment.status === "SUCCESSFUL") return;
      if (payment.status !== "PENDING" || payment.amountPesewas !== verified.amount) throw new Error("PAYMENT_AMOUNT_MISMATCH");
      const orderRef = adminDb.doc(`orders/${payment.orderId}`); const orderSnap = await transaction.get(orderRef); const order = orderSnap.data(); if (!order || order.paymentStatus !== "PENDING") return;
      const now = Timestamp.now(); const fulfillmentStatus = order.orderType === "PREORDER" ? "SCHEDULED" : "CONFIRMED";
      transaction.update(paymentRef, { status: "SUCCESSFUL", verifiedAt: now, providerTransactionId: verified.id ?? null, updatedAt: now });
      transaction.update(orderRef, { paymentStatus: "SUCCESSFUL", fulfillmentStatus, "reservation.status": "CONFIRMED", updatedAt: now });
      transaction.create(adminDb.doc(`auditLogs/${orderRef.id}-payment-confirmed`), { actorType: "payment_provider", action: "PAYMENT_CONFIRMED", entityType: "order", entityId: orderRef.id, providerReference: verified.reference, createdAt: now });
    });
    return NextResponse.json({ received: true });
  } catch (error) { console.error("Paystack webhook processing failed", error); return NextResponse.json({ code: "PROCESSING_FAILED" }, { status: 500 }); }
}
