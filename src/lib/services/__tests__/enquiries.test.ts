import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createEnquiry } from "../enquiries";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

function makeInsertChain(result: {
  data: { id: string } | null;
  error: null | { message: string; code?: string };
}) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;
  chain.insert = vi.fn(self);
  chain.select = vi.fn(self);
  chain.single = vi.fn().mockResolvedValue(result);
  return chain;
}

const validInput = {
  name: "  Priya Sharma  ",
  email: "  priya@example.com  ",
  phone: "+91 98765 43210",
  occasion: "bridal",
  budget: "2l-3l",
  message: "  Looking for a red bridal lehenga with Zardosi work.  ",
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
});

describe("createEnquiry", () => {
  it("trims all string fields and inserts with status NEW, returns id", async () => {
    const chain = makeInsertChain({ data: { id: "enq-1" }, error: null });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as any);

    const result = await createEnquiry(validInput);

    expect(result).toEqual({ id: "enq-1" });
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Priya Sharma",
        email: "priya@example.com",
        message: "Looking for a red bridal lehenga with Zardosi work.",
        status: "NEW",
      })
    );
  });

  it("coerces empty-string optional fields to null", async () => {
    const chain = makeInsertChain({ data: { id: "enq-2" }, error: null });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as any);

    await createEnquiry({ ...validInput, phone: "  ", occasion: "", budget: "" });

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ phone: null, occasion: null, budget: null })
    );
  });

  it("throws (and logs) on Supabase error", async () => {
    const chain = makeInsertChain({ data: null, error: { message: "Insert failed" } });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as any);

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(createEnquiry(validInput)).rejects.toMatchObject({ message: "Insert failed" });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("[EnquiriesService:createEnquiry]"),
      expect.anything()
    );
    spy.mockRestore();
  });
});
