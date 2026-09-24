import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentIntent } from "@/types/domain";

type PaystackInit = { status: boolean; message?: string; data?: { authorization_url?: string; reference?: string } };
type PaystackVerify = { status: boolean; data?: { status?: string; reference?: string; amount?: number; currency?: string; id?: number | string } };

const API = "https://api.paystack.co";
const secret = () => { const key = process.env.PAYSTACK_SECRET_KEY; if (!key) throw new Error("PAYSTACK_NOT_CONFIGURED"); return key; };
const request = async <T>(path: string, options: RequestInit) => {
  const response = await fetch(`${API}${path}`, { ...options, headers: { Authorization: `Bearer ${secret()}`, "Content-Type": "application/json", ...options.headers }, cache: "no-store" });
  const body = await response.json().catch(() => null) as T | null;
  if (!response.ok || !body) throw new Error("PAYSTACK_REQUEST_FAILED");
  return body;
};

export async function initializePaystackCheckout(input: { email: string; amountPesewas: number; reference: string; channel: "mobile_money" | "card"; callbackUrl: string; metadata: Record<string, string> }): Promise<PaymentIntent> {
  const response = await request<PaystackInit>("/transaction/initialize", { method: "POST", body: JSON.stringify({ email: input.email, amount: String(input.amountPesewas), currency: "GHS", reference: input.reference, channels: [input.channel], callback_url: input.callbackUrl, metadata: JSON.stringify({ ...input.metadata, cancel_action: input.callbackUrl }) }) });
  if (!response.status || !response.data?.authorization_url || !response.data.reference) throw new Error("PAYSTACK_INITIALIZATION_FAILED");
  return { reference: response.data.reference, authorizationUrl: response.data.authorization_url, status: "pending" };
}

export async function verifyPaystackTransaction(reference: string) {
  const response = await request<PaystackVerify>(`/transaction/verify/${encodeURIComponent(reference)}`, { method: "GET" });
  if (!response.status || !response.data?.reference) throw new Error("PAYSTACK_VERIFICATION_FAILED");
  return response.data;
}

/** Verify the exact raw request bytes before parsing a Paystack webhook event. */
export function verifyPaystackSignature(rawBody: string, signature: string | null) {
  if (!signature || !process.env.PAYSTACK_SECRET_KEY) return false;
  const expected = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY).update(rawBody).digest("hex");
  const actual = Buffer.from(signature, "utf8"); const expectedBuffer = Buffer.from(expected, "utf8");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}
