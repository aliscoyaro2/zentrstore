import { uploadMerchantApplicationDocument } from "@/lib/merchant-application.functions";

export type MerchantApplicationDocumentKind = "cover-photo" | "owner-id" | "cac-doc";

/**
 * Uploads a merchant-application document via the server function so the
 * file never touches the browser's Supabase client — the destination
 * bucket is private and only the server (service role) can write to it.
 */
export async function uploadMerchantApplicationFile(params: {
  applicationToken: string;
  kind: MerchantApplicationDocumentKind;
  file: File;
}): Promise<string> {
  const form = new FormData();
  form.set("applicationToken", params.applicationToken);
  form.set("kind", params.kind);
  form.set("file", params.file);

  const result = await uploadMerchantApplicationDocument({ data: form as never });
  return result.path;
}
