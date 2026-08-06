import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Logs that a rider has physically arrived at the merchant or the customer.
 * Non-blocking for the rider's own flow — audit/analytics only.
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
    const { error } = await supabase.from("order_events").insert({
      order_id: data.orderId,
      actor_type: "rider",
      actor_id: context.userId,
      event_type: data.leg === "merchant" ? "rider_arrived_merchant" : "rider_arrived_customer",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Lets a rider back out of an order already assigned to them (direct
 * assignment or post-acceptance). Runs as SECURITY DEFINER because the
 * "Rider can update assigned orders" RLS policy has no WITH CHECK clause,
 * so a client-side update that nulls rider_id re-evaluates the USING
 * clause against the *new* row (auth.uid() = null) and is rejected.
 * Resets the order to 'preparing' with no rider, which trg_auto_dispatch_on_preparing
 * picks up to re-dispatch automatically.
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
 * Verifies the 4-digit pickup code the merchant reads to the rider once the
 * order hits 'ready_for_pickup'. On success advances the order to 'picked_up'.
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
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, pickup_code")
      .eq("id", data.orderId)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);
    if (!order) throw new Error("Order not found");
    if (order.pickup_code !== data.code) throw new Error("Incorrect pickup code");

    const { error } = await supabase
      .from("orders")
      .update({ status: "picked_up" })
      .eq("id", data.orderId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
