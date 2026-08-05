import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MapProviderService } from "@/lib/map-provider/map-provider.service";

const latLngSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

/**
 * ETA from one point to another, e.g. "rider's current location -> customer
 * address" for the live order-tracking screen. This is a thin wrapper over
 * MapProviderService.eta(), kept as its own file because ETA is a distinct
 * product concern (shown directly to customers/riders) even though it's
 * built on the same underlying route calculation as calculateDistance.
 */
export const calculateEta = createServerFn({ method: "POST" })
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
    const result = await MapProviderService.eta(data.from, data.to);
    return result;
  });