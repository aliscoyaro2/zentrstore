import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getSiteUrl } from "@/lib/site-url";

// Default permissions per role
function getDefaultPermissions(role: string) {
  switch (role) {
    case "owner":
      return { dashboard: "full", orders: "full", products: "full", staff: "full", settings: "full", financials: "full" };
    case "manager":
      return { dashboard: "full", orders: "full", products: "full", staff: "view", settings: "view", financials: "view" };
    case "cashier":
      return { dashboard: "view", orders: "full", products: "none", staff: "none", settings: "none", financials: "none" };
    case "kitchen":
      return { dashboard: "view", orders: "full", products: "none", staff: "none", settings: "none", financials: "none" };
    case "rider_coordinator":
      return { dashboard: "full", orders: "full", products: "none", staff: "none", settings: "none", financials: "none" };
    default:
      return { dashboard: "view", orders: "view", products: "none", staff: "none", settings: "none", financials: "none" };
  }
}

export const inviteStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      storeId: z.string().uuid(),
      email: z.string().email(),
      role: z.enum(["manager", "cashier", "kitchen", "rider_coordinator"]),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { storeId, email, role } = data;

    // 1. Check if user already exists in profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (profileError) {
      throw new Error("Error checking user: " + profileError.message);
    }

    let targetUserId: string;

    if (!profile) {
      // User doesn't exist – we'll invite them to create an account
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      
      // Get store name for the email
      const { data: store } = await supabase
        .from("merchants")
        .select("business_name")
        .eq("id", storeId)
        .single();

      const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email.toLowerCase(),
        {
          data: {
            role: "staff",
            store_name: store?.business_name ?? "Zentra store",
            staff_role: role,
          },
          redirectTo: `${getSiteUrl()}/auth/set-password`,
        }
      );

      if (inviteError || !invited.user) {
        throw new Error(inviteError?.message ?? "Could not send invite email.");
      }

      targetUserId = invited.user.id;

      // Create profile for the new user
      const { error: profileInsertError } = await supabaseAdmin
        .from("profiles")
        .update({ email: email.toLowerCase() })
        .eq("id", targetUserId);

      if (profileInsertError) {
        throw new Error("Could not create profile: " + profileInsertError.message);
      }

    } else {
      targetUserId = profile.id;

      // Check if already staff
      const { data: existing } = await supabase
        .from("store_staff")
        .select("id")
        .eq("store_id", storeId)
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (existing) {
        throw new Error("This user is already staff at this store.");
      }

      // Check if user is already staff at another store (optional – can be allowed or blocked)
      const { data: otherStore } = await supabase
        .from("store_staff")
        .select("store_id, merchants(business_name)")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (otherStore) {
        // They already work at another store – we can either allow or block
        // For now, we'll allow it (people can work at multiple stores)
        console.log("User already works at:", otherStore);
      }
    }

    // 2. Insert staff record
    const { error: insertError } = await supabase
      .from("store_staff")
      .insert({
        store_id: storeId,
        user_id: targetUserId,
        role: role,
        invited_by: userId,
        permissions: getDefaultPermissions(role),
        accepted_at: profile ? new Date().toISOString() : null, // If user already existed, mark as accepted
      });

    if (insertError) {
      throw new Error("Could not add staff: " + insertError.message);
    }

    // 3. Log the action
    await supabase.from("admin_actions").insert({
      admin_id: userId,
      action_type: "invite_staff",
      target_table: "store_staff",
      target_id: targetUserId,
      details: { store_id: storeId, role, email } as never,
    });

    return { 
      success: true, 
      email, 
      role, 
      userExists: !!profile,
      message: profile 
        ? `${email} has been added as ${role}.` 
        : `Invitation sent to ${email}. They will receive an email to set up their account.`
    };
  });

// Get staff list with profiles
export const getStaffList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      storeId: z.string().uuid(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { storeId } = data;

    const { data: staff, error } = await supabase
      .from("store_staff")
      .select(`
        id,
        role,
        permissions,
        invited_at,
        accepted_at,
        profiles:user_id (
          id,
          full_name,
          email,
          phone
        )
      `)
      .eq("store_id", storeId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return staff;
  });

// Remove staff member
export const removeStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      staffId: z.string().uuid(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { staffId } = data;

    // Check if user is removing themselves
    const { data: staff } = await supabase
      .from("store_staff")
      .select("user_id")
      .eq("id", staffId)
      .single();

    if (staff && staff.user_id === userId) {
      throw new Error("You cannot remove yourself. Transfer ownership first.");
    }

    const { error } = await supabase
      .from("store_staff")
      .delete()
      .eq("id", staffId);

    if (error) throw new Error(error.message);

    await supabase.from("admin_actions").insert({
      admin_id: userId,
      action_type: "remove_staff",
      target_table: "store_staff",
      target_id: staffId,
      details: {} as never,
    });

    return { success: true };
  });

// Update staff role
export const updateStaffRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      staffId: z.string().uuid(),
      role: z.enum(["manager", "cashier", "kitchen", "rider_coordinator"]),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { staffId, role } = data;

    const { error } = await supabase
      .from("store_staff")
      .update({ 
        role: role,
        permissions: getDefaultPermissions(role),
      })
      .eq("id", staffId);

    if (error) throw new Error(error.message);

    await supabase.from("admin_actions").insert({
      admin_id: userId,
      action_type: "update_staff_role",
      target_table: "store_staff",
      target_id: staffId,
      details: { new_role: role } as never,
    });

    return { success: true, role };
  });