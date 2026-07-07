"use server";

import { createEnquiry, type CreateEnquiryInput } from "@/lib/services/enquiries";

export type SubmitEnquiryResult =
  | { success: true }
  | { success: false; error: string };

export async function submitEnquiry(
  data: CreateEnquiryInput
): Promise<SubmitEnquiryResult> {
  if (!data.name?.trim()) return { success: false, error: "Name is required." };
  if (!data.email?.trim()) return { success: false, error: "Email is required." };
  if (!/\S+@\S+\.\S+/.test(data.email.trim())) return { success: false, error: "Invalid email format." };
  if (!data.phone?.trim()) return { success: false, error: "Phone number is required." };
  if (!data.occasion?.trim()) return { success: false, error: "Please select an occasion." };
  if (!data.budget?.trim()) return { success: false, error: "Please select a budget range." };

  let enquiryId: string;
  try {
    enquiryId = await createEnquiry(data);
  } catch {
    return { success: false, error: "Something went wrong. Please try again." };
  }

  // Fire confirmation emails via the enquiry-notify Edge Function. A notification
  // failure must not fail the enquiry itself — the row is already persisted.
  await notifyEnquiry(enquiryId);

  return { success: true };
}

async function notifyEnquiry(enquiryId: string): Promise<void> {
  const secret = process.env.STOREFRONT_API_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!secret || !baseUrl) {
    console.error("[submitEnquiry] notify skipped — missing STOREFRONT_API_SECRET or SUPABASE_URL");
    return;
  }

  try {
    const res = await fetch(`${baseUrl}/functions/v1/enquiry-notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-storefront-secret": secret,
      },
      body: JSON.stringify({ enquiry_id: enquiryId }),
    });
    if (!res.ok) {
      console.error("[submitEnquiry] enquiry-notify failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("[submitEnquiry] enquiry-notify error", err);
  }
}
