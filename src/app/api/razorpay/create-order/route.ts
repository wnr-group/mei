import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items: Array<{
      product_id: string;
      quantity: number;
      stitching_type?: "stitched" | "unstitched";
    }> = body.items ?? [];
    const state: string = typeof body.state === "string" ? body.state.trim() : "";

    if (!items.length) {
      return NextResponse.json({ error: "EMPTY_CART" }, { status: 400 });
    }

    if (!state) {
      return NextResponse.json({ error: "SHIPPING_STATE_MISSING" }, { status: 400 });
    }

    const supabase = anonClient();

    const { data: products, error } = await supabase
      .from("products")
      .select("id, price, price_unstitched, price_stitched")
      .in("id", items.map((i) => i.product_id));

    if (error || !products) {
      console.error("[razorpay/create-order] product lookup failed", error);
      return NextResponse.json({ error: "PRODUCT_LOOKUP_FAILED" }, { status: 500 });
    }

    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

    let subtotal = 0;
    for (const item of items) {
      const product = productMap[item.product_id];
      if (product == null) {
        return NextResponse.json({ error: "PRODUCT_NOT_FOUND" }, { status: 400 });
      }

      let price: number;
      if (item.stitching_type === "stitched" && product.price_stitched != null) {
        price = product.price_stitched;
      } else if (item.stitching_type === "unstitched" && product.price_unstitched != null) {
        price = product.price_unstitched;
      } else {
        price = product.price;
      }

      subtotal += price * item.quantity;
    }

    // State-wise shipping — must mirror create_order_txn exactly so the amount
    // charged via Razorpay equals the total the DB records. Reject an
    // unconfigured state here (before payment) rather than letting the RPC fail
    // after the customer has already paid.
    const { data: rate, error: rateError } = await supabase
      .from("shipping_rates")
      .select("charge")
      .eq("state", state)
      .maybeSingle();

    if (rateError) {
      console.error("[razorpay/create-order] shipping rate lookup failed", rateError);
      return NextResponse.json({ error: "SHIPPING_LOOKUP_FAILED" }, { status: 500 });
    }
    if (!rate) {
      return NextResponse.json({ error: "SHIPPING_STATE_NOT_CONFIGURED" }, { status: 400 });
    }

    const { data: settings, error: settingsError } = await supabase
      .from("shipping_settings")
      .select("free_shipping_enabled, free_shipping_threshold")
      .eq("id", 1)
      .maybeSingle();

    if (settingsError) {
      console.error("[razorpay/create-order] shipping settings lookup failed", settingsError);
      return NextResponse.json({ error: "SHIPPING_LOOKUP_FAILED" }, { status: 500 });
    }

    const stateCharge = Number(rate.charge);
    const freeEnabled = settings?.free_shipping_enabled ?? false;
    const freeThreshold =
      settings?.free_shipping_threshold != null ? Number(settings.free_shipping_threshold) : null;
    const shipping =
      freeEnabled && freeThreshold != null && subtotal >= freeThreshold ? 0 : stateCharge;

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
