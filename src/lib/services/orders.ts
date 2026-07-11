import { FunctionsClient } from "@supabase/functions-js";

export interface CreateOrderInput {
  customer: {
    name: string;
    email: string;
    phone: string;
    city: string;
  };
  items: Array<{
    product_id: string;
    name: string;
    quantity: number;
    color_id?: string;
    color_label?: string;
    stitching_type?: "stitched" | "unstitched";
    measurements?: Array<{
      field_key: string;
      label?: string | null;
      value_in: number;
    }>;
  }>;
  shipping_address: Record<string, string>;
  payment: {
    provider: string;
    payment_id: string;
    order_id: string;
    signature: string;
  };
}

export interface CreateOrderResult {
  orderId: string;
  orderNumber: string;
  total: number;
}

/**
 * Returns the Edge Function base URL.
 *
 * In production this is automatically derived from NEXT_PUBLIC_SUPABASE_URL.
 * In local dev, set NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL to point at the local
 * `supabase functions serve` server (e.g. http://127.0.0.1:54321/functions/v1)
 * while keeping NEXT_PUBLIC_SUPABASE_URL pointing at the remote project for
 * auth and data queries.
 */
function getFunctionsUrl(): string {
  const override = process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL;
  if (override) return override;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return `${base}/functions/v1`;
}

function getFunctionsClient(): FunctionsClient {
  // In local dev, NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL points at the local stack whose JWT
  // secret differs from the remote project. NEXT_PUBLIC_SUPABASE_FUNCTIONS_ANON_KEY holds the
  // local anon key (from `supabase status`). In production this var is absent and the remote
  // anon key is used instead.
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return new FunctionsClient(getFunctionsUrl(), {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const functions = getFunctionsClient();
  const requestId = crypto.randomUUID();

  const { data, error } = await functions.invoke("create-order", {
    body: input,
    headers: { "x-request-id": requestId },
  });

  if (error) {
    const context = error instanceof Error ? error.message : JSON.stringify(error);
    let body: unknown;
    try { body = (error as { context?: unknown }).context; } catch { /* ignore */ }
    console.error("[OrdersService:createOrder]", context, body ?? "");
    throw error;
  }

  if (!data?.success) {
    const msg = data?.error ?? "ORDER_CREATION_FAILED";
    console.error("[OrdersService:createOrder]", msg);
    throw new Error(msg);
  }

  return {
    orderId: data.order_id,
    orderNumber: data.order_number,
    total: data.total,
  };
}
