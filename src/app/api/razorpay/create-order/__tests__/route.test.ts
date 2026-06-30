import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@supabase/supabase-js";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/razorpay/create-order", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeSupabaseClient(result: { data: unknown; error: unknown }) {
  const inFn = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ in: inFn }));
  const from = vi.fn(() => ({ select }));
  return { from };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS = "false";
});

describe("POST /api/razorpay/create-order", () => {
  it("returns 400 with EMPTY_CART when items array is empty", async () => {
    const res = await POST(makeRequest({ items: [] }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "EMPTY_CART" });
  });

  it("returns 500 with PRODUCT_LOOKUP_FAILED when Supabase query errors", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseClient({ data: null, error: { message: "db error" } }) as unknown as ReturnType<typeof createClient>
    );
    const res = await POST(makeRequest({ items: [{ product_id: "p1", quantity: 1 }] }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "PRODUCT_LOOKUP_FAILED" });
  });

  it("returns 400 with PRODUCT_NOT_FOUND when product id has no price", async () => {
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseClient({ data: [], error: null }) as unknown as ReturnType<typeof createClient>
    );
    const res = await POST(makeRequest({ items: [{ product_id: "unknown", quantity: 1 }] }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "PRODUCT_NOT_FOUND" });
  });

  it("returns bypass order when NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS is true", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS", "true");
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseClient({ data: [{ id: "p1", price: 1000 }], error: null }) as unknown as ReturnType<typeof createClient>
    );
    const res = await POST(makeRequest({ items: [{ product_id: "p1", quantity: 1 }] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bypass).toBe(true);
    expect(body.razorpay_order_id).toMatch(/^bypass_/);
    expect(body.currency).toBe("INR");
    expect(typeof body.amount).toBe("number");
  });

  it("returns 502 with RAZORPAY_ORDER_FAILED when Razorpay API returns non-ok", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS", "false");
    vi.stubEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID", "rzp_test_key");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "test_secret");
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseClient({ data: [{ id: "p1", price: 1000 }], error: null }) as unknown as ReturnType<typeof createClient>
    );
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      text: async () => "Unauthorized",
    } as unknown as Response);
    const res = await POST(makeRequest({ items: [{ product_id: "p1", quantity: 1 }] }));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "RAZORPAY_ORDER_FAILED" });
  });

  it("returns razorpay order data on success", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_PAYMENT_BYPASS", "false");
    vi.stubEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID", "rzp_test_key");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "test_secret");
    vi.mocked(createClient).mockReturnValue(
      makeSupabaseClient({ data: [{ id: "p1", price: 1000 }], error: null }) as unknown as ReturnType<typeof createClient>
    );
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "order_abc123", amount: 100000, currency: "INR" }),
    } as unknown as Response);
    const res = await POST(makeRequest({ items: [{ product_id: "p1", quantity: 1 }] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.razorpay_order_id).toBe("order_abc123");
    expect(body.amount).toBe(100000);
    expect(body.currency).toBe("INR");
    expect(body.key_id).toBe("rzp_test_key");
    expect(body.bypass).toBeUndefined();
  });
});
