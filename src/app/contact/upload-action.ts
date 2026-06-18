"use server";

import { uploadReferenceImages } from "@/lib/supabase/storage-upload";

export type UploadImagesResult =
  | { success: true; urls: string[] }
  | { success: false; error: string };

export async function uploadEnquiryImages(
  formData: FormData
): Promise<UploadImagesResult> {
  const files = formData.getAll("images") as File[];
  const enquiryId = (formData.get("enquiryId") as string) ?? `temp-${Date.now()}`;

  if (files.length === 0) {
    return { success: true, urls: [] };
  }

  try {
    const urls = await uploadReferenceImages(files, enquiryId);
    return { success: true, urls };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to upload reference images. Please try again.";
    return { success: false, error: message };
  }
}
