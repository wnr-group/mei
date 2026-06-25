import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database";

export interface EnquiryMeasurements {
  bust?: string | null;
  waist?: string | null;
  hip?: string | null;
  shoulder?: string | null;
  length?: string | null;
  sleeve?: string | null;
}

export interface CreateEnquiryInput {
  name: string;
  email: string;
  phone: string;
  occasion: string;
  budget: string;
  message: string;
  measurements?: EnquiryMeasurements | null;
  referenceImages?: string[] | null;
}

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export async function createEnquiry(input: CreateEnquiryInput): Promise<void> {
  const supabase = getServiceClient() as SupabaseClient;

  const row: SupabaseClient = {
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone.trim() || null,
    occasion: input.occasion.trim() || null,
    budget: input.budget.trim() || null,
    message: input.message.trim(),
    measurements: input.measurements ?? null,
    reference_images: input.referenceImages ?? null,
    status: "NEW",
  };

  const { error } = await supabase.from("enquiries").insert(row) as SupabaseClient;

  if (error) {
    console.error("[EnquiriesService:createEnquiry]", error);
    throw error;
  }
}
