import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getShippingQuote, resolveShippingCharge } from "@/lib/services/shipping";

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items: Array<{ product_id: string; quantity: number; unit_price?: number }> = body.items ?? [];

    if (!items.length) {
      return NextResponse.json({ error: "EMPTY_CART" }, { status: 400 });
    }

    // ── Bypass mode (local dev only) ────────────────────────────────────────
    // Short-circuit BEFORE the DB lookup so an empty local Supabase doesn't
    // block development. Uses client-supplied prices — acceptable because this
    // path is only active when NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS=true. Still
    // flat-rate/threshold shipping — bypass mode has no state-aware DB to read.
    if (process.env.NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS === "true") {
      const bypassSubtotal = items.reduce(
        (sum, i) => sum + (i.unit_price ?? 0) * i.quantity,
        0
      );
      const bypassShipping = bypassSubtotal >= 5000 ? 0 : 150;
      const bypassTotal = bypassSubtotal + bypassShipping;
      return NextResponse.json({
        razorpay_order_id: `bypass_${crypto.randomUUID()}`,
        amount: Math.round(bypassTotal * 100),
        currency: "INR",
        key_id: "bypass",
        bypass: true,
      });
    }

    // ── Production path: server-side price + shipping verification ──────────
    // Client-supplied prices and shipping are NEVER trusted here.
    const state: unknown = body.state;
    if (typeof state !== "string" || !state.trim()) {
      return NextResponse.json({ error: "STATE_REQUIRED" }, { status: 400 });
    }

    const { data: products, error } = await anonClient()
      .from("products")
      .select("id, price")
      .in("id", items.map((i) => i.product_id));

    if (error || !products) {
      console.error("[razorpay/create-order] product lookup failed", error);
      return NextResponse.json({ error: "PRODUCT_LOOKUP_FAILED" }, { status: 500 });
    }

    const priceMap = Object.fromEntries(products.map((p) => [p.id, p.price as number]));

    let subtotal = 0;
    for (const item of items) {
      const price = priceMap[item.product_id];
      if (price == null) {
        return NextResponse.json({ error: "PRODUCT_NOT_FOUND" }, { status: 400 });
      }
      // Reject non-positive quantity — otherwise a crafted negative quantity
      // subtracts from subtotal (or a zero quantity contributes nothing while
      // still occupying a line item), letting a client manipulate the charged
      // amount. Mirrors the equivalent guard added to create_order_txn.
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        return NextResponse.json({ error: "INVALID_QUANTITY", product_id: item.product_id }, { status: 400 });
      }
      subtotal += price * item.quantity;
    }

    // State-wise shipping — re-derived from shipping_rates/shipping_settings,
    // the same tables the admin edits. A missing rate fails the request rather
    // than guessing a price. getShippingQuote can throw on a genuine DB error
    // (Task 3) — that's distinguished here from "state not configured".
    let quote;
    try {
      quote = await getShippingQuote(state);
    } catch (lookupErr) {
      console.error("[razorpay/create-order] shipping lookup failed", lookupErr);
      return NextResponse.json({ error: "SHIPPING_LOOKUP_FAILED" }, { status: 502 });
    }
    const shipping = resolveShippingCharge(subtotal, quote);
    if (shipping === null) {
      return NextResponse.json({ error: "SHIPPING_STATE_NOT_CONFIGURED" }, { status: 400 });
    }

    const total = subtotal + shipping;
    const amountPaise = Math.round(total * 100);

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      console.error("[razorpay/create-order] missing Razorpay credentials");
      return NextResponse.json({ error: "SERVER_MISCONFIGURED" }, { status: 500 });
    }
    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    const razorRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: `rcpt_${Date.now()}`,
      }),
    });

    if (!razorRes.ok) {
      const errText = await razorRes.text();
      console.error("[razorpay/create-order] Razorpay API error", errText);
      return NextResponse.json({ error: "RAZORPAY_ORDER_FAILED" }, { status: 502 });
    }

    const razorOrder = await razorRes.json();

    return NextResponse.json({
      razorpay_order_id: razorOrder.id,
      amount: razorOrder.amount,
      currency: razorOrder.currency,
      key_id: keyId,
    });
  } catch (err) {
    console.error("[razorpay/create-order] unhandled", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
