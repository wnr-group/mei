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

  try {
    await createEnquiry(data);
    return { success: true };
  } catch {
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
