import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Placeholder for the Paystack verification callback: until the live Paystack
 * keys are wired up, confirming payment marks the order paid so the rest of the
 * flow (merchant accept → rider → delivery) can run. Online payment only —
 * there is no cash-on-delivery path anywhere in the product.
 */
export const confirmOrderPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: order, error } = await supabase
      .from("orders")
      .select("id,customer_id,status,total_kobo,payment_reference")
      .eq("id", data.orderId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!order || order.customer_id !== userId) {
      throw new Response("Not found", { status: 404 });
    }
    if (order.status !== "placed") return { status: order.status };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const paidAt = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({ status: "paid", paid_at: paidAt })
      .eq("id", order.id);
    if (updateError) throw new Error(updateError.message);

    await supabaseAdmin.from("payments").insert({
      order_id: order.id,
      customer_id: userId,
      gateway: "paystack",
      gateway_reference: order.payment_reference,
      amount_kobo: order.total_kobo,
      status: "paid",
      payment_method: "card",
      paid_at: paidAt,
      verified_at: paidAt,
    });

    return { status: "paid" as const };
  });
