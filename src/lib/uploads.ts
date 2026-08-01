import { supabase } from "@/integrations/supabase/client";

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export class UploadValidationError extends Error {}

/**
 * Validates that a picked file is really a picture (not a video, not any
 * other file type), and within a sane size for a mobile camera capture.
 */
function assertIsPicture(file: File) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new UploadValidationError("Please choose a photo (JPG, PNG, WEBP, or HEIC) — not a video or other file.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new UploadValidationError("That photo is too large. Please choose one under 8MB.");
  }
}

function extensionFor(file: File): string {
  const fromType = file.type.split("/")[1];
  if (fromType) return fromType === "jpeg" ? "jpg" : fromType;
  const fromName = file.name.split(".").pop();
  return fromName || "jpg";
}

/**
 * Uploads a real picture file (taken via camera or chosen from the photo
 * library — never a URL, never a video) to the rider-documents bucket, and
 * returns the public URL to store on the riders row (photo_url or
 * national_id_doc_url).
 *
 * Path convention: {riderId}/{kind}.{ext} — enforced to match the RLS
 * policy, which requires the first path segment to equal auth.uid().
 */
export async function uploadRiderDocumentPhoto(params: {
  riderId: string;
  kind: "photo" | "national-id";
  file: File;
}): Promise<string> {
  const { riderId, kind, file } = params;
  assertIsPicture(file);

  const path = `${riderId}/${kind}.${extensionFor(file)}`;

  const { error: uploadError } = await supabase.storage
    .from("rider-documents")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from("rider-documents").getPublicUrl(path);
  // Bust CDN/browser caching on re-upload since the path is stable.
  return `${data.publicUrl}?v=${Date.now()}`;
}
