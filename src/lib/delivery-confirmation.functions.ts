import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Customer confirms a rider-marked-delivered order. This is the only path
 * that moves an order from 'delivered' -> 'completed'. Rider payout
 * (rider_balances + ledger row) is triggered server-side by
 * update_rider_balance() only once the order reaches 'completed' — see
 * migration `add_delivery_confirmation_flow`.
 *
 * Ownership + status eligibility are enforced inside the confirm_delivery()
 * Postgres function itself (checks customer_id = auth.uid() and
 * status = 'delivered'), so this wrapper is thin by design.
 */
export const confirmDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { error } = await supabase.rpc("confirm_delivery", {
      p_order_id: data.orderId,
    });

    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Customer reports a problem with a delivered order instead of confirming
 * it. Does NOT change order status — it flags the order for admin/support
 * follow-up (customer_report_reason + a rider_audit_log entry) without
 * blocking the 24h auto-complete safety net, so a rider isn't stuck unpaid
 * indefinitely over an unresolved dispute.
 */
export const reportDeliveryProblem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        orderId: z.string().uuid(),
        reason: z.string().trim().min(1, "Tell us what went wrong").max(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { error } = await supabase.rpc("report_delivery_problem", {
      p_order_id: data.orderId,
      p_reason: data.reason,
    });

    if (error) throw new Error(error.message);
    return { ok: true };
  });
