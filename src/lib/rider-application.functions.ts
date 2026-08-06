import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Server functions backing the accountless rider application flow.
 *
 * No Supabase auth session exists anywhere in this flow — applicants are
 * never logged in. Every function here is intentionally public (no
 * `requireSupabaseAuth` middleware) and uses `supabaseAdmin` (service role)
 * to read/write `rider_applications`, which has no client-facing RLS
 * policies at all. The `applicationToken` (the row's `id`, a uuid) is the
 * only thing that authorizes access to a given application once the email
 * has been verified — treat it like a bearer credential: it's shown to the
 * applicant's browser and passed back on every subsequent call, but it is
 * never guessable (uuid v4) and the row it unlocks contains no secrets
 * beyond the applicant's own submitted data.
 */

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const ALLOWED_DOC_TYPES = [...ALLOWED_IMAGE_TYPES, "application/pdf"];

// ---------------------------------------------------------------------------
// Step 0 — Email OTP (reuses Supabase Auth's own OTP email, sent through the
// project's existing Brevo SMTP config — the same path customer signup uses).
// The session it creates is discarded immediately; we only care that the
// code was correct, never that a login persists.
// ---------------------------------------------------------------------------

export const sendRiderApplicationOtp = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ email: z.string().email() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.auth.signInWithOtp({
      email: data.email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });

    if (error) throw new Error(error.message);
    return { sent: true as const };
  });

export const verifyRiderApplicationOtp = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        email: z.string().email(),
        code: z.string().min(4).max(10),
        /** If the applicant already has a draft (e.g. re-verifying after a break), pass it back to resume instead of creating a new row. */
        existingApplicationToken: z.string().uuid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();

    const { data: verifyData, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
      email,
      token: data.code,
      type: "email",
    });

    if (verifyError || !verifyData.session) {
      throw new Error(verifyError?.message ?? "That code didn't work. Please check it and try again.");
    }

    // Immediately discard the session this created — an applicant is never
    // meant to be logged in. We only needed proof the code was correct.
    await supabaseAdmin.auth.admin.signOut(verifyData.session.access_token).catch(() => {
      // Best-effort; even if this fails the token is never stored or returned to the client.
    });

    if (data.existingApplicationToken) {
      const { data: existing } = await supabaseAdmin
        .from("rider_applications")
        .select("id,email,status")
        .eq("id", data.existingApplicationToken)
        .maybeSingle();

      if (existing && existing.email === email && existing.status === "draft") {
        await supabaseAdmin
          .from("rider_applications")
          .update({ email_verified_at: new Date().toISOString() })
          .eq("id", existing.id);
        return { applicationToken: existing.id };
      }
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from("rider_applications")
      .insert({
        email,
        email_verified_at: new Date().toISOString(),
        status: "draft",
      })
      .select("id")
      .single();

    if (insertError || !created) {
      throw new Error(insertError?.message ?? "Could not start your application. Please try again.");
    }

    return { applicationToken: created.id as string };
  });

// ---------------------------------------------------------------------------
// Autosave — called as the applicant moves through each step. Partial data
// is fine; only `submitRiderApplication` enforces completeness.
// ---------------------------------------------------------------------------

const stepOneSchema = z.object({
  full_name: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).optional(),
  date_of_birth: z.string().optional(), // ISO date; 18+ check happens on submit
  gender: z.string().trim().optional(),
  residential_address: z.string().trim().optional(),
  lga: z.string().trim().optional(),
});

const stepTwoSchema = z.object({
  vehicle_type: z.string().trim().optional(),
  plate_number: z.string().trim().optional(),
  drivers_license_number: z.string().trim().optional(),
  vehicle_ownership: z.string().trim().optional(),
  years_riding_experience: z.number().int().min(0).max(60).optional(),
});

const stepThreeSchema = z.object({
  bank_name: z.string().trim().optional(),
  account_number: z.string().trim().optional(),
  account_name: z.string().trim().optional(),
  next_of_kin_name: z.string().trim().optional(),
  next_of_kin_phone: z.string().trim().optional(),
  next_of_kin_relationship: z.string().trim().optional(),
});

const stepFourSchema = z.object({
  previous_delivery_experience: z.string().trim().optional(),
  has_criminal_record: z.boolean().optional(),
  criminal_record_details: z.string().trim().optional(),
  referral_source: z.string().trim().optional(),
  agreement_accepted: z.boolean().optional(),
  agreement_signature_name: z.string().trim().optional(),
});

export const saveRiderApplicationStep = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        applicationToken: z.string().uuid(),
        step: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
        fields: z.record(z.string(), z.unknown()),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const schema = { 1: stepOneSchema, 2: stepTwoSchema, 3: stepThreeSchema, 4: stepFourSchema }[data.step];
    const parsed = schema.parse(data.fields);

    const update: Record<string, unknown> = { ...parsed, updated_at: new Date().toISOString() };
    if (data.step === 4 && (parsed as z.infer<typeof stepFourSchema>).agreement_accepted) {
      update['agreement_accepted_at'] = new Date().toISOString();
      delete update['agreement_accepted']; // not a real column
    }

    const { error } = await supabaseAdmin
      .from("rider_applications")
      .update(update as never)
      .eq("id", data.applicationToken)
      .eq("status", "draft"); // never allow editing a submitted/reviewed application

    if (error) throw new Error(error.message);
    return { saved: true as const };
  });

