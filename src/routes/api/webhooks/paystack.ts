import { createFileRoute } from "@tanstack/react-router";

/**
 * Paystack webhook — the ONLY place an order is marked "paid".
 */
async function verifySignature(rawBody: string, signature: string | null, secretKey: string) {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretKey),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const computed = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (computed.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

export const Route = createFileRoute("/api/webhooks/paystack")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secretKey = process.env["PAYSTACK_SECRET_KEY"];
        if (!secretKey) {
          console.error("[paystack-webhook] Missing PAYSTACK_SECRET_KEY");
          return new Response("Server misconfigured", { status: 500 });
        }

        const rawBody = await request.text();
        const signature = request.headers.get("x-paystack-signature");

        const isValid = await verifySignature(rawBody, signature, secretKey);
        if (!isValid) {
          console.warn("[paystack-webhook] Invalid signature — rejecting");
          return new Response("Invalid signature", { status: 401 });
        }

        let event: {
          event?: string;
          data?: { reference?: string; status?: string; amount?: number };
        };
        try {
          event = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        if (event.event !== "charge.success") {
          return new Response("ok", { status: 200 });
        }

        const reference = event.data?.reference;
        if (!reference) {
          return new Response("Missing reference", { status: 400 });
        }

        // Re-verify with Paystack
        const verifyRes = await fetch(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
          { headers: { Authorization: `Bearer ${secretKey}` } },
        );
        const verifyJson = await verifyRes.json();
        if (!verifyRes.ok || verifyJson?.data?.status !== "success") {
          console.warn("[paystack-webhook] Verify call did not confirm success", reference);
          return new Response("Not verified", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: order, error: orderError } = await supabaseAdmin
          .from("orders")
          .select("id,customer_id,status,total_kobo,payment_reference")
          .eq("payment_reference", reference)
          .maybeSingle();

        if (orderError) {
          console.error("[paystack-webhook] Order lookup failed", orderError.message);
          return new Response("Lookup failed", { status: 500 });
        }
        if (!order) {
          console.warn("[paystack-webhook] No order for reference", reference);
          return new Response("Order not found", { status: 404 });
        }

        // Amount safety check
        if (verifyJson.data.amount !== order.total_kobo) {
          console.error(
            "[paystack-webhook] Amount mismatch",
            reference,
            verifyJson.data.amount,
            order.total_kobo,
          );
          return new Response("Amount mismatch", { status: 400 });
        }

        // Idempotency: if already paid, don't double-process
        if (order.status !== "created" && order.status !== "payment_pending" && order.status !== "paid" && order.status !== "placed") {
          return new Response("ok", { status: 200 });
        }

        const paidAt = new Date().toISOString();

        // Update order status to "paid" 
        const { error: updateError } = await supabaseAdmin
          .from("orders")
          .update({ 
            status: "paid", 
            paid_at: paidAt,
            financial_status: "payment_captured"
          })
          .eq("id", order.id);

        if (updateError) {
          console.error("[paystack-webhook] Order update failed", updateError.message);
          return new Response("Update failed", { status: 500 });
        }

        // Insert payment record
        const { error: paymentError } = await supabaseAdmin.from("payments").insert({
          order_id: order.id,
          customer_id: order.customer_id,
          gateway: "paystack",
          gateway_reference: reference,
          amount_kobo: verifyJson.data.amount,
          currency: verifyJson.data.currency ?? "NGN",
          status: "paid",
          payment_method: verifyJson.data.channel ?? "card",
          authorization_code: verifyJson.data.authorization?.authorization_code ?? null,
          transaction_fee_kobo: verifyJson.data.fees ?? null,
          paid_at: verifyJson.data.paid_at ?? paidAt,
          verified_at: paidAt,
        });

        if (paymentError) {
          console.error("[paystack-webhook] Payments insert failed", paymentError.message);
        }

        // Log PaymentSucceeded event
        try {
          await supabaseAdmin.from("order_events").insert({
            order_id: order.id,
            event_type: "PaymentSucceeded",
            event_data: {
              reference: reference,
              amount: verifyJson.data.amount,
              channel: verifyJson.data.channel,
              transaction_id: verifyJson.data.id,
            },
            actor_type: "system",
            actor_id: null,
            created_at: paidAt,
          });
        } catch (eventErr) {
          console.warn("[paystack-webhook] Failed to log PaymentSucceeded event:", eventErr);
        }

        // ⭐ AUTO-ADVANCE TO MERCHANT_PENDING
        try {
          await supabaseAdmin
            .from("orders")
            .update({ 
              status: "merchant_pending",
              merchant_response_deadline: new Date(Date.now() + 60 * 1000).toISOString()
            })
            .eq("id", order.id)
            .eq("status", "paid");
        } catch (advanceErr) {
          console.warn("[paystack-webhook] Failed to advance to merchant_pending:", advanceErr);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});