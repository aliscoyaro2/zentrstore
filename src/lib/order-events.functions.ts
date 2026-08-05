import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ActorType = 'customer' | 'merchant' | 'rider' | 'system' | 'admin';

/**
 * Log an immutable event for an order.
 * This is the foundation of the event-driven architecture.
 * Every major action should call this function.
 */
export const logOrderEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      orderId: z.string().uuid(),
      eventType: z.string(),
      eventData: z.record(z.unknown()).default({}),
      actorType: z.enum(['customer', 'merchant', 'rider', 'system', 'admin']),
      actorId: z.string().uuid().optional(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // If actorId not provided, use the current user
    const actorId = data.actorId || userId;

    // Insert the event
    const { error } = await supabase
      .from("order_events")
      .insert({
        order_id: data.orderId,
        event_type: data.eventType,
        event_data: data.eventData,
        actor_type: data.actorType,
        actor_id: actorId,
      });

    if (error) throw new Error(`Failed to log event: ${error.message}`);

    return { success: true };
  });

/**
 * Get the full event timeline for an order
 */
export const getOrderTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      orderId: z.string().uuid(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: events, error } = await supabase
      .from("order_events")
      .select("*")
      .eq("order_id", data.orderId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(`Failed to fetch timeline: ${error.message}`);

    return events;
  });

/**
 * Get the current status of an order (derived from events)
 * This is a projection, not the source of truth
 */
export const getOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      orderId: z.string().uuid(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: order, error } = await supabase
      .from("orders")
      .select("status, financial_status")
      .eq("id", data.orderId)
      .single();

    if (error) throw new Error(`Failed to fetch status: ${error.message}`);

    return order;
  });

/**
 * Update order status with automatic event logging
 * This wraps the status update and logs it as an event
 */
export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      orderId: z.string().uuid(),
      status: z.string(),
      financialStatus: z.string().optional(),
      eventType: z.string(),
      eventData: z.record(z.unknown()).default({}),
      actorType: z.enum(['customer', 'merchant', 'rider', 'system', 'admin']),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Build the update payload
    const updatePayload: Record<string, unknown> = {
      status: data.status,
    };

    if (data.financialStatus) {
      updatePayload["financial_status"] = data.financialStatus;
    }

    // Update the order
    const { error: updateError } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", data.orderId);

    if (updateError) throw new Error(`Failed to update status: ${updateError.message}`);

    // Log the event
    await logOrderEvent({
      data: {
        orderId: data.orderId,
        eventType: data.eventType,
        eventData: { ...data.eventData, new_status: data.status, ...(data.financialStatus && { new_financial_status: data.financialStatus }) },
        actorType: data.actorType,
        actorId: userId,
      },
    });

    return { success: true, status: data.status };
  });