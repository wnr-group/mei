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
  return new FunctionsClient(getFunctionsUrl(), {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
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
    console.error("[OrdersService:createOrder]", error);
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
