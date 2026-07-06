import { describe, it, expect, vi, beforeEach } from "vitest";
import { createOrder } from "../orders";
import type { CreateOrderInput } from "../orders";

const mockInvoke = vi.fn();

vi.mock("@supabase/functions-js", () => ({
  // Must use `function`, not arrow, so `new FunctionsClient()` works.
  FunctionsClient: vi.fn().mockImplementation(function () {
    return { invoke: mockInvoke };
  }),
}));

const validInput: CreateOrderInput = {
  customer: {
    name: "Priya Sharma",
    email: "priya@example.com",
    phone: "+91 98765 43210",
    city: "Mumbai",
  },
  items: [{ product_id: "prod-uuid-1", name: "Bridal Lehenga", quantity: 1 }],
  shipping_address: {
    addressLine1: "12 Marine Drive",
    addressLine2: "",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
    country: "India",
  },
  payment: {
    provider: "razorpay",
    payment_id: "pay_test_001",
    order_id: "order_test_001",
    signature: "sig_test_001",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  delete process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL;
});

describe("createOrder", () => {
  it("invokes create-order with the full input as body and an x-request-id header", async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, order_id: "uuid-1", order_number: "#ORD-9000", total: 120000 },
      error: null,
    });

    await createOrder(validInput);

    expect(mockInvoke).toHaveBeenCalledWith(
      "create-order",
      expect.objectContaining({
        body: validInput,
        headers: expect.objectContaining({ "x-request-id": expect.any(String) }),
      })
    );
  });

  it("returns mapped orderId, orderNumber, and total on success", async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, order_id: "uuid-1", order_number: "#ORD-9042", total: 120000 },
      error: null,
    });

    const result = await createOrder(validInput);

    expect(result).toEqual({
      orderId: "uuid-1",
      orderNumber: "#ORD-9042",
      total: 120000,
    });
  });

  it("throws and logs when invoke returns a transport-level error", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: "Network error" } });

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(createOrder(validInput)).rejects.toMatchObject({ message: "Network error" });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("[OrdersService:createOrder]"),
      expect.anything()
    );
    spy.mockRestore();
  });

  it("throws with the error code when Edge Function returns success:false", async () => {
    mockInvoke.mockResolvedValue({
      data: { success: false, error: "PAYMENT_VERIFICATION_FAILED" },
      error: null,
    });

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(createOrder(validInput)).rejects.toThrow("PAYMENT_VERIFICATION_FAILED");
    spy.mockRestore();
  });

  it("generates a unique x-request-id for each call", async () => {
    mockInvoke.mockResolvedValue({
      data: { success: true, order_id: "uuid-1", order_number: "#ORD-9000", total: 5000 },
      error: null,
    });

    await createOrder(validInput);
    await createOrder(validInput);

    const id1 = mockInvoke.mock.calls[0][1].headers["x-request-id"];
    const id2 = mockInvoke.mock.calls[1][1].headers["x-request-id"];
    expect(id1).not.toBe(id2);
  });

  it("uses NEXT_PUBLIC_SUPABASE_FUNCTIONS_ANON_KEY when set (local dev)", async () => {
    const { FunctionsClient } = await import("@supabase/functions-js");
    process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_ANON_KEY = "local-anon-key";
    mockInvoke.mockResolvedValue({
      data: { success: true, order_id: "uuid-1", order_number: "#ORD-1", total: 0 },
      error: null,
    });

    await createOrder(validInput);

    expect(FunctionsClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.objectContaining({ apikey: "local-anon-key" }) })
    );
  });

  it("falls back to NEXT_PUBLIC_SUPABASE_ANON_KEY when functions key is absent", async () => {
    const { FunctionsClient } = await import("@supabase/functions-js");
    mockInvoke.mockResolvedValue({
      data: { success: true, order_id: "uuid-1", order_number: "#ORD-1", total: 0 },
      error: null,
    });

    await createOrder(validInput);

    expect(FunctionsClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.objectContaining({ apikey: "test-anon-key" }) })
    );
  });
});
