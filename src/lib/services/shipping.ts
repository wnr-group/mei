import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database";

export interface ShippingQuote {
  charge: number | null;
  freeShippingEnabled: boolean;
  freeShippingThreshold: number | null;
}

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function getShippingQuote(state: string): Promise<ShippingQuote> {
  const supabase = getServiceClient();

  const [{ data: rate, error: rateError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase.from("shipping_rates").select("charge").eq("state", state).maybeSingle(),
    supabase.from("shipping_settings").select("free_shipping_enabled, free_shipping_threshold").eq("id", 1).maybeSingle(),
  ]);

  // A missing row is not an error (maybeSingle resolves data: null for that) —
  // but a genuine query failure (network, RLS misconfiguration, outage) must
  // propagate as an error, not silently collapse into "state not configured".
  // Conflating the two would hide a real production incident behind what
  // looks like ordinary, expected checkout behavior.
  if (rateError) {
    throw new Error(`SHIPPING_RATE_LOOKUP_FAILED: ${rateError.message}`);
  }
  if (settingsError) {
    throw new Error(`SHIPPING_SETTINGS_LOOKUP_FAILED: ${settingsError.message}`);
  }

  return {
    charge: (rate as Database['public']['Tables']['shipping_rates']['Row'] | null)?.charge ?? null,
    freeShippingEnabled: (settings as Database['public']['Tables']['shipping_settings']['Row'] | null)?.free_shipping_enabled ?? false,
    freeShippingThreshold: (settings as Database['public']['Tables']['shipping_settings']['Row'] | null)?.free_shipping_threshold ?? null,
  };
}

export function resolveShippingCharge(subtotal: number, quote: ShippingQuote): number | null {
  if (quote.charge === null) return null;
  if (quote.freeShippingEnabled && quote.freeShippingThreshold != null && subtotal >= quote.freeShippingThreshold) {
    return 0;
  }
  return quote.charge;
}
