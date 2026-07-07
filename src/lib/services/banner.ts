import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { Database } from "@/lib/supabase/database";
import type { Banner, DbBanner } from "@/types";

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// 2. Map database row to our storefront UI model
export function _mapDbRowToBanner(row: DbBanner): Banner {
  return {
    id: row.id,
    title: row.title,
    image_url: row.image_url,
    link_url: row.link_url,
    is_active: row.is_active,
    sort_order: row.sort_order,
  };
}

export async function getBanners(): Promise<Banner[]> {
  return unstable_cache(
    async (): Promise<Banner[]> => {
      const supabase = getServiceClient();
      // Query database table "banners"
      const { data, error } = await supabase
        .from("banners")
        .select("*")
        .eq("is_active", true) // Only active banners
        .is("deleted_at", null) // Exclude soft-deleted banners
        .order("sort_order", { ascending: true }); // Order by sort_order ascending
      if (error) {
        console.error("[BannersService:getBanners]", error);
        throw error;
      }
      // Map rows and return them
      return (data as DbBanner[]).map(_mapDbRowToBanner);
    },
    ["storefront-banners"], // Unique cache key
    { tags: ["banners"], revalidate: 60 }, // Revalidate cache every 60s
  )();
}




