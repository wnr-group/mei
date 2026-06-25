# Storefront Real Data Integration Implementation Plan (MEI-33 Production Hardening)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all `MOCK_PRODUCTS`/`MOCK_CATEGORIES` imports with a production-ready Supabase service layer — with cache tags, observability, category routing, dynamic filters, and full error/loading states.

**Architecture:** Five async service functions per domain, wrapped in `unstable_cache` (the correct caching primitive for this project since `cacheComponents` is not enabled — see `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md`). Services use a plain Supabase client (no cookie dependency) so they can be safely called inside `unstable_cache`. Pages that require client interactivity split into a Server Component shell (fetches data) + a `"use client"` child (handles state). The mock file is preserved but removed from all app-path imports.

**Tech Stack:** Next.js 16 Server Components, `unstable_cache` + `revalidateTag` from `next/cache`, Supabase JS v2 (plain `createClient` — not SSR variant — inside service layer), Vitest, TypeScript, generated types from `@/lib/supabase/database`.

---

## File Map

| Action | Path |
|--------|------|
| Create | `src/lib/services/products.ts` |
| Create | `src/lib/services/categories.ts` |
| Create | `src/lib/services/__tests__/products.test.ts` |
| Create | `src/lib/services/__tests__/categories.test.ts` |
| Create | `vitest.config.ts` |
| Create | `src/components/shop/ShopClient.tsx` |
| Create | `src/components/product/ProductDetailClient.tsx` |
| Create | `src/app/shop/category/[slug]/page.tsx` |
| Create | `src/app/shop/category/[slug]/loading.tsx` |
| Create | `src/app/shop/category/[slug]/error.tsx` |
| Create | `src/app/shop/loading.tsx` |
| Create | `src/app/shop/[slug]/loading.tsx` |
| Create | `src/app/shop/error.tsx` |
| Create | `src/app/shop/[slug]/error.tsx` |
| Create | `src/app/error.tsx` |
| Modify | `src/app/page.tsx` |
| Modify | `src/app/shop/page.tsx` |
| Modify | `src/app/shop/[slug]/page.tsx` |

---

## Task 1: Install Vitest and configure

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest @vitejs/plugin-react
```

Expected: packages appear in `devDependencies`.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 3: Add test script to `package.json`**

In the `"scripts"` block, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify Vitest can start**

```bash
npx vitest run
```

Expected: `No test files found, exiting` with exit code 0.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json package-lock.json
git commit -m "chore: add Vitest for unit testing"
```

---

## Task 2: Products service with TDD

**Files:**
- Create: `src/lib/services/__tests__/products.test.ts`
- Create: `src/lib/services/products.ts`

**Key decisions:**
- All row types come from `Database["public"]["Tables"]["..."]["Row"]` — no manual type definitions.
- `getServiceClient()` uses plain `createClient` from `@supabase/supabase-js` (not the SSR variant) so it has no `cookies()` dependency and is safe inside `unstable_cache`.
- Each public function has its own `unstable_cache`'d inner function. `getProducts` is a thin coordinator that delegates to them.
- Every catch block logs via `console.error` before re-throwing.

### 2a: Mapper tests

- [ ] **Step 1: Write failing mapper tests**

```ts
// src/lib/services/__tests__/products.test.ts
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
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run src/lib/services/__tests__/products.test.ts
```

Expected: `FAIL` — cannot find module `../products`.

- [ ] **Step 3: Create `src/lib/services/products.ts`**

