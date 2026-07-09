import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";

vi.mock("@/lib/services/shipping", () => ({
  getShippingQuote: vi.fn(),
  resolveShippingCharge: vi.fn(),
}));

import { getShippingQuote, resolveShippingCharge } from "@/lib/services/shipping";

function makeRequest(query: string) {
  return new NextRequest(`http://localhost/api/shipping/rate${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/shipping/rate", () => {
  it("returns 400 with STATE_REQUIRED when state query param is missing", async () => {
    const res = await GET(makeRequest(""));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "STATE_REQUIRED" });
  });

  it("returns the resolved shipping charge for a configured state", async () => {
    vi.mocked(getShippingQuote).mockResolvedValue({ charge: 300, freeShippingEnabled: false, freeShippingThreshold: null });
    vi.mocked(resolveShippingCharge).mockReturnValue(300);

    const res = await GET(makeRequest("?state=Tamil%20Nadu&subtotal=1000"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ shipping: 300 });
    expect(getShippingQuote).toHaveBeenCalledWith("Tamil Nadu");
    expect(resolveShippingCharge).toHaveBeenCalledWith(1000, { charge: 300, freeShippingEnabled: false, freeShippingThreshold: null });
  });

  it("returns shipping: null for an unconfigured state", async () => {
    vi.mocked(getShippingQuote).mockResolvedValue({ charge: null, freeShippingEnabled: false, freeShippingThreshold: null });
    vi.mocked(resolveShippingCharge).mockReturnValue(null);

    const res = await GET(makeRequest("?state=Nonexistent"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ shipping: null });
  });

  it("treats a missing subtotal as 0", async () => {
    vi.mocked(getShippingQuote).mockResolvedValue({ charge: 300, freeShippingEnabled: true, freeShippingThreshold: 5000 });
    vi.mocked(resolveShippingCharge).mockReturnValue(300);

    await GET(makeRequest("?state=Tamil%20Nadu"));
    expect(resolveShippingCharge).toHaveBeenCalledWith(0, expect.anything());
  });

  it("clamps a non-numeric subtotal to 0 instead of passing NaN through", async () => {
    vi.mocked(getShippingQuote).mockResolvedValue({ charge: 300, freeShippingEnabled: true, freeShippingThreshold: 5000 });
    vi.mocked(resolveShippingCharge).mockReturnValue(300);

    await GET(makeRequest("?state=Tamil%20Nadu&subtotal=not-a-number"));
    expect(resolveShippingCharge).toHaveBeenCalledWith(0, expect.anything());
  });

  it("clamps a negative subtotal to 0", async () => {
    vi.mocked(getShippingQuote).mockResolvedValue({ charge: 300, freeShippingEnabled: true, freeShippingThreshold: 5000 });
    vi.mocked(resolveShippingCharge).mockReturnValue(300);

    await GET(makeRequest("?state=Tamil%20Nadu&subtotal=-500"));
    expect(resolveShippingCharge).toHaveBeenCalledWith(0, expect.anything());
  });

  it("returns 500 with SHIPPING_LOOKUP_FAILED when getShippingQuote throws", async () => {
    vi.mocked(getShippingQuote).mockRejectedValue(new Error("SHIPPING_RATE_LOOKUP_FAILED: connection timeout"));

    const res = await GET(makeRequest("?state=Tamil%20Nadu&subtotal=1000"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "SHIPPING_LOOKUP_FAILED" });
  });
});
