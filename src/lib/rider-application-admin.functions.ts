import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getSiteUrl } from "@/lib/site-url";

/**
 * Admin-only server functions for reviewing rider applications. Every
 * handler here first confirms the caller is an admin via the `is_admin()`
 * RPC (checked against the caller's own authenticated Supabase client from
 * `requireSupabaseAuth`, i.e. real RLS-respecting auth) before touching
 * `supabaseAdmin` (service role).
 */

async function assertIsAdmin(supabase: import("@supabase/supabase-js").SupabaseClient) {
  const { data, error } = await supabase.rpc("is_admin");
  if (error || data !== true) {
    throw new Response("Forbidden", { status: 403 });
  }
}

const DOCUMENT_COLUMNS = [
  "photo_url",
  "drivers_license_front_url",
  "drivers_license_back_url",
  "vehicle_insurance_url",
] as const;

export const listRiderApplications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        status: z.enum(["draft", "submitted", "approved", "rejected", "all"]).default("submitted"),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertIsAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("rider_applications")
      .select(
        "id,status,email,full_name,phone,vehicle_type,plate_number,lga,created_at,updated_at,rejection_reason",
      )
      .order("created_at", { ascending: false });

    if (data.status !== "all") query = query.eq("status", data.status);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getRiderApplicationDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ applicationId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertIsAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: app, error } = await supabaseAdmin
      .from("rider_applications")
      .select("*")
      .eq("id", data.applicationId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!app) throw new Response("Not found", { status: 404 });

    // Mint short-lived signed URLs for whichever documents were uploaded —
    // the bucket is private, so admins can't view them any other way.
    const signedUrls: Record<string, string | null> = {};
    for (const column of DOCUMENT_COLUMNS) {
      const path = (app as Record<string, unknown>)[column] as string | null;
      if (!path) {
        signedUrls[column] = null;
        continue;
      }
      const { data: signed } = await supabaseAdmin.storage
        .from("rider-application-documents")
        .createSignedUrl(path, 60 * 10); // 10 minutes, enough for one review session
      signedUrls[column] = signed?.signedUrl ?? null;
    }

    return { application: app, signedUrls };
  });

export const approveRiderApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ applicationId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertIsAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: app, error } = await supabaseAdmin
      .from("rider_applications")
      .select("*")
      .eq("id", data.applicationId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!app) throw new Response("Not found", { status: 404 });
    if (app.status !== "submitted") throw new Error("Only submitted applications can be approved.");

    // Create the real account now — this is the moment the applicant
    // becomes a rider. Supabase's invite email (through the project's
    // Brevo SMTP) links to /auth/set-password, where they choose their own
    // password before ever landing on the dashboard.
    const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(app.email, {
      data: { full_name: app.full_name, role: "rider" },
      redirectTo: `${getSiteUrl()}/auth/set-password`,
    });

    if (inviteError || !invited.user) {
      throw new Error(inviteError?.message ?? "Could not create the rider account.");
    }

    const riderId = invited.user.id;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ role: "rider", full_name: app.full_name, phone: app.phone, email: app.email })
      .eq("id", riderId);
    if (profileError) throw new Error(profileError.message);

    const { error: riderError } = await supabaseAdmin.from("riders").insert({
      id: riderId,
      status: "approved",
      vehicle_make: null,
      vehicle_model: null,
      vehicle_type: app.vehicle_type,
      plate_number: app.plate_number,
      photo_url: app.photo_url,
      date_of_birth: app.date_of_birth,
      gender: app.gender,
      residential_address: app.residential_address,
      lga: app.lga,
      phone: app.phone,
      drivers_license_number: app.drivers_license_number,
      drivers_license_front_url: app.drivers_license_front_url,
      drivers_license_back_url: app.drivers_license_back_url,
      vehicle_insurance_url: app.vehicle_insurance_url,
      vehicle_ownership: app.vehicle_ownership,
      years_riding_experience: app.years_riding_experience,
      bank_name: app.bank_name,
      account_number: app.account_number,
      account_name: app.account_name,
      next_of_kin_name: app.next_of_kin_name,
      next_of_kin_phone: app.next_of_kin_phone,
      next_of_kin_relationship: app.next_of_kin_relationship,
      referral_source: app.referral_source,
      agreement_accepted_at: app.agreement_accepted_at,
      agreement_signature_name: app.agreement_signature_name,
      application_id: app.id,
    });
    if (riderError) throw new Error(riderError.message);

    const { error: updateError } = await supabaseAdmin
      .from("rider_applications")
      .update({
        status: "approved",
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        promoted_rider_id: riderId,
      })
      .eq("id", app.id);
    if (updateError) throw new Error(updateError.message);

    await supabaseAdmin.from("admin_actions").insert({
      admin_id: context.userId,
      action_type: "approve_rider_application",
      target_table: "rider_applications",
      target_id: app.id,
      details: { promoted_rider_id: riderId } as never,
    });

    return { riderId };
  });

export const rejectRiderApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ applicationId: z.string().uuid(), reason: z.string().trim().min(1) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertIsAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: app, error: fetchError } = await supabaseAdmin
      .from("rider_applications")
      .select("id,status")
      .eq("id", data.applicationId)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);
    if (!app) throw new Response("Not found", { status: 404 });
    if (app.status !== "submitted") throw new Error("Only submitted applications can be rejected.");

    const { error } = await supabaseAdmin
      .from("rider_applications")
      .update({
        status: "rejected",
        rejection_reason: data.reason,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.applicationId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("admin_actions").insert({
      admin_id: context.userId,
      action_type: "reject_rider_application",
      target_table: "rider_applications",
      target_id: data.applicationId,
      details: { reason: data.reason } as never,
    });

    return { rejected: true as const };
  });
