import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Logs that a rider has physically arrived at the merchant or the
 * customer. Non-blocking for the rider's own flow (the client swallows
 * failures here) — this is for audit/analytics, not a gate.
 */
export const logRiderArrival = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        orderId: z.string().uuid(),
        leg: z.enum(["merchant", "customer"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("log_rider_arrival", {
      p_order_id: data.orderId,
      p_leg: data.leg,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Lets a rider back out of an order already assigned to them (direct
 * assignment or post-acceptance). Runs as a SECURITY DEFINER RPC because
 * the "Rider can update assigned orders" RLS policy on `orders` has no
 * WITH CHECK clause — a client-side update that nulls rider_id re-checks
 * USING against the *new* row (auth.uid() = null) and gets rejected.
 * The RPC resets the order to 'preparing' with no rider, which
 * trg_auto_dispatch_on_preparing picks up to re-dispatch automatically.
 */
export const riderDeclineOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        orderId: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("rider_decline_order", {
      p_order_id: data.orderId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Verifies the 4-digit pickup code the merchant reads to the rider once
 * the order hits 'ready_for_pickup' (code is auto-generated server-side —
 * see generate_pickup_code trigger). On success, advances the order to
 * 'picked_up'. On a wrong code, the RPC logs the mismatch to
 * rider_audit_log and raises, so this simply surfaces that message.
 */
export const verifyPickupCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        orderId: z.string().uuid(),
        code: z.string().length(4),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("verify_pickup_code", {
      p_order_id: data.orderId,
      p_code: data.code,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