```ts
// src/lib/services/products.ts
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { Database } from "@/lib/supabase/database";
import type { Product } from "@/types";

// ── Generated DB types ─────────────────────────────────────────────────────
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type ProductMediaRow = Database["public"]["Tables"]["product_media"]["Row"];

type ProductWithRelations = ProductRow & {
  categories: Pick<CategoryRow, "id" | "name" | "slug"> | null;
  product_media:
    | Pick<
        ProductMediaRow,
        "url" | "sort_order" | "is_primary" | "deleted_at"
      >[]
    | undefined;
};

// ── Public API ─────────────────────────────────────────────────────────────

export interface GetProductsOptions {
  categorySlug?: string;
  limit?: number;
}

// ── Mapper ─────────────────────────────────────────────────────────────────

export function _mapDbRowToProduct(row: ProductWithRelations): Product {
  const activeMedia = (row.product_media ?? [])
    .filter((m) => m.deleted_at === null)
    .sort((a, b) => a.sort_order - b.sort_order);

  const images =
    activeMedia.length > 0
      ? activeMedia.map((m) => m.url)
      : row.image_url
      ? [row.image_url]
      : [];

  return {
    id: row.id,
    name: row.name,
    slug: row.slug ?? "",
    price: row.price,
    short_description: row.short_description,
    description: row.description,
    work_types: row.work_types,
    status: row.status,
    category_id: row.category_id,
    category: row.categories ?? null,
    image_url: row.image_url,
    images,
  };
}

// ── Supabase client (no cookies — safe inside unstable_cache) ──────────────

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ── Query select clause ────────────────────────────────────────────────────

const SELECT =
  "*, categories(id, name, slug), product_media(url, sort_order, is_primary, deleted_at)";

const SELECT_INNER_CAT =
  "*, categories!inner(id, name, slug), product_media(url, sort_order, is_primary, deleted_at)";

// ── Cached inner implementations ───────────────────────────────────────────

const _cachedGetAllProducts = unstable_cache(
  async (): Promise<Product[]> => {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("products")
      .select(SELECT)
      .eq("status", "PUBLISHED")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[ProductsService:getProducts]", error);
      throw error;
    }
    return (data as ProductWithRelations[]).map(_mapDbRowToProduct);
  },
  ["storefront-products"],
  { tags: ["products"], revalidate: 60 }
);

const _cachedGetProductsByCategory = unstable_cache(
  async (categorySlug: string): Promise<Product[]> => {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("products")
      .select(SELECT_INNER_CAT)
      .eq("categories.slug", categorySlug)
      .eq("status", "PUBLISHED")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[ProductsService:getProductsByCategory]", error);
      throw error;
    }
    return (data as ProductWithRelations[]).map(_mapDbRowToProduct);
  },
  ["products-by-category"],
  { tags: ["products"] }
);

const _cachedGetProductById = unstable_cache(
  async (id: string): Promise<Product | null> => {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("products")
      .select(SELECT)
      .eq("id", id)
      .eq("status", "PUBLISHED")
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      console.error("[ProductsService:getProductById]", error);
      throw error;
    }
    return data ? _mapDbRowToProduct(data as ProductWithRelations) : null;
  },
  ["product-by-id"],
  { tags: ["products"] }
);

const _cachedGetProductBySlug = unstable_cache(
  async (slug: string): Promise<Product | null> => {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("products")
      .select(SELECT)
      .eq("slug", slug)
      .eq("status", "PUBLISHED")
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      console.error("[ProductsService:getProductBySlug]", error);
      throw error;
    }
    return data ? _mapDbRowToProduct(data as ProductWithRelations) : null;
  },
  ["product-by-slug"],
  { tags: ["products"] }
);

const _cachedGetRelatedProducts = unstable_cache(
  async (
    categoryId: string,
    excludeId: string,
    limit: number
  ): Promise<Product[]> => {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("products")
      .select(SELECT)
      .eq("category_id", categoryId)
      .neq("id", excludeId)
      .eq("status", "PUBLISHED")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[ProductsService:getRelatedProducts]", error);
      throw error;
    }
    return (data as ProductWithRelations[]).map(_mapDbRowToProduct);
  },
  ["related-products"],
  { tags: ["products"] }
);

// ── Public service functions ───────────────────────────────────────────────

export async function getProducts(
  options: GetProductsOptions = {}
): Promise<Product[]> {
  if (options.categorySlug) {
    const products = await _cachedGetProductsByCategory(options.categorySlug);
    return options.limit ? products.slice(0, options.limit) : products;
  }
  const products = await _cachedGetAllProducts();
  return options.limit ? products.slice(0, options.limit) : products;
}

export async function getProductsByCategory(
  categorySlug: string
): Promise<Product[]> {
  return _cachedGetProductsByCategory(categorySlug);
}

export async function getProductById(id: string): Promise<Product | null> {
  return _cachedGetProductById(id);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  return _cachedGetProductBySlug(slug);
}

export async function getRelatedProducts(
  categoryId: string | null,
  excludeId: string,
  limit = 3
): Promise<Product[]> {
  if (!categoryId) return [];
  return _cachedGetRelatedProducts(categoryId, excludeId, limit);
}
```

- [ ] **Step 4: Run mapper tests — expect 5 pass**

```bash
npx vitest run src/lib/services/__tests__/products.test.ts
```

Expected: `5 passed`.

### 2b: Service-level tests

- [ ] **Step 5: Add service tests to the existing test file**

Append to `src/lib/services/__tests__/products.test.ts`:

```ts
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
```

- [ ] **Step 6: Run all tests — expect 15+ pass**

```bash
npx vitest run src/lib/services/__tests__/products.test.ts
```

Expected: `15 passed` (5 mapper + 10 service).

- [ ] **Step 7: Commit**

```bash
git add src/lib/services/products.ts src/lib/services/__tests__/products.test.ts
git commit -m "feat: add production-ready products service with caching, observability, and full test coverage"
```

---

## Task 3: Categories service with TDD

