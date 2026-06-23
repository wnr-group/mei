import { describe, it, expect } from "vitest";
import {
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FLAT_RATE,
  calculateShipping,
  getRemainingForFreeShipping,
} from "./shipping";

describe("shipping constants", () => {
  it("exports the correct threshold", () => {
    expect(FREE_SHIPPING_THRESHOLD).toBe(5000);
  });

  it("exports the correct flat rate", () => {
    expect(SHIPPING_FLAT_RATE).toBe(150);
  });
});

describe("calculateShipping", () => {
  it("returns flat rate when subtotal is zero", () => {
    expect(calculateShipping(0)).toBe(150);
  });

  it("returns flat rate when subtotal is below threshold", () => {
    expect(calculateShipping(1000)).toBe(150);
    expect(calculateShipping(4999)).toBe(150);
  });

  it("returns flat rate just below threshold (decimal boundary)", () => {
    expect(calculateShipping(4999.99)).toBe(150);
  });

  it("returns 0 when subtotal equals the threshold exactly", () => {
    expect(calculateShipping(5000)).toBe(0);
  });

  it("returns 0 just above threshold (decimal boundary)", () => {
    expect(calculateShipping(5000.01)).toBe(0);
  });

  it("returns 0 when subtotal is well above threshold", () => {
    expect(calculateShipping(100000)).toBe(0);
  });
});

describe("getRemainingForFreeShipping", () => {
  it("returns the full threshold when cart is empty", () => {
    expect(getRemainingForFreeShipping(0)).toBe(5000);
  });

  it("returns the correct remaining amount when below threshold", () => {
    expect(getRemainingForFreeShipping(3000)).toBe(2000);
    expect(getRemainingForFreeShipping(4999)).toBe(1);
  });

  it("returns 0 when subtotal equals threshold", () => {
    expect(getRemainingForFreeShipping(5000)).toBe(0);
  });

  it("returns 0 when subtotal exceeds threshold", () => {
    expect(getRemainingForFreeShipping(6000)).toBe(0);
    expect(getRemainingForFreeShipping(100000)).toBe(0);
  });
});
