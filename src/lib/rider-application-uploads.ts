import { uploadRiderApplicationDocument } from "@/lib/rider-application.functions";

export type RiderApplicationDocumentKind =
  | "photo"
  | "drivers-license-front"
  | "drivers-license-back"
  | "vehicle-insurance";

/**
 * Uploads a rider-application document via the server function so the file
 * never touches the browser's Supabase client — the destination bucket is
 * private and only the server (service role) can write to it.
 */
export async function uploadRiderApplicationFile(params: {
  applicationToken: string;
  kind: RiderApplicationDocumentKind;
  file: File;
}): Promise<string> {
  const form = new FormData();
  form.set("applicationToken", params.applicationToken);
  form.set("kind", params.kind);
  form.set("file", params.file);

  const result = await uploadRiderApplicationDocument({ data: form as never });
  return result.path;
}
