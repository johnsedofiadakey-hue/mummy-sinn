import { NextRequest, NextResponse } from "next/server";
import { quoteCheckout } from "@/lib/server/catalog-quote";
import { CheckoutError, parseCheckoutInput } from "@/lib/server/checkout-contract";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try { const input = parseCheckoutInput(await request.json()); const quote = await quoteCheckout(input); return NextResponse.json({ quote }); }
  catch (error) { if (error instanceof CheckoutError) return NextResponse.json({ code: error.code, message: error.message }, { status: error.status }); console.error("Checkout quote failed", error); return NextResponse.json({ code: "QUOTE_UNAVAILABLE", message: "We couldn't update your order right now." }, { status: 500 }); }
}
