import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveShippingCharge } from "../shipping";

describe("resolveShippingCharge", () => {
  it("returns null when no rate is configured for the state", () => {
    const result = resolveShippingCharge(1000, { charge: null, freeShippingEnabled: false, freeShippingThreshold: null });
    expect(result).toBeNull();
  });

  it("returns the flat state charge when free shipping is disabled", () => {
    const result = resolveShippingCharge(1000, { charge: 300, freeShippingEnabled: false, freeShippingThreshold: 5000 });
    expect(result).toBe(300);
  });

  it("returns the flat state charge when subtotal is below the threshold", () => {
    const result = resolveShippingCharge(4999, { charge: 300, freeShippingEnabled: true, freeShippingThreshold: 5000 });
    expect(result).toBe(300);
  });

  it("returns 0 when free shipping is enabled and subtotal meets the threshold", () => {
    const result = resolveShippingCharge(5000, { charge: 300, freeShippingEnabled: true, freeShippingThreshold: 5000 });
    expect(result).toBe(0);
  });

  it("returns the flat charge when free shipping is enabled but threshold is null", () => {
    const result = resolveShippingCharge(100000, { charge: 300, freeShippingEnabled: true, freeShippingThreshold: null });
    expect(result).toBe(300);
  });
});

// --- getShippingQuote (I/O) ---
import { createClient } from "@supabase/supabase-js";
import { getShippingQuote } from "../shipping";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

function makeChain(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue(result),
      })),
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
});

describe("getShippingQuote", () => {
  it("returns the charge and free-shipping settings for a configured state", async () => {
    const rateChain = makeChain({ data: { charge: 300 }, error: null });
    const settingsChain = makeChain({ data: { free_shipping_enabled: true, free_shipping_threshold: 5000 }, error: null });
    const fromMock = vi.fn((table: string) => (table === "shipping_rates" ? rateChain : settingsChain));
    vi.mocked(createClient).mockReturnValue({ from: fromMock } as unknown as ReturnType<typeof createClient>);

    const quote = await getShippingQuote("Tamil Nadu");
    expect(quote).toEqual({ charge: 300, freeShippingEnabled: true, freeShippingThreshold: 5000 });
  });

  it("returns charge: null when the state has no configured rate", async () => {
    const rateChain = makeChain({ data: null, error: null });
    const settingsChain = makeChain({ data: { free_shipping_enabled: true, free_shipping_threshold: 5000 }, error: null });
    const fromMock = vi.fn((table: string) => (table === "shipping_rates" ? rateChain : settingsChain));
    vi.mocked(createClient).mockReturnValue({ from: fromMock } as unknown as ReturnType<typeof createClient>);

    const quote = await getShippingQuote("Nonexistent State");
    expect(quote.charge).toBeNull();
  });

  it("defaults free shipping to disabled when the settings row is missing", async () => {
    const rateChain = makeChain({ data: { charge: 300 }, error: null });
    const settingsChain = makeChain({ data: null, error: null });
    const fromMock = vi.fn((table: string) => (table === "shipping_rates" ? rateChain : settingsChain));
    vi.mocked(createClient).mockReturnValue({ from: fromMock } as unknown as ReturnType<typeof createClient>);

    const quote = await getShippingQuote("Tamil Nadu");
    expect(quote.freeShippingEnabled).toBe(false);
    expect(quote.freeShippingThreshold).toBeNull();
  });

  it("throws when the shipping_rates query itself errors, instead of treating it as an unconfigured state", async () => {
    const rateChain = makeChain({ data: null, error: { message: "connection timeout" } });
    const settingsChain = makeChain({ data: { free_shipping_enabled: true, free_shipping_threshold: 5000 }, error: null });
    const fromMock = vi.fn((table: string) => (table === "shipping_rates" ? rateChain : settingsChain));
    vi.mocked(createClient).mockReturnValue({ from: fromMock } as unknown as ReturnType<typeof createClient>);

    await expect(getShippingQuote("Tamil Nadu")).rejects.toThrow(/SHIPPING_RATE_LOOKUP_FAILED/);
  });

  it("throws when the shipping_settings query itself errors", async () => {
    const rateChain = makeChain({ data: { charge: 300 }, error: null });
    const settingsChain = makeChain({ data: null, error: { message: "connection timeout" } });
    const fromMock = vi.fn((table: string) => (table === "shipping_rates" ? rateChain : settingsChain));
    vi.mocked(createClient).mockReturnValue({ from: fromMock } as unknown as ReturnType<typeof createClient>);

    await expect(getShippingQuote("Tamil Nadu")).rejects.toThrow(/SHIPPING_SETTINGS_LOOKUP_FAILED/);
  });
});
