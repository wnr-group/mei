import { describe, it, expect, vi, beforeEach } from "vitest";
import { getOrderById } from "../orders-server";
import type { OrderDetail } from "../orders-server";

const mockMaybeSingle = vi.fn();
const mockChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: mockMaybeSingle,
};
const mockFrom = vi.fn().mockReturnValue(mockChain);

vi.mock("@/lib/supabase/service-client", () => ({
  createServiceClient: vi.fn(() => ({ from: mockFrom })),
}));

const SAMPLE_ROW = {
  id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  order_number: "#ORD-9001",
  status: "PENDING",
  total: 120000,
  payment_id: "pay_OOPg4VwMCkXKWT",
  payment_provider: "razorpay",
  payment_metadata: {
    razorpay_order_id: "order_OOPg4test123",
    razorpay_signature: "should_never_appear_on_page",
    request_id: "req-uuid-123",
  },
  shipping_address: {
    addressLine1: "12 Marine Drive",
    addressLine2: "Apt 3B",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
    country: "India",
  },
  created_at: "2026-07-03T10:00:00Z",
  deleted_at: null,
  customers: {
    name: "Priya Sharma",
    email: "priya@example.com",
    phone: "+91 98765 43210",
    city: "Mumbai",
  },
  order_items: [
    { id: "item-uuid-1", product_name: "Bridal Lehenga", quantity: 1, unit_price: 120000 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getOrderById", () => {
  it("returns a mapped OrderDetail on success", async () => {
    mockMaybeSingle.mockResolvedValue({ data: SAMPLE_ROW, error: null });

    const result = await getOrderById("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

    const expected: OrderDetail = {
      id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      order_number: "#ORD-9001",
      status: "PENDING",
      total: 120000,
      payment_id: "pay_OOPg4VwMCkXKWT",
      payment_provider: "razorpay",
      payment_metadata: {
        razorpay_order_id: "order_OOPg4test123",
        request_id: "req-uuid-123",
      },
      shipping_address: {
        addressLine1: "12 Marine Drive",
        addressLine2: "Apt 3B",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        country: "India",
      },
      created_at: "2026-07-03T10:00:00Z",
      customer: {
        name: "Priya Sharma",
        email: "priya@example.com",
        phone: "+91 98765 43210",
        city: "Mumbai",
      },
      items: [{ id: "item-uuid-1", product_name: "Bridal Lehenga", quantity: 1, unit_price: 120000, color_label: null }],
    };
    expect(result).toEqual(expected);
  });

  it("excludes razorpay_signature from payment_metadata", async () => {
    mockMaybeSingle.mockResolvedValue({ data: SAMPLE_ROW, error: null });

    const result = await getOrderById("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

    expect(result?.payment_metadata).not.toHaveProperty("razorpay_signature");
  });

  it("returns null when order is not found", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await getOrderById("nonexistent-uuid");

    expect(result).toBeNull();
  });

  it("returns null when order is soft-deleted", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { ...SAMPLE_ROW, deleted_at: "2026-07-03T12:00:00Z" },
      error: null,
    });

    const result = await getOrderById("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

    expect(result).toBeNull();
  });

  it("throws and logs when Supabase returns a database error", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "DB connection refused" } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(getOrderById("some-uuid")).rejects.toMatchObject({ message: "DB connection refused" });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("[OrdersService:getOrderById]"),
      expect.anything()
    );
    spy.mockRestore();
  });

  it("queries the orders table using the provided UUID", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    await getOrderById("target-uuid-456");

    expect(mockFrom).toHaveBeenCalledWith("orders");
    expect(mockChain.eq).toHaveBeenCalledWith("id", "target-uuid-456");
  });

  it("returns null customer when customers join is null", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { ...SAMPLE_ROW, customers: null, order_items: [] },
      error: null,
    });

    const result = await getOrderById("some-uuid");

    expect(result?.customer).toBeNull();
    expect(result?.items).toEqual([]);
  });

  it("handles null shipping_address", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { ...SAMPLE_ROW, shipping_address: null },
      error: null,
    });

    const result = await getOrderById("some-uuid");

    expect(result?.shipping_address).toBeNull();
  });

  it("handles null payment_metadata", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { ...SAMPLE_ROW, payment_id: null, payment_provider: null, payment_metadata: null },
      error: null,
    });

    const result = await getOrderById("some-uuid");

    expect(result?.payment_id).toBeNull();
    expect(result?.payment_metadata).toBeNull();
  });
});
