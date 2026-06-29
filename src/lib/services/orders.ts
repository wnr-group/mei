import { createClient } from "@supabase/supabase-js";

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

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const supabase = getClient();
  const requestId = crypto.randomUUID();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).functions.invoke("create-order", {
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
