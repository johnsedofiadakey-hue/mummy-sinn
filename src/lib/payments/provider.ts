import type { PaymentIntent, PaymentIntentInput } from "@/types/domain";

export interface PaymentProvider {
  initialize(input: PaymentIntentInput): Promise<PaymentIntent>;
  verify(reference: string): Promise<{ status: "successful" | "failed" | "pending"; providerReference: string }>;
}

// Phase 1 boundary: replace this adapter with a server-side Paystack implementation.
// Secret verification stays on the server / Cloud Function, never in the browser.
export class PaystackProvider implements PaymentProvider {
  async initialize(input: PaymentIntentInput): Promise<PaymentIntent> {
    return { reference: `MI-${input.orderId}-${Date.now()}`, status: "pending" };
  }
  async verify(reference: string) { return { status: "pending" as const, providerReference: reference }; }
}
