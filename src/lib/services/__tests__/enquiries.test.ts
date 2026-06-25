import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createEnquiry } from "../enquiries";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

function makeInsertChain(result: {
  error: null | { message: string; code?: string };
}) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.insert = vi.fn().mockResolvedValue(result);
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
  it("trims all string fields and inserts with status NEW", async () => {
    const chain = makeInsertChain({ error: null });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as unknown as ReturnType<typeof createClient>);

    await createEnquiry(validInput);

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
    const chain = makeInsertChain({ error: null });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as unknown as ReturnType<typeof createClient>);

    await createEnquiry({ ...validInput, phone: "  ", occasion: "", budget: "" });

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ phone: null, occasion: null, budget: null })
    );
  });

  it("throws (and logs) on Supabase error", async () => {
    const chain = makeInsertChain({ error: { message: "Insert failed" } });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as unknown as ReturnType<typeof createClient>);

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(createEnquiry(validInput)).rejects.toMatchObject({ message: "Insert failed" });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("[EnquiriesService:createEnquiry]"),
      expect.anything()
    );
    spy.mockRestore();
  });

  it("passes measurements through to insert when provided", async () => {
    const chain = makeInsertChain({ error: null });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as unknown as ReturnType<typeof createClient>);

    const measurements = { bust: "34in", waist: "26in", hip: "36in", shoulder: "14in", length: "42in", sleeve: "24in" };
    await createEnquiry({ ...validInput, measurements });

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ measurements })
    );
  });

  it("passes null measurements when not provided", async () => {
    const chain = makeInsertChain({ error: null });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as unknown as ReturnType<typeof createClient>);

    await createEnquiry(validInput);

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ measurements: null })
    );
  });

  it("passes reference_images through to insert when referenceImages provided", async () => {
    const chain = makeInsertChain({ error: null });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as unknown as ReturnType<typeof createClient>);

    const referenceImages = ["https://example.com/img1.jpg", "https://example.com/img2.jpg"];
    await createEnquiry({ ...validInput, referenceImages });

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ reference_images: referenceImages })
    );
  });

  it("passes null reference_images when referenceImages not provided", async () => {
    const chain = makeInsertChain({ error: null });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as unknown as ReturnType<typeof createClient>);

    await createEnquiry(validInput);

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ reference_images: null })
    );
  });
});
