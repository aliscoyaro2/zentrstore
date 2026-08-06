import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getSiteUrl } from "@/lib/site-url";
import { getOrInviteUser } from "@/lib/application-approval-auth";

/**
 * Admin-only server functions for reviewing merchant applications. Every
 * handler here first confirms the caller is an admin via the `is_admin()`
 * RPC (checked against the caller's own authenticated Supabase client from
 * `requireSupabaseAuth`, i.e. real RLS-respecting auth) before touching
 * `supabaseAdmin` (service role).
 *
 * Mirrors src/lib/rider-application-admin.functions.ts.
 */

async function assertIsAdmin(supabase: import("@supabase/supabase-js").SupabaseClient) {
  const { data, error } = await supabase.rpc("is_admin");
  if (error || data !== true) {
    throw new Response("Forbidden", { status: 403 });
  }
}

const DOCUMENT_COLUMNS = ["cover_photo_url", "owner_id_doc_url", "cac_doc_url"] as const;

// Fallback used only if platform_settings has no row yet — should not
// normally be hit since the row is a singleton seeded at project setup.
const FALLBACK_COMMISSION_PCT = 10;

export const listMerchantApplications = createServerFn({ method: "POST" })
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
      .from("merchant_applications")
      .select(
        "id,status,email,business_name,category,phone,lga,created_at,updated_at,rejection_reason",
      )
      .order("created_at", { ascending: false });

    if (data.status !== "all") query = query.eq("status", data.status);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getMerchantApplicationDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ applicationId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertIsAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: app, error } = await supabaseAdmin
      .from("merchant_applications")
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
        .from("merchant-application-documents")
        .createSignedUrl(path, 60 * 10); // 10 minutes, enough for one review session
      signedUrls[column] = signed?.signedUrl ?? null;
    }

    return { application: app, signedUrls };
  });

export const approveMerchantApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ applicationId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertIsAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: app, error } = await supabaseAdmin
      .from("merchant_applications")
      .select("*")
      .eq("id", data.applicationId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!app) throw new Response("Not found", { status: 404 });
    if (app.status !== "submitted") throw new Error("Only submitted applications can be approved.");

    const { data: settings } = await supabaseAdmin
      .from("platform_settings")
      .select("default_commission_pct")
      .eq("id", true)
      .maybeSingle();
    const commissionPct = settings?.default_commission_pct ?? FALLBACK_COMMISSION_PCT;

    // Activate the real account now — this is the moment the applicant
    // becomes a merchant. The auth user usually already exists (created
    // silently during the application's OTP-verification step), so this
    // reuses it rather than trying to invite a duplicate. Either way, the
    // applicant gets a "set your password" email (Brevo SMTP) linking to
    // /auth/set-password, where they choose their own password before ever
    // landing on the dashboard.
    const ownerId = await getOrInviteUser(
      supabaseAdmin,
      app.email,
      { full_name: app.business_name, role: "merchant" },
      `${getSiteUrl()}/auth/set-password`,
    );

    // Upsert, not update: nothing in the database auto-creates a `profiles`
    // row when an auth user is created (there's no DB trigger on
    // auth.users), so for a brand-new applicant this row may not exist yet.
    // A plain `.update()` would silently affect 0 rows in that case, then
    // the `merchants` insert below would fail its FK to `profiles.id` (the
    // same "violates foreign key constraint" error seen on the rider side).
    // Upsert guarantees the row exists either way.
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: ownerId, role: "merchant", full_name: app.business_name, phone: app.phone, email: app.email });
    if (profileError) throw new Error(profileError.message);

    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("merchants")
      .insert({
        owner_id: ownerId,
        business_name: app.business_name ?? "Unnamed store",
        category: app.category ?? "grocery",
        business_description: app.business_description,
        address_text: app.address_text,
        // No geocoding step in this application flow yet — placeholder
        // Maiduguri coordinates, same default the old direct-insert form
        // used. Merchant can be relocated precisely from the admin panel.
        lat: 11.8311,
        lng: 13.151,
        commission_pct: commissionPct,
        phone: app.phone,
        opening_time: app.opening_time,
        closing_time: app.closing_time,
        prep_time_mins: app.prep_time_mins,
        self_delivery: app.self_delivery ?? false,
        pos_available: app.pos_available ?? false,
        cover_photo_url: app.cover_photo_url,
          bank_name: app.bank_name,
        bank_account_number: app.account_number,
        bank_account_name: app.account_name,
        status: "approved",
      })
      .select("id")
      .single();
    if (merchantError || !merchant) throw new Error(merchantError?.message ?? "Could not create the merchant record.");

    const { error: updateError } = await supabaseAdmin
      .from("merchant_applications")
      .update({
        status: "approved",
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        promoted_merchant_id: merchant.id,
      })
      .eq("id", app.id);
    if (updateError) throw new Error(updateError.message);

    await supabaseAdmin.from("admin_actions").insert({
      admin_id: context.userId,
      action_type: "approve_merchant_application",
      target_table: "merchant_applications",
      target_id: app.id,
      details: { promoted_merchant_id: merchant.id } as never,
    });

    return { merchantId: merchant.id as string };
  });

export const rejectMerchantApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ applicationId: z.string().uuid(), reason: z.string().trim().min(1) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertIsAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: app, error: fetchError } = await supabaseAdmin
      .from("merchant_applications")
      .select("id,status")
      .eq("id", data.applicationId)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);
    if (!app) throw new Response("Not found", { status: 404 });
    if (app.status !== "submitted") throw new Error("Only submitted applications can be rejected.");

    const { error } = await supabaseAdmin
      .from("merchant_applications")
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
      action_type: "reject_merchant_application",
      target_table: "merchant_applications",
      target_id: data.applicationId,
      details: { reason: data.reason } as never,
    });

    return { rejected: true as const };
  });
