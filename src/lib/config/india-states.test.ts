import { describe, it, expect } from "vitest";
import { INDIAN_STATES } from "./india-states";

describe("INDIAN_STATES", () => {
  it("contains no duplicate entries", () => {
    expect(new Set(INDIAN_STATES).size).toBe(INDIAN_STATES.length);
  });

  it("includes every state pre-seeded by the admin's shipping_rates migration", () => {
    const preSeeded = ["Tamil Nadu", "Maharashtra", "Karnataka", "Delhi", "Telangana", "Kerala", "Andhra Pradesh"];
    preSeeded.forEach((state) => expect(INDIAN_STATES).toContain(state));
  });

  it("includes the checkout page's default state", () => {
    expect(INDIAN_STATES).toContain("Maharashtra");
  });

  it("has 29 entries (28 states plus Delhi NCT)", () => {
    expect(INDIAN_STATES.length).toBe(29);
  });
});
