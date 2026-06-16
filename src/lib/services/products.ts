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
