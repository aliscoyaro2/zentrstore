import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/client.server";

const offerInput = (data: unknown) =>
  z.object({ offerId: z.string().uuid() }).parse(data);

/** Rider accepts a dispatch offer: claim the order and decline sibling offers. */
export const acceptOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(offerInput)
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: offer, error: offerError } = await supabase
      .from("order_offers")
      .select("id, order_id, rider_id, status, expires_at")
      .eq("id", data.offerId)
      .maybeSingle();

    if (offerError) throw new Error(offerError.message);
    if (!offer) throw new Error("Offer not found");
    if (offer.status !== "pending") throw new Error("This offer is no longer available");
    if (new Date(offer.expires_at) < new Date()) throw new Error("This offer has expired");

    const now = new Date().toISOString();

    const { error: claimError } = await supabase
      .from("orders")
      .update({
        rider_id: offer.rider_id,
        status: "rider_assigned",
        rider_assigned_at: now,
      } as never)
      .eq("id", offer.order_id)
      .is("rider_id", null);

    if (claimError) throw new Error(claimError.message);

    const { error: acceptError } = await supabase
      .from("order_offers")
      .update({ status: "accepted", responded_at: now } as never)
      .eq("id", offer.id);

    if (acceptError) throw new Error(acceptError.message);

    // Any other pending offers for this order are now void.
    await supabase
      .from("order_offers")
      .update({ status: "expired", responded_at: now } as never)
      .eq("order_id", offer.order_id)
      .eq("status", "pending")
      .neq("id", offer.id);

    return { orderId: offer.order_id };
  });

/** Rider declines a dispatch offer. */
export const declineOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(offerInput)
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { error } = await supabase
      .from("order_offers")
      .update({ status: "declined", responded_at: new Date().toISOString() } as never)
      .eq("id", data.offerId)
      .eq("status", "pending");

    if (error) throw new Error(error.message);
    return { ok: true };
  });