// ---------------------------------------------------------------------------
// File uploads — the private bucket is never touched from the browser.
// The file bytes travel through this server function, validated, and land
// at {applicationToken}/{kind}.{ext} in the private bucket.
// ---------------------------------------------------------------------------

const UPLOAD_KINDS = [
  "photo",
  "drivers-license-front",
  "drivers-license-back",
  "vehicle-insurance",
] as const;
type UploadKind = (typeof UPLOAD_KINDS)[number];

const COLUMN_FOR_KIND: Record<UploadKind, string> = {
  photo: "photo_url",
  "drivers-license-front": "drivers_license_front_url",
  "drivers-license-back": "drivers_license_back_url",
  "vehicle-insurance": "vehicle_insurance_url",
};

function extensionFor(mimeType: string, fallbackName: string): string {
  const fromType = mimeType.split("/")[1];
  if (fromType) return fromType === "jpeg" ? "jpg" : fromType;
  return fallbackName.split(".").pop() || "bin";
}

export const uploadRiderApplicationDocument = createServerFn({ method: "POST" })
  .inputValidator((data) => {
    if (!(data instanceof FormData)) throw new Error("Expected multipart form data");
    const applicationToken = data.get("applicationToken");
    const kind = data.get("kind");
    const file = data.get("file");
    if (typeof applicationToken !== "string" || !z.string().uuid().safeParse(applicationToken).success) {
      throw new Error("Invalid application token");
    }
    if (typeof kind !== "string" || !UPLOAD_KINDS.includes(kind as UploadKind)) {
      throw new Error("Invalid document kind");
    }
    if (!(file instanceof File)) throw new Error("No file provided");
    return { applicationToken, kind: kind as UploadKind, file };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { applicationToken, kind, file } = data;

    if (!ALLOWED_DOC_TYPES.includes(file.type)) {
      throw new Error("Please upload a photo (JPG, PNG, WEBP, HEIC) or PDF.");
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new Error("That file is too large. Please choose one under 8MB.");
    }

    const { data: application } = await supabaseAdmin
      .from("rider_applications")
      .select("id,status")
      .eq("id", applicationToken)
      .maybeSingle();

    if (!application || application.status !== "draft") {
      throw new Error("This application can no longer be edited.");
    }

    const path = `${applicationToken}/${kind}.${extensionFor(file.type, file.name)}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from("rider-application-documents")
      .upload(path, bytes, { upsert: true, contentType: file.type });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    // Private bucket — store the path, not a public URL. Signed URLs are
    // minted on demand for admin review (see rider-application-admin.functions.ts).
    const { error: updateError } = await supabaseAdmin
      .from("rider_applications")
      .update({ [COLUMN_FOR_KIND[kind]]: path, updated_at: new Date().toISOString() } as never)
      .eq("id", applicationToken);

    if (updateError) throw new Error(updateError.message);

    return { path };
  });

// ---------------------------------------------------------------------------
// Submit — validates completeness and flips status to "submitted".
// ---------------------------------------------------------------------------

export const submitRiderApplication = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ applicationToken: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: app, error } = await supabaseAdmin
      .from("rider_applications")
      .select("*")
      .eq("id", data.applicationToken)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!app || app.status !== "draft") {
      throw new Error("This application can't be submitted.");
    }

    const required: Array<[unknown, string]> = [
      [app.full_name, "Full name"],
      [app.phone, "Phone number"],
      [app.date_of_birth, "Date of birth"],
      [app.gender, "Gender"],
      [app.residential_address, "Residential address"],
      [app.lga, "LGA"],
      [app.vehicle_type, "Vehicle type"],
      [app.plate_number, "Plate number"],
      [app.drivers_license_number, "Driver's license number"],
      [app.vehicle_ownership, "Vehicle ownership"],
      [app.bank_name, "Bank name"],
      [app.account_number, "Account number"],
      [app.account_name, "Account name"],
      [app.next_of_kin_name, "Next of kin name"],
      [app.next_of_kin_phone, "Next of kin phone number"],
      [app.next_of_kin_relationship, "Relationship to next of kin"],
      [app.agreement_accepted_at, "Signed rider agreement"],
      [app.agreement_signature_name, "Digital signature"],
    ];

    const missing = required.filter(([value]) => value === null || value === undefined || value === "").map(([, label]) => label);
    if (missing.length > 0) {
      throw new Error(`Please complete: ${missing.join(", ")}`);
    }

    if (app.date_of_birth) {
      const age = Math.floor((Date.now() - new Date(app.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 18) throw new Error("You must be at least 18 years old to ride with Zentra.");
    }

    const { error: updateError } = await supabaseAdmin
      .from("rider_applications")
      .update({ status: "submitted", updated_at: new Date().toISOString() })
      .eq("id", data.applicationToken);

    if (updateError) throw new Error(updateError.message);

    return { status: "submitted" as const };
  });

export const getRiderApplicationStatus = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ applicationToken: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: app, error } = await supabaseAdmin
      .from("rider_applications")
      .select("status,rejection_reason,full_name")
      .eq("id", data.applicationToken)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!app) throw new Response("Not found", { status: 404 });
    return app;
  });
