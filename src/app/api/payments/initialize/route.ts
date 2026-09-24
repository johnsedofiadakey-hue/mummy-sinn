import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { initializePaystackCheckout } from "@/lib/payments/paystack-server";

export const runtime = "nodejs";
const email = (value: unknown) => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254 ? value.trim().toLowerCase() : null;

export async function POST(request: NextRequest) {
  try {
    if (!isFirebaseAdminConfigured() || !process.env.PAYSTACK_SECRET_KEY) return NextResponse.json({ code: "PAYMENT_NOT_CONFIGURED", message: "Payments are being configured." }, { status: 503 });
    const body = await request.json() as { orderId?: unknown; receiptEmail?: unknown; trackingToken?: unknown };
    if (typeof body.orderId !== "string" || !/^[a-zA-Z0-9._=-]{16,120}$/.test(body.orderId)) return NextResponse.json({ code: "INVALID_ORDER", message: "Start checkout again." }, { status: 400 });
    const receiptEmail = email(body.receiptEmail);
    if (!receiptEmail) return NextResponse.json({ code: "RECEIPT_EMAIL_REQUIRED", message: "Add an email for secure payment and your receipt." }, { status: 400 });
    if (typeof body.trackingToken !== "string" || !/^[a-f0-9]{32,128}$/i.test(body.trackingToken)) return NextResponse.json({ code: "INVALID_TRACKING_TOKEN", message: "Start checkout again." }, { status: 400 });
    const orderRef = adminDb.doc(`orders/${body.orderId}`); const paymentRef = adminDb.doc(`payments/${body.orderId}`);
    const [orderSnap, paymentSnap] = await Promise.all([orderRef.get(), paymentRef.get()]);
    const order = orderSnap.data(); const payment = paymentSnap.data();
    if (!order || !payment || order.paymentStatus !== "PENDING" || payment.status !== "PENDING") return NextResponse.json({ code: "ORDER_NOT_PAYABLE", message: "This order can no longer be paid. Check your orders." }, { status: 409 });
    if (order.trackingTokenHash !== createHash("sha256").update(body.trackingToken).digest("hex")) return NextResponse.json({ code: "INVALID_TRACKING_TOKEN", message: "Start checkout again." }, { status: 403 });
    const reference = `MI-${body.orderId}-${randomUUID().slice(0, 8)}`;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!baseUrl?.startsWith("https://")) return NextResponse.json({ code: "PAYMENT_CALLBACK_NOT_CONFIGURED", message: "Payments are being configured." }, { status: 503 });
    const intent = await initializePaystackCheckout({ email: receiptEmail, amountPesewas: Number(payment.amountPesewas), reference, channel: order.paymentMethod === "mobile_money" ? "mobile_money" : "card", callbackUrl: `${baseUrl}/orders/${body.trackingToken}`, metadata: { orderId: body.orderId, orderNumber: String(order.orderNumber) } });
    await adminDb.runTransaction(async (transaction) => {
      const current = await transaction.get(paymentRef); if (!current.exists || current.data()?.status !== "PENDING") throw new Error("PAYMENT_ATTEMPT_CONFLICT");
      transaction.update(paymentRef, { providerReference: intent.reference, receiptEmail, initializedAt: Timestamp.now(), updatedAt: Timestamp.now() });
      transaction.update(orderRef, { paymentReference: intent.reference, updatedAt: Timestamp.now() });
    });
    return NextResponse.json({ reference: intent.reference, authorizationUrl: intent.authorizationUrl });
  } catch (error) { console.error("Paystack initialization failed", error); return NextResponse.json({ code: "PAYMENT_INITIALIZATION_FAILED", message: "We couldn't start payment. Your order is still saved." }, { status: 502 }); }
}
