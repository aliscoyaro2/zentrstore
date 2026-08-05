import { createFileRoute } from "@tanstack/react-router";

/**
 * Paystack webhook — the ONLY place an order is marked "paid".
 *
 * Do not trust the browser redirect after checkout to mean payment
 * succeeded (network drops, closed tabs, or a forged callback URL could
 * all fake that). Paystack calls this URL server-to-server whenever a
 * transaction event happens, so this is the actual source of truth.
 *
 * Steps, in order, and why each matters:
 *  1. Verify the `x-paystack-signature` header (HMAC-SHA512 of the RAW
 *     body, keyed with the secret key) before touching anything else —
 *     an unverified request could be anyone claiming to be Paystack.
 *  2. Only act on `charge.success`.
 *  3. Re-verify the transaction directly with Paystack's own
 *     `/transaction/verify` endpoint using the reference from the event —
 *     defense in depth against a leaked/forged signature, and it also
 *     confirms the amount actually paid matches what we expect.
 *  4. Update the order + insert a payments row using the service-role
 *     client, since RLS intentionally does not allow customers to update
 *     their own orders (this update must not be something a client can
 *     forge from the browser).
 *  5. Always return 200 quickly once verified, so Paystack doesn't retry
 *     unnecessarily; return non-200 only when verification genuinely fails.
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

  // Constant-time-ish comparison: lengths must match, then compare all bytes.
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
          // Not an event we act on (e.g. charge.failed) — acknowledge and stop.
          return new Response("ok", { status: 200 });
        }

        const reference = event.data?.reference;
        if (!reference) {
          return new Response("Missing reference", { status: 400 });
        }

        // Re-verify directly with Paystack rather than trusting the webhook
        // payload's amount/status alone.
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

        // Amount safety check: Paystack amount is in kobo already, matching our columns.
        if (verifyJson.data.amount !== order.total_kobo) {
          console.error(
            "[paystack-webhook] Amount mismatch",
            reference,
            verifyJson.data.amount,
            order.total_kobo,
          );
          return new Response("Amount mismatch", { status: 400 });
        }

        // Idempotency: if already paid (Paystack retries webhooks), don't double-insert.
        if (order.status !== "placed") {
          return new Response("ok", { status: 200 });
        }

        const paidAt = new Date().toISOString();

        const { error: updateError } = await supabaseAdmin
          .from("orders")
          .update({ status: "paid", paid_at: paidAt })
          .eq("id", order.id)
          .eq("status", "placed"); // extra guard against a race with a concurrent webhook retry

        if (updateError) {
          console.error("[paystack-webhook] Order update failed", updateError.message);
          return new Response("Update failed", { status: 500 });
        }

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
          // Order is already marked paid at this point; log loudly so it can be
          // reconciled manually rather than silently losing the payments row.
          console.error("[paystack-webhook] Payments insert failed", paymentError.message);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
