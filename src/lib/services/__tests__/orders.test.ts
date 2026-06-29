import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createOrder } from "../orders";
import type { CreateOrderInput } from "../orders";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
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

function makeInvokeClient(result: { data: unknown; error: unknown }) {
  const invoke = vi.fn().mockResolvedValue(result);
  return { functions: { invoke } };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
});

describe("createOrder", () => {
  it("invokes create-order with the full input as body and an x-request-id header", async () => {
    const client = makeInvokeClient({
      data: { success: true, order_id: "uuid-1", order_number: "#ORD-9000", total: 120000 },
      error: null,
    });
    vi.mocked(createClient).mockReturnValue(
      client as unknown as ReturnType<typeof createClient>
    );

    await createOrder(validInput);

    expect(client.functions.invoke).toHaveBeenCalledWith(
      "create-order",
      expect.objectContaining({
        body: validInput,
        headers: expect.objectContaining({ "x-request-id": expect.any(String) }),
      })
    );
  });

  it("returns mapped orderId, orderNumber, and total on success", async () => {
    const client = makeInvokeClient({
      data: { success: true, order_id: "uuid-1", order_number: "#ORD-9042", total: 120000 },
      error: null,
    });
    vi.mocked(createClient).mockReturnValue(
      client as unknown as ReturnType<typeof createClient>
    );

    const result = await createOrder(validInput);

    expect(result).toEqual({
      orderId: "uuid-1",
      orderNumber: "#ORD-9042",
      total: 120000,
    });
  });

  it("throws and logs when invoke returns a transport-level error", async () => {
    const client = makeInvokeClient({ data: null, error: { message: "Network error" } });
    vi.mocked(createClient).mockReturnValue(
      client as unknown as ReturnType<typeof createClient>
    );

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(createOrder(validInput)).rejects.toMatchObject({ message: "Network error" });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("[OrdersService:createOrder]"),
      expect.anything()
    );
    spy.mockRestore();
  });

  it("throws with the error code when Edge Function returns success:false", async () => {
    const client = makeInvokeClient({
      data: { success: false, error: "PAYMENT_VERIFICATION_FAILED" },
      error: null,
    });
    vi.mocked(createClient).mockReturnValue(
      client as unknown as ReturnType<typeof createClient>
    );

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(createOrder(validInput)).rejects.toThrow("PAYMENT_VERIFICATION_FAILED");
    spy.mockRestore();
  });

  it("generates a unique x-request-id for each call", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { success: true, order_id: "uuid-1", order_number: "#ORD-9000", total: 5000 },
      error: null,
    });
    vi.mocked(createClient).mockReturnValue(
      { functions: { invoke } } as unknown as ReturnType<typeof createClient>
    );

    await createOrder(validInput);
    await createOrder(validInput);

    const id1 = invoke.mock.calls[0][1].headers["x-request-id"];
    const id2 = invoke.mock.calls[1][1].headers["x-request-id"];
    expect(id1).not.toBe(id2);
  });
});
