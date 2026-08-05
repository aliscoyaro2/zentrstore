import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logOrderEvent } from "./order-events.functions";

/**
 * Merchant accepts an order
 */
export const merchantAcceptOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      orderId: z.string().uuid(),
      prepTimeMins: z.number().min(5).max(60),
      notes: z.string().optional(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        id,
        merchant_id,
        status,
        merchants!inner (
          owner_id,
          business_name
        )
      `)
      .eq("id", data.orderId)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found");
    }

    if (order.merchants.owner_id !== userId) {
      throw new Response("Forbidden", { status: 403 });
    }

    if (order.status !== "paid" && order.status !== "merchant_pending" && order.status !== "placed") {
      throw new Error(`Order is already ${order.status}, cannot accept.`);
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "merchant_accepted",
        prep_time_mins: data.prepTimeMins,
        merchant_notes: data.notes || null,
        merchant_accepted_at: new Date().toISOString(),
      })
      .eq("id", data.orderId);

    if (updateError) {
      throw new Error(`Failed to accept order: ${updateError.message}`);
    }

    await logOrderEvent({
      data: {
        orderId: data.orderId,
        eventType: "MerchantAccepted",
        eventData: {
          merchant_id: order.merchant_id,
          prep_time_mins: data.prepTimeMins,
          notes: data.notes || null,
        },
        actorType: "merchant",
        actorId: userId,
      },
    });

    return {
      success: true,
      status: "merchant_accepted",
      orderId: data.orderId,
    };
  });

/**
 * Merchant rejects an order
 */
export const merchantRejectOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      orderId: z.string().uuid(),
      reason: z.string().min(1, "Please provide a reason for rejecting."),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        id,
        merchant_id,
        status,
        merchants!inner (
          owner_id,
          business_name
        )
      `)
      .eq("id", data.orderId)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found");
    }

    if (order.merchants.owner_id !== userId) {
      throw new Response("Forbidden", { status: 403 });
    }

    if (order.status !== "paid" && order.status !== "merchant_pending" && order.status !== "placed") {
      throw new Error(`Order is already ${order.status}, cannot reject.`);
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "merchant_rejected",
        cancel_reason: data.reason,
        cancelled_at: new Date().toISOString(),
        financial_status: "refund_pending",
      })
      .eq("id", data.orderId);

    if (updateError) {
      throw new Error(`Failed to reject order: ${updateError.message}`);
    }

    await logOrderEvent({
      data: {
        orderId: data.orderId,
        eventType: "MerchantRejected",
        eventData: {
          merchant_id: order.merchant_id,
          reason: data.reason,
        },
        actorType: "merchant",
        actorId: userId,
      },
    });

    return {
      success: true,
      status: "merchant_rejected",
      orderId: data.orderId,
    };
  });

/**
 * Merchant marks order as "ready for pickup"
 */
export const merchantMarkReady = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      orderId: z.string().uuid(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        id,
        merchant_id,
        status,
        prep_time_mins,
        merchants!inner (
          owner_id,
          business_name,
          lat,
          lng,
          delivery_radius_km
        )
      `)
      .eq("id", data.orderId)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found");
    }

    if (order.merchants.owner_id !== userId) {
      throw new Response("Forbidden", { status: 403 });
    }

    if (order.status !== "merchant_accepted") {
      throw new Error(`Order is ${order.status}, cannot mark ready. Only merchant_accepted orders can be marked ready.`);
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "preparing",
        ready_for_pickup_at: new Date().toISOString(),
      })
      .eq("id", data.orderId);

    if (updateError) {
      throw new Error(`Failed to mark ready: ${updateError.message}`);
    }

    await logOrderEvent({
      data: {
        orderId: data.orderId,
        eventType: "ReadyForPickup",
        eventData: {
          merchant_id: order.merchant_id,
          prep_time_actual: order.prep_time_mins,
        },
        actorType: "merchant",
        actorId: userId,
      },
    });

    // Dispatch will be triggered in Stage 3
    try {
      const { dispatchOrder } = await import("./dispatch.functions");
      await dispatchOrder({ data: { orderId: data.orderId } });
    } catch (dispatchErr) {
      console.warn("[merchantMarkReady] Dispatch not available yet:", dispatchErr);
    }

    return {
      success: true,
      status: "preparing",
      orderId: data.orderId,
      message: "Order marked ready for pickup. Looking for riders...",
    };
  });

/**
 * Get merchant orders with filtering
 */
export const getMerchantOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      status: z.enum([
        "all",
        "pending",
        "active",
        "completed",
        "cancelled"
      ]).default("all"),
      limit: z.number().default(50),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Find the merchant's store
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();

    if (merchantError) {
      console.error("[getMerchantOrders] Merchant lookup error:", merchantError);
      throw new Error(`Failed to find store: ${merchantError.message}`);
    }

    if (!merchant) {
      console.warn("[getMerchantOrders] No store found for user:", userId);
      return [];
    }

    // 2. Build the query
    let query = supabase
      .from("orders")
      .select(`
        id,
        status,
        total_kobo,
        placed_at,
        paid_at,
        prep_time_mins,
        ready_for_pickup_at,
        customer_id,
        profiles:customer_id (
          full_name,
          phone
        ),
        order_items (
          id,
          quantity,
          unit_price_kobo,
          products (
            name
          )
        )
      `)
      .eq("merchant_id", merchant.id)
      .order("placed_at", { ascending: false })
      .limit(data.limit);

    // 3. Apply status filter
    if (data.status === "pending") {
      query = query.in("status", [
        "placed",
        "created",
        "payment_pending",
        "paid",
        "merchant_pending"
      ]);
    } else if (data.status === "active") {
      query = query.in("status", [
        "merchant_accepted",
        "preparing",
        "dispatch_scheduled",
        "dispatching",
        "rider_offered",
        "rider_assigned",
        "rider_en_route_to_merchant",
        "ready_for_pickup",
        "picked_up",
        "en_route_to_customer",
        "rider_en_route_to_customer"
      ]);
    } else if (data.status === "completed") {
      query = query.in("status", ["delivered", "completed"]);
    } else if (data.status === "cancelled") {
      query = query.in("status", [
        "cancelled",
        "refunded",
        "merchant_rejected"
      ]);
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error("[getMerchantOrders] Query error:", error);
      throw new Error(`Failed to fetch orders: ${error.message}`);
    }

    return orders || [];
  });

/**
 * Auto-reject expired orders
 */
export const autoRejectExpiredOrders = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = new Date().toISOString();

    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select("id, merchant_id")
      .eq("status", "merchant_pending")
      .lt("merchant_response_deadline", now);

    if (error) {
      throw new Error(`Failed to find expired orders: ${error.message}`);
    }

    const results = [];
    for (const order of orders || []) {
      const { error: updateError } = await supabaseAdmin
        .from("orders")
        .update({
          status: "merchant_rejected",
          cancel_reason: "Merchant did not respond in time",
          cancelled_at: now,
          financial_status: "refund_pending",
        })
        .eq("id", order.id);

      if (updateError) {
        console.error(`Failed to auto-reject order ${order.id}:`, updateError);
        results.push({ orderId: order.id, success: false, error: updateError.message });
        continue;
      }

      await supabaseAdmin.from("order_events").insert({
        order_id: order.id,
        event_type: "MerchantRejected",
        event_data: { reason: "Auto-rejected: merchant did not respond in time" },
        actor_type: "system",
        actor_id: null,
        created_at: now,
      });

      results.push({ orderId: order.id, success: true });
    }

    return {
      processed: results.length,
      results,
    };
  });