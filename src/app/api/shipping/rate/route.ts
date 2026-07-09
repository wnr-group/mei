import { NextRequest, NextResponse } from "next/server";
import { getShippingQuote, resolveShippingCharge } from "@/lib/services/shipping";

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state");
  if (!state) {
    return NextResponse.json({ error: "STATE_REQUIRED" }, { status: 400 });
  }

  const subtotalParam = req.nextUrl.searchParams.get("subtotal");
  const parsedSubtotal = subtotalParam ? Number(subtotalParam) : 0;
  const subtotal = Number.isFinite(parsedSubtotal) && parsedSubtotal >= 0 ? parsedSubtotal : 0;

  try {
    const quote = await getShippingQuote(state);
    const shipping = resolveShippingCharge(subtotal, quote);
    return NextResponse.json({ shipping });
  } catch (err) {
    console.error("[shipping/rate] lookup failed", err);
    return NextResponse.json({ error: "SHIPPING_LOOKUP_FAILED" }, { status: 500 });
  }
}
