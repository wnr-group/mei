import { describe, it, expect, vi, beforeEach } from "vitest";

// Make unstable_cache a pass-through so cached fns run directly in tests
vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  revalidateTag: vi.fn(),
}));

// We'll add service-level tests in 2b after the mock chain helper is set up

import { _mapDbRowToProduct } from "../products";

const baseMedia = (o: Partial<{
  url: string; sort_order: number; is_primary: boolean; deleted_at: string | null
}> = {}) => ({
  url: "/img/test.png",
  sort_order: 0,
  is_primary: true,
  deleted_at: null,
  ...o,
});

const baseRow = (o: Record<string, unknown> = {}) => ({
  id: "p1",
  name: "Test Piece",
  slug: "test-piece",
  price: 150000,
  short_description: "Short",
  description: "Full description.",
  work_types: ["Zardosi"],
  status: "PUBLISHED" as const,
  category_id: "cat1",
  image_url: "/img/fallback.png",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
  categories: { id: "cat1", name: "Lehengas", slug: "lehengas" },
  product_media: [] as ReturnType<typeof baseMedia>[],
  ...o,
});

describe("_mapDbRowToProduct", () => {
  it("maps a row with media — images sorted ascending by sort_order", () => {
    const row = baseRow({
      product_media: [
        baseMedia({ url: "/img/second.png", sort_order: 1 }),
        baseMedia({ url: "/img/first.png", sort_order: 0 }),
      ],
    });
    const p = _mapDbRowToProduct(row);
    expect(p.id).toBe("p1");
    expect(p.images).toEqual(["/img/first.png", "/img/second.png"]);
    expect(p.image_url).toBe("/img/fallback.png");
    expect(p.category).toEqual({ id: "cat1", name: "Lehengas", slug: "lehengas" });
    expect(p.work_types).toEqual(["Zardosi"]);
    expect(p.status).toBe("PUBLISHED");
  });

  it("falls back to [image_url] when product_media is empty", () => {
    const p = _mapDbRowToProduct(baseRow({ product_media: [] }));
    expect(p.images).toEqual(["/img/fallback.png"]);
  });

  it("excludes soft-deleted media at mapper level", () => {
    const row = baseRow({
      product_media: [
        baseMedia({ url: "/img/active.png", sort_order: 0, deleted_at: null }),
        baseMedia({ url: "/img/deleted.png", sort_order: 1, deleted_at: "2026-02-01T00:00:00Z" }),
      ],
    });
    const p = _mapDbRowToProduct(row);
    expect(p.images).toEqual(["/img/active.png"]);
  });

  it("returns null category when join is null", () => {
    const p = _mapDbRowToProduct(baseRow({ categories: null, category_id: null }));
    expect(p.category).toBeNull();
    expect(p.category_id).toBeNull();
  });

  it("handles missing product_media field (undefined)", () => {
    const row = { ...baseRow(), product_media: undefined };
    const p = _mapDbRowToProduct(row as Parameters<typeof _mapDbRowToProduct>[0]);
    expect(p.images).toEqual(["/img/fallback.png"]);
  });
});

// --- Service-level tests ---
import { createClient } from "@supabase/supabase-js";
import {
  getProducts,
  getProductById,
  getProductBySlug,
  getProductsByCategory,
  getRelatedProducts,
} from "../products";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

// Build a fluent Supabase mock chain that resolves at the terminal method
function makeChain(result: { data: unknown; error: null | { message: string; code?: string } }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq    = vi.fn(self);
  chain.neq   = vi.fn(self);
  chain.is    = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  return chain;
}

const fullProductRow: Record<string, unknown> = {
  id: "p1",
  name: "Test Piece",
  slug: "test-piece",
  price: 150000,
  short_description: "Short",
  description: "Full.",
  work_types: ["Zardosi"],
  status: "PUBLISHED",
  category_id: "cat1",
  image_url: "/img/fallback.png",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
  categories: { id: "cat1", name: "Lehengas", slug: "lehengas" },
  product_media: [{ url: "/img/test.png", sort_order: 0, is_primary: true, deleted_at: null }],
};