**Files:**
- Create: `src/lib/services/__tests__/categories.test.ts`
- Create: `src/lib/services/categories.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/services/__tests__/categories.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  revalidateTag: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@supabase/supabase-js";
import { _mapDbRowToCategory, getCategories, getCategoryBySlug } from "../categories";

const baseCatRow = (o: Record<string, unknown> = {}) => ({
  id: "cat1",
  name: "Lehengas",
  slug: "lehengas",
  subtitle: "Bridal Classics",
  description: "Handcrafted lehengas.",
  image_url: "/images/rose_lehenga.png",
  is_active: true,
  sort_order: 1,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
  ...o,
});

function makeChain(result: { data: unknown; error: null | { message: string } }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;
  chain.select    = vi.fn(self);
  chain.eq        = vi.fn(self);
  chain.is        = vi.fn(self);
  chain.order     = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
});

describe("_mapDbRowToCategory", () => {
  it("maps a full db row to Category", () => {
    const cat = _mapDbRowToCategory(baseCatRow() as any);
    expect(cat.id).toBe("cat1");
    expect(cat.name).toBe("Lehengas");
    expect(cat.slug).toBe("lehengas");
    expect(cat.subtitle).toBe("Bridal Classics");
    expect(cat.is_active).toBe(true);
    expect(cat.sort_order).toBe(1);
  });

  it("preserves null nullable fields", () => {
    const cat = _mapDbRowToCategory(
      baseCatRow({ subtitle: null, description: null, image_url: null }) as any
    );
    expect(cat.subtitle).toBeNull();
    expect(cat.description).toBeNull();
    expect(cat.image_url).toBeNull();
  });
});

describe("getCategories", () => {
  it("queries active, non-deleted categories sorted by sort_order", async () => {
    const chain = makeChain({ data: [baseCatRow()], error: null });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as any);

    const cats = await getCategories();
    expect(cats).toHaveLength(1);
    expect(cats[0].id).toBe("cat1");
    expect(chain.eq).toHaveBeenCalledWith("is_active", true);
    expect(chain.is).toHaveBeenCalledWith("deleted_at", null);
    expect(chain.order).toHaveBeenCalledWith("sort_order", { ascending: true });
  });

  it("throws (and logs) on Supabase error", async () => {
    const chain = makeChain({ data: null, error: { message: "DB error" } });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as any);

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(getCategories()).rejects.toMatchObject({ message: "DB error" });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("[CategoriesService:getCategories]"),
      expect.anything()
    );
    spy.mockRestore();
  });
});

describe("getCategoryBySlug", () => {
  it("returns a mapped category when found", async () => {
    const chain = makeChain({ data: baseCatRow(), error: null });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as any);

    const cat = await getCategoryBySlug("lehengas");
    expect(cat).not.toBeNull();
    expect(cat!.slug).toBe("lehengas");
    expect(chain.eq).toHaveBeenCalledWith("slug", "lehengas");
  });

  it("returns null when slug not found", async () => {
    const chain = makeChain({ data: null, error: null });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as any);
    expect(await getCategoryBySlug("nonexistent")).toBeNull();
  });

  it("throws on Supabase error", async () => {
    const chain = makeChain({ data: null, error: { message: "Query failed" } });
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => chain) } as any);

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(getCategoryBySlug("x")).rejects.toMatchObject({ message: "Query failed" });
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run src/lib/services/__tests__/categories.test.ts
```

Expected: `FAIL` — cannot find module `../categories`.

- [ ] **Step 3: Create `src/lib/services/categories.ts`**

```ts
// src/lib/services/categories.ts
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { Database } from "@/lib/supabase/database";
import type { Category } from "@/types";

// ── Generated DB type ──────────────────────────────────────────────────────
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

// ── Mapper ─────────────────────────────────────────────────────────────────

export function _mapDbRowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    subtitle: row.subtitle,
    description: row.description,
    image_url: row.image_url,
    is_active: row.is_active,
    sort_order: row.sort_order,
  };
}

// ── Supabase client ────────────────────────────────────────────────────────

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ── Cached inner implementations ───────────────────────────────────────────

const _cachedGetCategories = unstable_cache(
  async (): Promise<Category[]> => {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("[CategoriesService:getCategories]", error);
      throw error;
    }
    return (data as CategoryRow[]).map(_mapDbRowToCategory);
  },
  ["storefront-categories"],
  { tags: ["categories"], revalidate: 3600 }
);

const _cachedGetCategoryBySlug = unstable_cache(
  async (slug: string): Promise<Category | null> => {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      console.error("[CategoriesService:getCategoryBySlug]", error);
      throw error;
    }
    return data ? _mapDbRowToCategory(data as CategoryRow) : null;
  },
  ["category-by-slug"],
  { tags: ["categories"] }
);

// ── Public service functions ───────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
  return _cachedGetCategories();
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  return _cachedGetCategoryBySlug(slug);
}
```

- [ ] **Step 4: Run all tests — expect all pass**

```bash
npx vitest run
```

Expected: `22 passed` (15 products + 7 categories).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/categories.ts src/lib/services/__tests__/categories.test.ts
git commit -m "feat: add categories service with caching, observability, and full test coverage"
```

---

## Task 4: Convert Home page to Server Component

**Files:**
- Modify: `src/app/page.tsx`

Remove `"use client"`, make it `async`, fetch from services, add empty states for both sections, and link category cards to the new category route.

- [ ] **Step 1: Replace `src/app/page.tsx`**

```tsx
// src/app/page.tsx
import Link from "next/link";
import Image from "next/image";
import ProductCard from "@/components/shop/ProductCard";
import Button from "@/components/ui/Button";
import { getProducts } from "@/lib/services/products";
import { getCategories } from "@/lib/services/categories";

