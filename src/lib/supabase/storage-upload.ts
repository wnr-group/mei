import { createServiceClient } from "./service-client";

/**
 * Uploads reference images to Supabase Storage (enquiry-images bucket)
 *
 * BUCKET SETUP REQUIRED:
 * - Bucket name: "enquiry-images"
 * - Access: Public (files must be readable via URL)
 * - Create in Supabase dashboard: Storage > Create bucket > Name: "enquiry-images" > Public
 * - Or run: npx supabase link && npx supabase db push (if using migrations)
 *
 * @param files - Array of image files to upload
 * @param enquiryId - ID of the enquiry (used for organizing files in storage)
 * @returns Array of public URLs for the uploaded images
 * @throws Error if ANY file fails to upload (includes cleanup of partial uploads)
 */
export async function uploadReferenceImages(files: File[], enquiryId: string): Promise<string[]> {
  if (files.length === 0) {
    return [];
  }

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const supabase = createServiceClient();
  const uploadedUrls: string[] = [];
  const uploadedFilePaths: string[] = [];
  const uploadPromises: Promise<string>[] = [];

  // Server-side file size validation
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File "${file.name}" exceeds 5MB limit. Please upload a smaller file.`);
    }
  }

  for (const file of files) {
    const uploadPromise = (async () => {
      // Generate unique filename with timestamp to avoid collisions
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `${timestamp}-${file.name}`;
      const filePath = `enquiries/${enquiryId}/${fileName}`;

      try {
        const { error: uploadError } = await supabase.storage
          .from("enquiry-images")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        // Track uploaded file for potential cleanup
        uploadedFilePaths.push(filePath);

        // Get the public URL for the uploaded file
        const {
          data: { publicUrl },
        } = supabase.storage.from("enquiry-images").getPublicUrl(filePath);

        return publicUrl;
      } catch (error) {
        console.error(`[StorageUpload] Failed to upload ${file.name}:`, error);
        throw error;
      }
    })();

    uploadPromises.push(uploadPromise);
  }

  try {
    // Wait for all uploads to complete
    uploadedUrls.push(...(await Promise.all(uploadPromises)));
    return uploadedUrls;
  } catch (error) {
    // Cleanup: Remove successfully uploaded files before throwing error
    console.error("[StorageUpload] Upload failed, cleaning up partial uploads:", error);

    if (uploadedFilePaths.length > 0) {
      try {
        await supabase.storage.from("enquiry-images").remove(uploadedFilePaths);
        console.log(`[StorageUpload] Cleaned up ${uploadedFilePaths.length} partial uploads`);
      } catch (cleanupError) {
        console.error("[StorageUpload] Cleanup failed:", cleanupError);
        // Continue to throw original error even if cleanup fails
      }
    }

    const errorMessage = error instanceof Error
      ? error.message
      : "Failed to upload reference images. Please try again.";
    throw new Error(errorMessage);
  }
}
