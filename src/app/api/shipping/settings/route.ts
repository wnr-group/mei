import { NextResponse } from "next/server";
import { getShippingQuote } from "@/lib/services/shipping";

// Exposes the global free-shipping settings (enabled flag + threshold) so
// client components (e.g. PromoStrip) can display the live value configured
// in the Admin rather than a hardcoded constant.
export async function GET() {
  try {
    // getShippingQuote always fetches shipping_settings regardless of state.
    // We pass an intentionally-absent state ("__probe__") so the rate lookup
    // returns null without throwing (maybeSingle resolves to data: null for a
    // missing row), but the settings half of the parallel query still executes.
    const quote = await getShippingQuote("__probe__");
    return NextResponse.json({
      freeShippingEnabled: quote.freeShippingEnabled,
      freeShippingThreshold: quote.freeShippingThreshold,
    });
  } catch (err) {
    console.error("[shipping/settings] lookup failed", err);
    return NextResponse.json({ error: "SHIPPING_SETTINGS_LOOKUP_FAILED" }, { status: 500 });
  }
}
