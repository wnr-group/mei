import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { Database } from "@/lib/supabase/database";

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const _cachedGetSetting = unstable_cache(
  async (key: string): Promise<string | null> => {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    if (error) {
      console.error("[SettingsService:getSetting]", error);
      return null;
    }
    return data ? String((data as { value: unknown }).value) : null;
  },
  ["setting"],
  { tags: ["settings"], revalidate: 60 }
);

export async function getSetting(key: string): Promise<string | null> {
  return _cachedGetSetting(key);
}
