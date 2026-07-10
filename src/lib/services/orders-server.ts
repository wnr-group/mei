import "server-only";

import { createServiceClient } from "@/lib/supabase/service-client";

export interface ShippingAddress {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

export interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  color_label: string | null;
}

export interface OrderCustomer {
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
}

export interface OrderDetail {
  id: string;
  order_number: string;
  status: string;
  total: number;
  payment_id: string | null;
  payment_provider: string | null;
  payment_metadata: { razorpay_order_id?: string; request_id?: string } | null;
  shipping_address: ShippingAddress | null;
  created_at: string;
  customer: OrderCustomer | null;
  items: OrderItem[];
}

// Raw shape returned by Supabase. Includes deleted_at which exists in the DB
// (migration 20260616153000) but is missing from the storefront's database.ts types.
// Cast via `as unknown as RawOrderRow` after the query.
type RawOrderRow = {
  id: string;
  order_number: string;
  status: string;
  total: number;
  payment_id: string | null;
  payment_provider: string | null;
  payment_metadata: Record<string, unknown> | null;
  shipping_address: Record<string, string> | null;
  created_at: string;
  deleted_at: string | null;
  customers: { name: string; email: string | null; phone: string | null; city: string | null } | null;
  order_items: Array<{ id: string; product_name: string; quantity: number; unit_price: number; product_snapshot: Record<string, string | null> | null }>;
};

export async function getOrderById(id: string): Promise<OrderDetail | null> {
  const result = await createServiceClient()
    .from("orders")
    .select(
      "id, order_number, status, total, payment_id, payment_provider, payment_metadata, shipping_address, created_at, deleted_at, customers(name,email,phone,city), order_items(id,product_name,quantity,unit_price,product_snapshot)"
    )
    .eq("id", id)
    .maybeSingle();

  if (result.error) {
    console.error("[OrdersService:getOrderById]", result.error);
    throw result.error;
  }

  if (!result.data) return null;

  const row = result.data as unknown as RawOrderRow;

  // Treat soft-deleted orders as not found
  if (row.deleted_at) return null;

  const meta = row.payment_metadata;

  return {
    id: row.id,
    order_number: row.order_number,
    status: row.status,
    total: row.total,
    payment_id: row.payment_id,
    payment_provider: row.payment_provider,
    // Expose only non-sensitive fields from payment_metadata.
    // razorpay_signature is a security token and must never appear on the page.
    payment_metadata: meta
      ? {
          razorpay_order_id: meta.razorpay_order_id as string | undefined,
          request_id: meta.request_id as string | undefined,
        }
      : null,
    shipping_address: row.shipping_address as ShippingAddress | null,
    created_at: row.created_at,
    customer: row.customers
      ? {
          name: row.customers.name,
          email: row.customers.email ?? null,
          phone: row.customers.phone ?? null,
          city: row.customers.city ?? null,
        }
      : null,
    items: (row.order_items ?? []).map((item) => ({
      id: item.id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      color_label: item.product_snapshot?.color_label ?? null,
    })),
  };
}
