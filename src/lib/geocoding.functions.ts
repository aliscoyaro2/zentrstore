import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MapProviderService } from "@/lib/map-provider/map-provider.service";

const latLngSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

/** Address search / forward geocoding — e.g. the input box on the address picker. */
export const searchAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        query: z.string().trim().min(2, "Type at least 2 characters"),
        near: latLngSchema.optional(),
        limit: z.number().int().min(1).max(10).default(5),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const results = await MapProviderService.geocode(data.query, { ...(data.near ? { near: data.near } : {}), limit: data.limit });
    return { results };
  });

/** Reverse geocoding — turn a dropped pin / current GPS position into a readable address. */
export const reverseGeocodeLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => latLngSchema.parse(data))
  .handler(async ({ data }) => {
    const result = await MapProviderService.reverseGeocode(data);
    return result;
  });