export default async function Home() {
  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts({ limit: 8 }),
  ]);

  return (
    <main className="flex-1 bg-white">
      {/* Hero Banner */}
      <section className="relative h-[85vh] w-full bg-[#1a1a1a] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/hero_lehenga.png"
            alt="MEI Bridal Couture Hero Backdrop"
            fill
            priority
            sizes="100vw"
            className="object-cover object-top opacity-65"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-white space-y-6 font-inter">
          <h1 className="text-5xl sm:text-7xl font-light tracking-wide text-white leading-tight font-cormorant max-w-2xl animate-fadeIn">
            Handcrafted Elegance
          </h1>
          <div className="flex flex-wrap gap-4 pt-4 animate-fadeIn items-center justify-center">
            <Link
              href="/shop"
              className="hover:bg-[#d4b87a] text-white border border-[#c9a465] hover:border-[#d4b87a] px-8 py-3.5 text-xs font-semibold uppercase tracking-widest transition-colors duration-300"
            >
              Shop Collection
            </Link>
          </div>
        </div>
      </section>

      {/* Category Grid */}
      <section className="py-24 bg-white border-b border-[#e8e0d5]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center">
            <h2 className="text-3xl font-light tracking-[0.15em] text-[#1a1a1a] font-cormorant uppercase">
              Shop by Category
            </h2>
          </div>

          {categories.length === 0 ? (
            <p className="text-center text-sm text-[#9a9a9a] font-inter py-8">
              No categories available at the moment.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/shop/category/${cat.slug}`}
                  className="group relative h-96 w-full overflow-hidden border border-[#e8e0d5]/40"
                >
                  <Image
                    src={cat.image_url ?? "/images/rose_lehenga.png"}
                    alt={cat.name}
                    fill
                    sizes="(max-width: 1280px) 33vw, 100vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors duration-500 flex flex-col justify-end p-6 space-y-1.5 font-inter">
                    <span className="text-xs uppercase tracking-widest text-[#c9a465] font-semibold">
                      {cat.subtitle}
                    </span>
                    <h3 className="text-xl font-light text-white uppercase tracking-wider font-cormorant">
                      {cat.name}
                    </h3>
                    <p className="text-xs text-white/70 uppercase tracking-widest font-semibold border-b border-white/40 pb-1 w-max group-hover:border-white transition-colors duration-300">
                      Explore
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured Pieces */}
      <section className="py-24 bg-[#faf8f5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-3xl font-light tracking-[0.15em] text-[#1a1a1a] font-cormorant uppercase">
              Featured Pieces
            </h2>
            <Button variant="gold" size="sm">View All</Button>
          </div>

          {products.length === 0 ? (
            <p className="text-center text-sm text-[#9a9a9a] font-inter py-12">
              No products available at the moment.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 grid-rows-2 gap-8">
              {products.map((prod) => (
                <ProductCard key={prod.id} product={prod} />
              ))}
            </div>
          )}

          <div className="text-center pt-8">
            <Link
              href="/shop"
              className="inline-block border border-[#1a1a1a] px-8 py-3.5 text-xs font-semibold uppercase tracking-widest hover:bg-[#1a1a1a] hover:text-white transition-colors duration-300 font-inter"
            >
              View Full Collection
            </Link>
          </div>
        </div>
      </section>

      {/* Our Craft Section */}
      <section className="py-24 bg-white border-b border-[#e8e0d5]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center">
            <h2 className="text-3xl font-light tracking-[0.15em] text-[#1a1a1a] font-cormorant uppercase">
              Our Craft
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { label: "Aari Work", bg: "bg-[#3a3a3a]" },
              { label: "Zardosi", bg: "bg-[#4a4a4a]" },
              { label: "Mirror Work", bg: "bg-[#5a5a5a]" },
              { label: "Thread Embroidery", bg: "bg-[#6a6a6a]" },
              { label: "Cut Work", bg: "bg-[#7a7a7a]" },
              { label: "Bespoke Tailoring", bg: "bg-[#2d2d2d]" },
            ].map((craft, idx) => (
              <Link
                key={idx}
                href="/shop"
                className={`group relative aspect-square w-full flex items-end justify-center pb-8 ${craft.bg} hover:brightness-110 transition-all duration-500 hover:scale-[1.01] overflow-hidden border border-[#e8e0d5]/10`}
              >
                <div className="text-center z-10">
                  <span className="text-xs font-bold uppercase tracking-[0.25em] text-white/90 group-hover:text-white transition-colors duration-300">
                    {craft.label}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Bespoke Banner */}
      <section className="py-20 bg-[#faf8f5] text-center border-b border-[#e8e0d5]/40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 font-inter">
          <h2 className="text-3xl sm:text-4xl font-light tracking-wide text-[#1a1a1a] font-cormorant">
            Looking for Something Bespoke?
          </h2>
          <p className="text-sm sm:text-base text-[#4a4a4a] leading-relaxed max-w-lg mx-auto font-light">
            Work with our master artisans to create a one-of-a-kind masterpiece tailored to your vision and measurements.
          </p>
          <div className="pt-2">
            <Link
              href="/contact"
              className="inline-block bg-[#c9a465] hover:bg-[#d4b87a] text-white py-4 px-10 text-xs font-semibold uppercase tracking-widest transition-colors duration-300"
            >
              Get a Custom Quote
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: convert home page to Server Component with Supabase data and empty states"
```

---

## Task 5: Shop page — Server Component + ShopClient (dynamic filters)

**Files:**
- Create: `src/components/shop/ShopClient.tsx`
- Modify: `src/app/shop/page.tsx`

**Key change from original plan:** Filters are derived dynamically from `product.work_types` values returned by Supabase — not hardcoded. This means newly published work types appear automatically. Filter matching becomes exact string comparison instead of substring matching.

- [ ] **Step 1: Create `src/components/shop/ShopClient.tsx`**

```tsx
// src/components/shop/ShopClient.tsx
"use client";

import { useState, useMemo } from "react";
import ProductCard from "@/components/shop/ProductCard";
import type { Product } from "@/types";

interface Props {
  products: Product[];
}

export default function ShopClient({ products }: Props) {
  // Derive unique work types from actual product data
  const filters = useMemo(() => {
    const types = [...new Set(products.flatMap((p) => p.work_types))].sort();
    return ["ALL", ...types];
  }, [products]);

  const [activeFilter, setActiveFilter] = useState("ALL");

  const filteredProducts = useMemo(() => {
    if (activeFilter === "ALL") return products;
    return products.filter((p) => p.work_types.includes(activeFilter));
  }, [activeFilter, products]);

  return (
    <>
      {/* Filter Bar */}
      <div className="border-b border-[#e8e0d5]/60 py-6 bg-white font-inter select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap gap-2 justify-center">
            {filters.map((craft) => (
              <button
                key={craft}
                onClick={() => setActiveFilter(craft)}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] transition-all duration-300 border rounded-none cursor-pointer ${
                  activeFilter === craft
                    ? "bg-[#c9a465] text-white border-[#c9a465]"
                    : "bg-white text-[#4a4a4a] border-[#e8e0d5] hover:bg-[#faf8f5] hover:border-[#c9a465]"
                }`}
              >
                {craft}
              </button>
            ))}
          </div>
          <div className="text-xs font-bold uppercase tracking-[0.15em] text-[#9a9a9a]">
            {filteredProducts.length} Pieces
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-20 space-y-4 font-inter">
            <p className="text-sm font-bold uppercase tracking-widest text-[#9a9a9a]">
              {products.length === 0
                ? "No products available at the moment."
                : "No masterpieces match your selection."}
            </p>
            {products.length > 0 && (
              <button
                onClick={() => setActiveFilter("ALL")}
                className="text-xs uppercase tracking-widest font-bold text-[#c9a465] border-b border-[#c9a465] pb-0.5 hover:text-[#d4b87a] hover:border-[#d4b87a] transition-all cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Replace `src/app/shop/page.tsx`**

```tsx
// src/app/shop/page.tsx
import ShopClient from "@/components/shop/ShopClient";
import { getProducts } from "@/lib/services/products";

export default async function ShopPage() {
  const products = await getProducts();

  return (
    <main className="flex-1 bg-white min-h-screen">
      <div className="bg-[#a69c90] py-28 text-center select-none flex flex-col justify-center items-center">
        <span className="text-xs font-bold uppercase tracking-[0.25em] text-[#e5c185] mb-2 font-inter">
          BRIDAL MASTERPIECES
        </span>
        <h1 className="text-5xl font-light text-white font-cormorant italic select-none">
          Collection
        </h1>
      </div>
      <ShopClient products={products} />
    </main>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/shop/ShopClient.tsx src/app/shop/page.tsx
git commit -m "feat: shop page as Server Component with dynamic work-type filters derived from product data"
```

---

## Task 6: Category route

**Files:**
- Create: `src/app/shop/category/[slug]/page.tsx`
- Create: `src/app/shop/category/[slug]/loading.tsx`
- Create: `src/app/shop/category/[slug]/error.tsx`

This route is new. It fetches the category by slug, fetches its products, and renders a dedicated category page. The route lives at `/shop/category/[slug]` to avoid clashing with the existing `/shop/[slug]` product detail route.

- [ ] **Step 1: Create `src/app/shop/category/[slug]/page.tsx`**

```tsx
// src/app/shop/category/[slug]/page.tsx
import { notFound } from "next/navigation";
import ShopClient from "@/components/shop/ShopClient";
import { getCategoryBySlug } from "@/lib/services/categories";
import { getProductsByCategory } from "@/lib/services/products";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;

  const [category, products] = await Promise.all([
    getCategoryBySlug(slug),
    getProductsByCategory(slug),
  ]);

  if (!category) notFound();

  return (
    <main className="flex-1 bg-white min-h-screen">
      {/* Category banner */}
      <div className="bg-[#a69c90] py-28 text-center select-none flex flex-col justify-center items-center gap-2">
        {category.subtitle && (
          <span className="text-xs font-bold uppercase tracking-[0.25em] text-[#e5c185] font-inter">
            {category.subtitle}
          </span>
        )}
        <h1 className="text-5xl font-light text-white font-cormorant italic">
          {category.name}
        </h1>
        {category.description && (
          <p className="text-sm text-white/70 font-inter mt-2 max-w-md px-4">
            {category.description}
          </p>
        )}
      </div>

      {/* Product grid with dynamic filters */}
      {products.length === 0 ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center font-inter">
          <p className="text-sm font-bold uppercase tracking-widest text-[#9a9a9a]">
            No products found in this category.
          </p>
        </div>
      ) : (
        <ShopClient products={products} />
      )}
    </main>
  );
}
```

- [ ] **Step 2: Create `src/app/shop/category/[slug]/loading.tsx`**

```tsx
// src/app/shop/category/[slug]/loading.tsx
export default function CategoryLoading() {
  return (
    <main className="flex-1 bg-white min-h-screen">
      <div className="bg-[#a69c90] py-28 flex flex-col justify-center items-center gap-3">
        <div className="h-3 w-32 bg-white/30 rounded animate-pulse" />
        <div className="h-10 w-56 bg-white/30 rounded animate-pulse" />
      </div>
      <div className="border-b border-[#e8e0d5]/60 py-6 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 w-24 bg-[#e8e0d5] rounded animate-pulse" />
          ))}
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="aspect-[3/4] w-full bg-[#e8e0d5] animate-pulse" />
              <div className="h-4 w-3/4 bg-[#e8e0d5] rounded animate-pulse" />
              <div className="h-4 w-1/2 bg-[#e8e0d5] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Create `src/app/shop/category/[slug]/error.tsx`**

```tsx
// src/app/shop/category/[slug]/error.tsx
"use client";

import Link from "next/link";

export default function CategoryError() {
  return (
    <main className="flex-1 bg-white min-h-screen flex items-center justify-center">
      <div className="text-center space-y-6 font-inter px-4">
        <h2 className="text-2xl font-light tracking-[0.15em] text-[#1a1a1a] font-cormorant uppercase">
          Category unavailable
        </h2>
        <p className="text-sm text-[#9a9a9a]">
          This category couldn&apos;t be loaded. Please try browsing the full collection.
        </p>
        <Link
          href="/shop"
          className="inline-block text-xs uppercase tracking-widest font-bold text-[#c9a465] border-b border-[#c9a465] pb-0.5 hover:text-[#d4b87a] transition-all"
        >
          View Full Collection
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/shop/category/
git commit -m "feat: add category route /shop/category/[slug] with loading and error states"
```

---

## Task 7: Product detail — Server Component + ProductDetailClient

**Files:**
- Create: `src/components/product/ProductDetailClient.tsx`
- Modify: `src/app/shop/[slug]/page.tsx`

**Key change from original plan:** Recommendations use `getRelatedProducts(product.category_id, product.id, 3)` — not `getProducts()` — so we fetch only 3 DB rows instead of the entire catalog.

- [ ] **Step 1: Create `src/components/product/ProductDetailClient.tsx`**

```tsx
// src/components/product/ProductDetailClient.tsx
"use client";

import { useState } from "react";
import { useCartStore } from "@/store/cart";
import type { Product } from "@/types";

interface Props {
  product: Product;
}

export default function ProductDetailClient({ product }: Props) {
  const addItem = useCartStore((state) => state.addItem);
  const [isAdded, setIsAdded] = useState(false);

  const handleAddToCart = () => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0] ?? product.image_url ?? "",
      work_types: product.work_types,
    });
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  return (
    <div className="space-y-3 pt-6">
      <button
        onClick={handleAddToCart}
        className="w-full bg-[#c9a465] hover:bg-[#d4b87a] text-white py-4 text-sm font-semibold uppercase tracking-widest transition-colors duration-300 cursor-pointer text-center"
      >
        {isAdded ? "Added to Cart" : "Add to Cart"}
      </button>
      <a
        href={`https://wa.me/919876543210?text=Hi,%20I'm%20interested%20in%20inquiring%20about%20${encodeURIComponent(product.name)}.`}
        target="_blank"
        rel="noreferrer"
        className="w-full border border-[#25d366] text-[#25d366] hover:bg-[#25d366]/5 py-4 text-sm font-semibold uppercase tracking-widest transition-colors duration-300 cursor-pointer flex items-center justify-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.964 9.964 0 0 0 1.333 4.982L2 22l5.233-1.371a9.994 9.994 0 0 0 4.779 1.209c5.505 0 9.988-4.479 9.99-9.987A9.994 9.994 0 0 0 12.012 2Zm4.877 14.224c-.274.773-1.332 1.396-1.84 1.442-.469.043-.918.23-2.986-.593-2.647-1.053-4.32-3.779-4.453-3.955-.13-.177-1.07-1.428-1.07-2.723 0-1.294.673-1.929.914-2.19.24-.262.529-.326.705-.326.177 0 .354.001.508.008.16.007.375-.06.586.447.218.522.747 1.821.811 1.952.064.13.107.283.02.457-.086.174-.13.283-.26.435-.13.153-.274.34-.39.457-.13.13-.267.272-.116.533.152.26.678 1.117 1.453 1.808.998.89 1.839 1.166 2.099 1.296.26.13.412.109.564-.065.152-.174.652-.761.826-1.022.174-.261.347-.217.585-.13.24.086 1.52.717 1.78.847.26.13.435.195.499.304.065.109.065.631-.208 1.405Z" />
        </svg>
        WhatsApp Inquiry
      </a>
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/app/shop/[slug]/page.tsx`**

```tsx
// src/app/shop/[slug]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts } from "@/lib/services/products";
import ImageGallery from "@/components/product/ImageGallery";
import ProductCard from "@/components/shop/ProductCard";
import ProductDetailClient from "@/components/product/ProductDetailClient";

interface Props {
  params: Promise<{ slug: string }>;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  // Targeted query: only fetch 3 products in the same category
  const recommendations = await getRelatedProducts(
    product.category_id,
    product.id,
    3
  );

  return (
    <main className="flex-1 bg-white">
      {/* Breadcrumbs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <nav className="text-xs uppercase tracking-widest text-[#9a9a9a] font-inter">
          <Link href="/" className="hover:text-[#c9a465] transition-colors">
            Collections
          </Link>{" "}
          /{" "}
          <Link
            href={
              product.category
                ? `/shop/category/${product.category.slug}`
                : "/shop"
            }
            className="hover:text-[#c9a465] transition-colors"
          >
            {product.category?.name ?? "Shop"}
          </Link>{" "}
          / <span className="text-[#1a1a1a]">{product.name}</span>
        </nav>
      </div>

      {/* Main Details */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div>
            <ImageGallery images={product.images} />
          </div>

          <div className="space-y-8 font-inter">
            <div className="space-y-3">
              <span className="text-xs uppercase tracking-widest text-[#9a9a9a] font-medium block">
                {product.category?.name ?? ""}
              </span>
              <h1 className="text-3xl sm:text-4xl font-light tracking-wide text-[#1a1a1a] font-cormorant">
                {product.name}
              </h1>
              <p className="text-xl font-light text-[#1a1a1a] tracking-wide">
                {formatPrice(product.price)}
              </p>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-[#4a4a4a] leading-relaxed font-light">
                {product.description}
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                {product.work_types.map((type) => (
                  <span
                    key={type}
                    className="border border-[#c9a465] text-[#c9a465] text-xs font-bold uppercase tracking-widest px-4 py-2 select-none"
                  >
                    {type}
                  </span>
                ))}
                <span className="border border-[#c9a465] text-[#c9a465] text-xs font-bold uppercase tracking-widest px-4 py-2 select-none">
                  Hand-Embroidered
                </span>
              </div>
            </div>

            <ProductDetailClient product={product} />
          </div>
        </div>
      </div>

      {/* Recommendations — only rendered when results exist */}
      {recommendations.length > 0 && (
        <div className="bg-[#faf8f5] border-t border-[#e8e0d5]/40 py-20 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="text-center">
              <h2 className="text-3xl font-light tracking-[0.15em] text-[#1a1a1a] font-cormorant">
                You May Also Like
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {recommendations.map((r) => (
                <ProductCard key={r.id} product={r} />
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/product/ProductDetailClient.tsx src/app/shop/[slug]/page.tsx
git commit -m "feat: product detail as Server Component using getProductBySlug + getRelatedProducts"
```

---

## Task 8: Loading, error, and root error boundary

**Files:**
- Create: `src/app/shop/loading.tsx`
- Create: `src/app/shop/[slug]/loading.tsx`
- Create: `src/app/shop/error.tsx`
- Create: `src/app/shop/[slug]/error.tsx`
- Create: `src/app/error.tsx`

- [ ] **Step 1: Create `src/app/shop/loading.tsx`**

```tsx
// src/app/shop/loading.tsx
export default function ShopLoading() {
  return (
    <main className="flex-1 bg-white min-h-screen">
      <div className="bg-[#a69c90] py-28 flex flex-col justify-center items-center gap-3">
        <div className="h-3 w-36 bg-white/30 rounded animate-pulse" />
        <div className="h-10 w-48 bg-white/30 rounded animate-pulse" />
      </div>
      <div className="border-b border-[#e8e0d5]/60 py-6 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-2 flex-wrap">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 w-24 bg-[#e8e0d5] rounded animate-pulse" />
          ))}
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="aspect-[3/4] w-full bg-[#e8e0d5] animate-pulse" />
              <div className="h-4 w-3/4 bg-[#e8e0d5] rounded animate-pulse" />
              <div className="h-4 w-1/2 bg-[#e8e0d5] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create `src/app/shop/[slug]/loading.tsx`**

```tsx
// src/app/shop/[slug]/loading.tsx
export default function ProductDetailLoading() {
  return (
    <main className="flex-1 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="h-3 w-48 bg-[#e8e0d5] rounded animate-pulse" />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div className="aspect-[3/4] w-full bg-[#e8e0d5] animate-pulse" />
          <div className="space-y-6 pt-2">
            <div className="h-3 w-20 bg-[#e8e0d5] rounded animate-pulse" />
            <div className="h-10 w-3/4 bg-[#e8e0d5] rounded animate-pulse" />
            <div className="h-6 w-1/3 bg-[#e8e0d5] rounded animate-pulse" />
            <div className="space-y-2 pt-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-3 w-full bg-[#e8e0d5] rounded animate-pulse" />
              ))}
            </div>
            <div className="h-12 w-full bg-[#e8e0d5] animate-pulse mt-6" />
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Create `src/app/shop/error.tsx`**

```tsx
// src/app/shop/error.tsx
"use client";

interface Props {
  reset: () => void;
}

export default function ShopError({ reset }: Props) {
  return (
    <main className="flex-1 bg-white min-h-screen flex items-center justify-center">
      <div className="text-center space-y-6 font-inter px-4">
        <h2 className="text-2xl font-light tracking-[0.15em] text-[#1a1a1a] font-cormorant uppercase">
          Something went wrong
        </h2>
        <p className="text-sm text-[#9a9a9a]">
          We couldn&apos;t load the collection. Please try again.
        </p>
        <button
          onClick={reset}
          className="text-xs uppercase tracking-widest font-bold text-[#c9a465] border-b border-[#c9a465] pb-0.5 hover:text-[#d4b87a] transition-all cursor-pointer"
        >
          Try Again
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Create `src/app/shop/[slug]/error.tsx`**

```tsx
// src/app/shop/[slug]/error.tsx
"use client";

import Link from "next/link";

export default function ProductError() {
  return (
    <main className="flex-1 bg-white min-h-screen flex items-center justify-center">
      <div className="text-center space-y-6 font-inter px-4">
        <h2 className="text-2xl font-light tracking-[0.15em] text-[#1a1a1a] font-cormorant uppercase">
          Product unavailable
        </h2>
        <p className="text-sm text-[#9a9a9a]">
          This piece couldn&apos;t be loaded. Please try browsing the collection.
        </p>
        <Link
          href="/shop"
          className="inline-block text-xs uppercase tracking-widest font-bold text-[#c9a465] border-b border-[#c9a465] pb-0.5 hover:text-[#d4b87a] transition-all"
        >
          Back to Collection
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Create root error boundary `src/app/error.tsx`**

The home page now fetches Supabase data. If `getProducts` or `getCategories` throws, this boundary catches it.

```tsx
// src/app/error.tsx
"use client";

interface Props {
  reset: () => void;
}

export default function RootError({ reset }: Props) {
  return (
    <main className="flex-1 bg-white min-h-screen flex items-center justify-center">
      <div className="text-center space-y-6 font-inter px-4">
        <h2 className="text-2xl font-light tracking-[0.15em] text-[#1a1a1a] font-cormorant uppercase">
          Something went wrong
        </h2>
        <p className="text-sm text-[#9a9a9a] max-w-xs mx-auto">
          We&apos;re having trouble connecting to our servers. Please refresh the page.
        </p>
        <button
          onClick={reset}
          className="inline-block bg-[#c9a465] hover:bg-[#d4b87a] text-white py-3 px-8 text-xs font-semibold uppercase tracking-widest transition-colors duration-300 cursor-pointer"
        >
          Try Again
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Run all tests — confirm nothing regressed**

```bash
npx vitest run
```

Expected: `22 passed`.

- [ ] **Step 7: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Final validation**

```bash
npm run test
npm run lint
npx tsc --noEmit
npm run build
```

Expected: all pass. If `npm run build` fails due to a missing Supabase env var at build time, set dummy values:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder npm run build
```

- [ ] **Step 9: Commit**

```bash
git add src/app/shop/loading.tsx src/app/shop/[slug]/loading.tsx src/app/shop/error.tsx src/app/shop/[slug]/error.tsx src/app/error.tsx
git commit -m "feat: add loading skeletons and error boundaries for all routes including root"
```

---

## Final Acceptance Checklist

Before merging, verify each item:

| Check | Verification |
|-------|-------------|
| No storefront route imports `MOCK_PRODUCTS` | `grep -r "MOCK_PRODUCTS" src/app` → 0 results |
| No storefront route imports `MOCK_CATEGORIES` | `grep -r "MOCK_CATEGORIES" src/app` → 0 results |
| Mock file preserved | `src/lib/data/mockProducts.ts` still exists |
| Home uses `getProducts`/`getCategories` | `src/app/page.tsx` |
| Shop uses `getProducts` | `src/app/shop/page.tsx` |
| Category page uses `getCategoryBySlug` + `getProductsByCategory` | `src/app/shop/category/[slug]/page.tsx` |
| Product detail uses `getProductBySlug` + `getRelatedProducts` | `src/app/shop/[slug]/page.tsx` |
| Root error boundary exists | `src/app/error.tsx` |
| Loading states exist for all data routes | `shop/loading.tsx`, `shop/[slug]/loading.tsx`, `shop/category/[slug]/loading.tsx` |
| Error states exist for all data routes | `shop/error.tsx`, `shop/[slug]/error.tsx`, `shop/category/[slug]/error.tsx` |
| Cache tags implemented | `tags: ["products"]` and `tags: ["categories"]` in service files |
| All tests passing | `npm run test` → 22 passed |
| TypeScript passes | `npx tsc --noEmit` → 0 errors |
| ESLint passes | `npm run lint` → 0 errors |
| Build passes | `npm run build` → success |
