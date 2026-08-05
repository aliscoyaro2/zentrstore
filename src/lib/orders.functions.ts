import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Starts a real Paystack transaction for an order that was just created at
 * checkout. Returns the hosted Paystack payment page URL for the client to
 * redirect to. The order is NOT marked paid here — only the Paystack webhook
 * (routes/api/webhooks/paystack.ts) is trusted to do that, since it's the
 * only source of truth that money actually moved.
 */
export const initPaystackPayment = createServerFn({ method: "POST" })
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

    // ✅ FIXED: Accept both 'created' and 'payment_pending' statuses
    if (order.status !== "created" && order.status !== "payment_pending") {
      throw new Error(`Order is already ${order.status}, cannot start payment.`);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);
    if (!profile?.email) throw new Error("No email on file for this account.");

    const secretKey = process.env["PAYSTACK_SECRET_KEY"];
    if (!secretKey) {
      throw new Error("Missing PAYSTACK_SECRET_KEY. Set it in Supabase Edge Function secrets.");
    }

    const siteUrl = process.env["SITE_URL"] ?? "https://zentrastore-pearl.vercel.app";

    const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: profile.email,
        amount: order.total_kobo,
        currency: "NGN",
        reference: order.payment_reference,
        callback_url: `${siteUrl}/customer/payment-status/${order.id}`,
        metadata: {
          order_id: order.id,
          customer_id: userId,
        },
      }),
    });

    const initJson = await initRes.json();
    if (!initRes.ok || !initJson?.status) {
      throw new Error(initJson?.message ?? "Could not start Paystack transaction.");
    }

    return {
      authorizationUrl: initJson.data.authorization_url as string,
      reference: initJson.data.reference as string,
    };
  });