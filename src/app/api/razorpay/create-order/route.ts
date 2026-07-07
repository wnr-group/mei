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
    const items: Array<{ product_id: string; quantity: number }> = body.items ?? [];

    if (!items.length) {
      return NextResponse.json({ error: "EMPTY_CART" }, { status: 400 });
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
      subtotal += price * item.quantity;
    }

    // Shipping threshold — mirrors src/lib/config/shipping.ts
    const shipping = subtotal >= 5000 ? 0 : 150;
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
