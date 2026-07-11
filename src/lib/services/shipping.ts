import { createClient } from "@/lib/supabase/client";

export interface ShippingRate {
  state: string;
  charge: number;
}

export interface ShippingPolicy {
  rates: ShippingRate[];
  freeShippingEnabled: boolean;
  freeShippingThreshold: number | null;
}

// Reads the admin-configured shipping rates and the global free-shipping rule.
// Both tables are anon-readable (see shipping_config_schema migration RLS), so
// the storefront can price shipping client-side before payment.
export async function getShippingPolicy(): Promise<ShippingPolicy> {
  const supabase = createClient();

  const [ratesRes, settingsRes] = await Promise.all([
    supabase.from("shipping_rates").select("state, charge").order("state", { ascending: true }),
    supabase
      .from("shipping_settings")
      .select("free_shipping_enabled, free_shipping_threshold")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  if (ratesRes.error) throw new Error(ratesRes.error.message);
  if (settingsRes.error) throw new Error(settingsRes.error.message);

  const rates: ShippingRate[] = (ratesRes.data ?? []).map((r) => ({
    state: r.state as string,
    charge: Number(r.charge),
  }));

  const settings = settingsRes.data as
    | { free_shipping_enabled: boolean; free_shipping_threshold: number | null }
    | null;

  return {
    rates,
    freeShippingEnabled: settings?.free_shipping_enabled ?? false,
    freeShippingThreshold:
      settings?.free_shipping_threshold != null ? Number(settings.free_shipping_threshold) : null,
  };
}

// Mirrors create_order_txn's free-shipping decision exactly: the state charge
// applies unless the free-shipping rule is enabled, has a threshold, and the
// subtotal meets it. Keeping this identical to the RPC keeps the amount charged
// via Razorpay in sync with the total the database records.
export function calculateStateShipping(
  subtotal: number,
  stateCharge: number,
  policy: Pick<ShippingPolicy, "freeShippingEnabled" | "freeShippingThreshold">
): number {
  if (
    policy.freeShippingEnabled &&
    policy.freeShippingThreshold != null &&
    subtotal >= policy.freeShippingThreshold
  ) {
    return 0;
  }
  return stateCharge;
}
