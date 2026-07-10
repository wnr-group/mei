import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { Database } from "@/lib/supabase/database";
import type { Product } from "@/types";

// ── Generated DB types ─────────────────────────────────────────────────────
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type ProductMediaRow = Database["public"]["Tables"]["product_media"]["Row"];
type ProductColorRow = Database["public"]["Tables"]["product_colors"]["Row"];

type ProductWithRelations = ProductRow & {
  categories: Pick<CategoryRow, "id" | "name" | "slug"> | null;
  product_media:
  | Pick<
    ProductMediaRow,
    "url" | "color_id" | "sort_order" | "is_primary" | "deleted_at"
  >[]
  | undefined;
  product_colors:
  | Pick<
    ProductColorRow,
    "id" | "label" | "hex_code" | "swatch_image_url" | "sort_order" | "deleted_at"
  >[]
  | undefined;
};

// ── Public API ─────────────────────────────────────────────────────────────

export interface GetProductsOptions {
  categorySlug?: string;
  limit?: number;
  isNewArrival?: boolean;
  isFeatured?: boolean;
  page?: number;
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

  const coloredMedia =
    activeMedia.length > 0
      ? activeMedia.map((m) => ({
        url: m.url,
        color_id: m.color_id,
      }))
      : row.image_url
        ? [{ url: row.image_url, color_id: null }]
        : [];

  const colors = (row.product_colors ?? [])
    .filter((c) => c.deleted_at === null)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => ({
      id: c.id,
      label: c.label,
      hex_code: c.hex_code,
      swatch_image_url: c.swatch_image_url,
      sort_order: c.sort_order,
    }));

  return {
    id: row.id,
    name: row.name,
    slug: row.slug ?? "",
    price: row.price,
    price_unstitched: row.price_unstitched,
    price_stitched: row.price_stitched,
    short_description: row.short_description,
    description: row.description,
    work_types: row.work_types ?? [],
    status: row.status,
    category_id: row.category_id,
    category: row.categories ?? null,
    image_url: row.image_url,
    images,
    is_featured: row.is_featured,
    is_new_arrival: row.is_new_arrival,
    colors,
    coloredMedia,
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
  "*, categories(id, name, slug), product_media(url, color_id, sort_order, is_primary, deleted_at), product_colors(id, label, hex_code, swatch_image_url, sort_order, deleted_at)";

const SELECT_INNER_CAT =
  "*, categories!inner(id, name, slug), product_media(url, color_id, sort_order, is_primary, deleted_at), product_colors(id, label, hex_code, swatch_image_url, sort_order, deleted_at)";

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
  let products: Product[];
  if (options.categorySlug) {
    products = await getProductsByCategory(options.categorySlug);
  } else {
    products = await _cachedGetAllProducts();
  }

  if (options.isNewArrival) {
    products = products.filter((p) => p.is_new_arrival);
  }
  if (options.isFeatured) {
    products = products.filter((p) => p.is_featured);
  }

  if (options.limit !== undefined || options.page !== undefined) {
    const pageNum = options.page || 1;
    const limitNum = options.limit || 12;
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    return products.slice(startIndex, endIndex);
  }

  return products;
}

export async function getProductsByCategory(
  categorySlug: string
): Promise<Product[]> {
  try {
    return await unstable_cache(
      async (): Promise<Product[]> => {
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
      ["products-by-category", categorySlug],
      { tags: ["products"], revalidate: 60 }
    )();
  } catch (err) {
    console.error("[ProductsService:getProductsByCategory] falling back due to error:", err);
    return [];
  }
}

export async function getProductById(id: string): Promise<Product | null> {
  try {
    return await unstable_cache(
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
  } catch (err) {
    console.error("[ProductsService:getProductById] falling back due to error:", err);
    return null;
  }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  try {
    return await unstable_cache(
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
  } catch (err) {
    console.error("[ProductsService:getProductBySlug] falling back due to error:", err);
    return null;
  }
}

export async function getRelatedProducts(
  categoryId: string | null,
  excludeId: string,
  limit = 3
): Promise<Product[]> {
  if (!categoryId) return [];
  try {
    return await unstable_cache(
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
  } catch (err) {
    console.error("[ProductsService:getRelatedProducts] falling back due to error:", err);
    return [];
  }
}