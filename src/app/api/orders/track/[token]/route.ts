import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export const runtime = "nodejs";
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!isFirebaseAdminConfigured()) return NextResponse.json({ code: "TRACKING_NOT_CONFIGURED" }, { status: 503 });
  const { token } = await params;
  if (!/^[a-f0-9]{32,128}$/i.test(token)) return NextResponse.json({ code: "ORDER_NOT_FOUND" }, { status: 404 });
  const result = await adminDb.collection("orders").where("trackingTokenHash", "==", hash(token)).limit(1).get();
  if (result.empty) return NextResponse.json({ code: "ORDER_NOT_FOUND" }, { status: 404 });
  const order = result.docs[0].data(); const quote = order.quote as { deliveryLocation?: { name?: string }; lines?: { name: string; quantity: number }[] } | undefined;
  // The token authorizes this small delivery view. Never include phone, payment data, or raw audit/order internals.
  return NextResponse.json({ orderNumber: order.orderNumber, paymentStatus: order.paymentStatus, fulfillmentStatus: order.fulfillmentStatus, orderType: order.orderType, createdAt: order.createdAt?.toDate?.().toISOString?.() ?? null, totalPesewas: order.quote?.totalPesewas ?? null, delivery: { hallOrHostel: quote?.deliveryLocation?.name ?? null, block: order.customer?.block ?? null, roomOrLandmark: order.customer?.roomOrLandmark ?? null }, items: quote?.lines?.map((line) => ({ name: line.name, quantity: line.quantity })) ?? [] });
}
