import { NextResponse } from "next/server";
import { checkoutRuntimeReady } from "@/lib/server/catalog-quote";

export const runtime = "nodejs";
/** Safe readiness check for the client and health monitoring. It deliberately exposes no secret/configuration values. */
export async function GET() { return NextResponse.json({ ready: checkoutRuntimeReady(), mode: checkoutRuntimeReady() ? "configuration-required" : "not-configured" }, { status: checkoutRuntimeReady() ? 200 : 503 }); }
