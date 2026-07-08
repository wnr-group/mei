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
    work_types: row.work_types ?? [],
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

// ── Public service functions ───────────────────────────────────────────────

export async function getProducts(
  options: GetProductsOptions = {}
): Promise<Product[]> {
  if (options.categorySlug) {
    const products = await getProductsByCategory(options.categorySlug);
    return options.limit ? products.slice(0, options.limit) : products;
  }
  const products = await _cachedGetAllProducts();
  return options.limit ? products.slice(0, options.limit) : products;
}

export async function getProductsByCategory(
  categorySlug: string
): Promise<Product[]> {
  return unstable_cache(
    async (): Promise<Product[]> => {
      const supabase = getServiceClient();

      const { data: category, error: categoryError } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", categorySlug)
        .eq("is_active", true)
        .is("deleted_at", null)
        .maybeSingle() as { data: { id: string } | null; error: { message: string } | null };

      if (categoryError) {
        console.error("[ProductsService:getProductsByCategory]", categoryError);
        throw categoryError;
      }
      if (!category) return [];

      const { data, error } = await supabase
        .from("product_categories")
        .select(`products!inner(${SELECT})`)
        .eq("category_id", category.id)
        .eq("products.status", "PUBLISHED")
        .is("products.deleted_at", null)
        .order("created_at", { ascending: false, referencedTable: "products" });

      if (error) {
        console.error("[ProductsService:getProductsByCategory]", error);
        throw error;
      }

      // A product can hold both a 'manual' and a 'rule' product_categories row for
      // this same category (see mei-admin's product_categories UNIQUE(product_id,
      // category_id, source) constraint) — that joins back to two rows here for one
      // product. Dedupe by id, keeping the first occurrence so the created_at DESC
      // ordering from the query is preserved.
      const seenProductIds = new Set<string>();
      const products: Product[] = [];
      for (const row of data as unknown as { products: ProductWithRelations }[]) {
        const mapped = _mapDbRowToProduct(row.products);
        if (seenProductIds.has(mapped.id)) continue;
        seenProductIds.add(mapped.id);
        products.push(mapped);
      }
      return products;
    },
    ["products-by-category", categorySlug],
    { tags: ["products"], revalidate: 60 }
  )();
}

export async function getProductById(id: string): Promise<Product | null> {
  return unstable_cache(
    async (): Promise<Product | null> => {
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
    ["product-by-id", id],
    { tags: ["products"], revalidate: 60 }
  )();
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  return unstable_cache(
    async (): Promise<Product | null> => {
      const supabase = getServiceClient();
      const { data, error } = await supabase
        .from("products")
        .select(SELECT)
        .eq("slug", slug)
        .eq("status", "PUBLISHED")
        .is("deleted_at", null)
        .maybeSingle() as { data: ProductWithRelations | null; error: { message: string } | null };

      if (error) {
        console.error("[ProductsService:getProductBySlug]", error);
        throw error;
      }
      return data ? _mapDbRowToProduct(data as ProductWithRelations) : null;
    },
    ["product-by-slug", slug],
    { tags: ["products"], revalidate: 60 }
  )();
}

export async function getRelatedProducts(
  categoryId: string | null,
  excludeId: string,
  limit = 3
): Promise<Product[]> {
  if (!categoryId) return [];
  return unstable_cache(
    async (): Promise<Product[]> => {
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
    ["related-products", categoryId, excludeId, String(limit)],
    { tags: ["products"], revalidate: 60 }
  )();
}
