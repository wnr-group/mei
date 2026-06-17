import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/services/enquiries", () => ({
  createEnquiry: vi.fn(),
}));

import { submitEnquiry } from "../actions";
import { createEnquiry } from "@/lib/services/enquiries";

const validData = {
  name: "Priya Sharma",
  email: "priya@example.com",
  phone: "+91 98765 43210",
  occasion: "bridal",
  budget: "2l-3l",
  message: "Looking for a bridal lehenga.",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("submitEnquiry", () => {
  it("returns success when createEnquiry resolves", async () => {
    vi.mocked(createEnquiry).mockResolvedValue({ id: "enq-1" });

    const result = await submitEnquiry(validData);

    expect(result).toEqual({ success: true });
    expect(createEnquiry).toHaveBeenCalledWith(validData);
  });

  it("returns failure when createEnquiry throws", async () => {
    vi.mocked(createEnquiry).mockRejectedValue(new Error("DB error"));

    const result = await submitEnquiry(validData);

    expect(result).toEqual({
      success: false,
      error: "Something went wrong. Please try again.",
    });
  });

  it("returns validation error and skips service when name is whitespace", async () => {
    const result = await submitEnquiry({ ...validData, name: "   " });
    expect(result).toEqual({ success: false, error: "Name is required." });
    expect(createEnquiry).not.toHaveBeenCalled();
  });

  it("returns validation error when email is empty", async () => {
    const result = await submitEnquiry({ ...validData, email: "" });
    expect(result).toEqual({ success: false, error: "Email is required." });
    expect(createEnquiry).not.toHaveBeenCalled();
  });

  it("returns validation error for malformed email", async () => {
    const result = await submitEnquiry({ ...validData, email: "not-an-email" });
    expect(result).toEqual({ success: false, error: "Invalid email format." });
    expect(createEnquiry).not.toHaveBeenCalled();
  });

  it("returns validation error when phone is empty", async () => {
    const result = await submitEnquiry({ ...validData, phone: "" });
    expect(result).toEqual({ success: false, error: "Phone number is required." });
    expect(createEnquiry).not.toHaveBeenCalled();
  });

  it("returns validation error when occasion is empty", async () => {
    const result = await submitEnquiry({ ...validData, occasion: "" });
    expect(result).toEqual({ success: false, error: "Please select an occasion." });
    expect(createEnquiry).not.toHaveBeenCalled();
  });

  it("returns validation error when budget is empty", async () => {
    const result = await submitEnquiry({ ...validData, budget: "" });
    expect(result).toEqual({ success: false, error: "Please select a budget range." });
    expect(createEnquiry).not.toHaveBeenCalled();
  });
});
