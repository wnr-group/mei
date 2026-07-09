import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { Database } from "@/lib/supabase/database";
import type { Category } from "@/types";

// ── Generated DB types ─────────────────────────────────────────────────────
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

// ── Mapper ─────────────────────────────────────────────────────────────────

export function _mapDbRowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    image_url: row.image_url,
    subtitle: row.subtitle,
    is_active: row.is_active,
    sort_order: row.sort_order,
  };
}

// ── Supabase client (no cookies — safe inside unstable_cache) ──────────────

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
  { tags: ["categories"], revalidate: 60 }
);

// ── Public service functions ───────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
  try {
    return await _cachedGetCategories();
  } catch (err) {
    console.error("[CategoriesService:getCategories] falling back due to error:", err);
    return [];
  }
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  try {
    return await unstable_cache(
      async (): Promise<Category | null> => {
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
      ["category-by-slug", slug],
      { tags: ["categories"], revalidate: 60 }
    )();
  } catch (err) {
    console.error("[CategoriesService:getCategoryBySlug] falling back due to error:", err);
    return null;
  }
}