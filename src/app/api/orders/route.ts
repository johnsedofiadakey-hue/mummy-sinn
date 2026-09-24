import { NextRequest, NextResponse } from "next/server";
import { createPendingOrder } from "@/lib/server/order-service";
import { CheckoutError, parseCheckoutInput } from "@/lib/server/checkout-contract";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const input = parseCheckoutInput(await request.json());
    const order = await createPendingOrder(input);
    return NextResponse.json({ orderId: order.orderId, orderNumber: order.orderNumber, trackingToken: order.trackingToken || undefined, quote: order.quote, paymentMethod: order.paymentMethod, existing: order.existing }, { status: order.existing ? 200 : 201 });
  } catch (error) {
    if (error instanceof CheckoutError) return NextResponse.json({ code: error.code, message: error.message }, { status: error.status });
    console.error("Pending order creation failed", error); return NextResponse.json({ code: "ORDER_UNAVAILABLE", message: "We couldn't start your order right now. Your cart is still safe." }, { status: 500 });
  }
}