beforeEach(() => {
  vi.clearAllMocks();
  // Set env vars required by getServiceClient
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
});

describe("getProducts", () => {
  it("queries the products table with PUBLISHED and non-deleted filters", async () => {
    const chain = makeChain({ data: [fullProductRow], error: null });
    // override limit — getProducts uses .order() as terminal when no limit
    chain.order = vi.fn().mockResolvedValue({ data: [fullProductRow], error: null });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as any);

    const result = await getProducts();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p1");
    expect(chain.eq).toHaveBeenCalledWith("status", "PUBLISHED");
    expect(chain.is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("respects a limit option", async () => {
    const rows = [fullProductRow, { ...fullProductRow, id: "p2", slug: "p2" }];
    const chain = makeChain({ data: rows, error: null });
    chain.order = vi.fn().mockResolvedValue({ data: rows, error: null });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as any);

    const result = await getProducts({ limit: 1 });
    expect(result).toHaveLength(1);
  });

  it("throws (and logs) on Supabase error", async () => {
    const chain = makeChain({ data: null, error: { message: "DB error" } });
    chain.order = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as any);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(getProducts()).rejects.toMatchObject({ message: "DB error" });
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[ProductsService:getProducts]"),
      expect.anything()
    );
    consoleSpy.mockRestore();
  });
});

describe("getProductBySlug", () => {
  it("returns a mapped product when found", async () => {
    const chain = makeChain({ data: fullProductRow, error: null });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as any);

    const p = await getProductBySlug("test-piece");
    expect(p).not.toBeNull();
    expect(p!.slug).toBe("test-piece");
    expect(chain.eq).toHaveBeenCalledWith("slug", "test-piece");
    expect(chain.eq).toHaveBeenCalledWith("status", "PUBLISHED");
  });

  it("returns null when not found", async () => {
    const chain = makeChain({ data: null, error: null });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as any);

    const p = await getProductBySlug("nonexistent");
    expect(p).toBeNull();
  });

  it("throws on Supabase error", async () => {
    const chain = makeChain({ data: null, error: { message: "Query failed" } });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as any);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(getProductBySlug("x")).rejects.toMatchObject({ message: "Query failed" });
    consoleSpy.mockRestore();
  });
});

describe("getProductById", () => {
  it("returns a product when found", async () => {
    const chain = makeChain({ data: fullProductRow, error: null });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as any);

    const p = await getProductById("p1");
    expect(p).not.toBeNull();
    expect(p!.id).toBe("p1");
    expect(chain.eq).toHaveBeenCalledWith("id", "p1");
  });

  it("returns null when not found", async () => {
    const chain = makeChain({ data: null, error: null });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as any);
    expect(await getProductById("missing")).toBeNull();
  });
});

describe("getRelatedProducts", () => {
  it("returns related products excluding the current one", async () => {
    const relatedRow = { ...fullProductRow, id: "p2", slug: "p2" };
    const chain = makeChain({ data: [relatedRow], error: null });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as any);

    const result = await getRelatedProducts("cat1", "p1", 3);
    expect(result).toHaveLength(1);
    expect(chain.eq).toHaveBeenCalledWith("category_id", "cat1");
    expect(chain.neq).toHaveBeenCalledWith("id", "p1");
    expect(chain.limit).toHaveBeenCalledWith(3);
  });

  it("returns empty array when categoryId is null", async () => {
    const result = await getRelatedProducts(null, "p1");
    expect(result).toEqual([]);
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("getProductsByCategory", () => {
  it("filters products by category slug via inner join", async () => {
    const chain = makeChain({ data: [fullProductRow], error: null });
    chain.order = vi.fn().mockResolvedValue({ data: [fullProductRow], error: null });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as any);

    const result = await getProductsByCategory("lehengas");
    expect(result).toHaveLength(1);
    expect(chain.eq).toHaveBeenCalledWith("categories.slug", "lehengas");
  });
});
