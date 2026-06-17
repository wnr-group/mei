import { describe, it, expect, vi, beforeEach } from "vitest";

// Make unstable_cache a pass-through so cached fns run directly in tests
vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  revalidateTag: vi.fn(),
}));

import { _mapDbRowToCategory } from "../categories";

const baseRow = (o: Record<string, unknown> = {}) => ({
  id: "cat1",
  name: "Lehengas",
  slug: "lehengas",
  description: "Traditional Indian bridal wear.",
  image_url: "/img/lehengas.png",
  subtitle: "Premium collection",
  is_active: true,
  sort_order: 1,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
  ...o,
});

describe("_mapDbRowToCategory", () => {
  it("maps a row with all fields", () => {
    const row = baseRow();
    const cat = _mapDbRowToCategory(row);
    expect(cat.id).toBe("cat1");
    expect(cat.name).toBe("Lehengas");
    expect(cat.slug).toBe("lehengas");
    expect(cat.description).toBe("Traditional Indian bridal wear.");
    expect(cat.image_url).toBe("/img/lehengas.png");
    expect(cat.subtitle).toBe("Premium collection");
    expect(cat.is_active).toBe(true);
    expect(cat.sort_order).toBe(1);
  });

  it("handles null optional fields", () => {
    const row = baseRow({
      description: null,
      image_url: null,
      subtitle: null,
    });
    const cat = _mapDbRowToCategory(row);
    expect(cat.description).toBeNull();
    expect(cat.image_url).toBeNull();
    expect(cat.subtitle).toBeNull();
  });

  it("preserves all required fields", () => {
    const row = baseRow({
      name: "Sarees",
      slug: "sarees",
      is_active: false,
      sort_order: 5,
    });
    const cat = _mapDbRowToCategory(row);
    expect(cat.name).toBe("Sarees");
    expect(cat.slug).toBe("sarees");
    expect(cat.is_active).toBe(false);
    expect(cat.sort_order).toBe(5);
  });

  it("preserves Supabase image_url values", () => {
    const url =
      "https://example.supabase.co/storage/v1/object/public/category-images/lehengas.jpg";

    const cat = _mapDbRowToCategory(
      baseRow({ image_url: url })
    );

    expect(cat.image_url).toBe(url);
  });
});

// --- Service-level tests ---
import { createClient } from "@supabase/supabase-js";
import { getCategories, getCategoryBySlug } from "../categories";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

// Build a fluent Supabase mock chain that resolves at the terminal method
function makeChain(result: { data: unknown; error: null | { message: string; code?: string } }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq    = vi.fn(self);
  chain.is    = vi.fn(self);
  chain.order = vi.fn(self);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  return chain;
}

const fullCategoryRow = {
  id: "cat1",
  name: "Lehengas",
  slug: "lehengas",
  description: "Traditional Indian bridal wear.",
  image_url: "/img/lehengas.png",
  subtitle: "Premium collection",
  is_active: true,
  sort_order: 1,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Set env vars required by getServiceClient
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
});

describe("getCategories", () => {
  it("queries the categories table with active and non-deleted filters", async () => {
    const chain = makeChain({ data: [fullCategoryRow], error: null });
    chain.order = vi.fn().mockResolvedValue({ data: [fullCategoryRow], error: null });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as any);

    const result = await getCategories();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("cat1");
    expect(result[0].name).toBe("Lehengas");
    expect(chain.eq).toHaveBeenCalledWith("is_active", true);
    expect(chain.is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("throws (and logs) on Supabase error", async () => {
    const chain = makeChain({ data: null, error: { message: "DB error" } });
    chain.order = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as any);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(getCategories()).rejects.toMatchObject({ message: "DB error" });
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[CategoriesService:getCategories]"),
      expect.anything()
    );
    consoleSpy.mockRestore();
  });
});

describe("getCategoryBySlug", () => {
  it("returns a mapped category when found", async () => {
    const chain = makeChain({ data: fullCategoryRow, error: null });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as any);

    const cat = await getCategoryBySlug("lehengas");
    expect(cat).not.toBeNull();
    expect(cat!.slug).toBe("lehengas");
    expect(cat!.name).toBe("Lehengas");
    expect(chain.eq).toHaveBeenCalledWith("slug", "lehengas");
    expect(chain.eq).toHaveBeenCalledWith("is_active", true);
  });

  it("returns null when not found", async () => {
    const chain = makeChain({ data: null, error: null });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as any);

    const cat = await getCategoryBySlug("nonexistent");
    expect(cat).toBeNull();
  });

  it("throws on Supabase error", async () => {
    const chain = makeChain({ data: null, error: { message: "Query failed" } });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as any);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(getCategoryBySlug("x")).rejects.toMatchObject({ message: "Query failed" });
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[CategoriesService:getCategoryBySlug]"),
      expect.anything()
    );
    consoleSpy.mockRestore();
  });
});
