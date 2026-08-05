import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MapProviderService } from "@/lib/map-provider/map-provider.service";

const latLngSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

/**
 * Full driving route between two or more points, with polyline geometry
 * for display. Used for: rider navigation, "route to your door" preview
 * on order tracking. NOT used by dispatch scoring — that stays on
 * Haversine (see dispatch.functions.ts).
 */
export const calculateRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        points: z.array(latLngSchema).min(2, "A route needs at least two points"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const route = await MapProviderService.route(data.points);
    return route;
  });

/** Road distance + duration between exactly two points (no polyline needed). */
export const calculateDistance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        from: latLngSchema,
        to: latLngSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const result = await MapProviderService.distance(data.from, data.to);
    return result;
  });