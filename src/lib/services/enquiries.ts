import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database";

type EnquiryInsert = Database["public"]["Tables"]["enquiries"]["Insert"];

export interface CreateEnquiryInput {
  name: string;
  email: string;
  phone: string;
  occasion: string;
  budget: string;
  message: string;
}

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function createEnquiry(
  input: CreateEnquiryInput
): Promise<{ id: string }> {
  const supabase = getServiceClient();

  const row: EnquiryInsert = {
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone.trim() || null,
    occasion: input.occasion.trim() || null,
    budget: input.budget.trim() || null,
    message: input.message.trim(),
    status: "NEW",
  };

  const { data, error } = await supabase
    .from("enquiries")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    console.error("[EnquiriesService:createEnquiry]", error);
    throw error;
  }

  return { id: data.id };
}
