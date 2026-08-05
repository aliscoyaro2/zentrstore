// API usage logging for the Map Provider Service.
//
// MVP implementation: structured console logging only. This exists as its
// own module so that swapping it for a real sink (a Postgres table, an
// analytics event, etc.) later is a one-file change — nothing that calls
// logMapProviderUsage() needs to know or care where the log ends up.

interface UsageEvent {
  provider: "graphhopper";
  operation: "geocode" | "reverseGeocode" | "route" | "distance";
  durationMs: number;
  success: boolean;
  errorCode?: string;
}

export function logMapProviderUsage(event: UsageEvent) {
  // Deliberately synchronous/fire-and-forget — logging must never slow
  // down or fail a map operation.
  const line = `[map-provider] ${event.provider}.${event.operation} ${event.success ? "ok" : "FAILED"} (${event.durationMs}ms)${event.errorCode ? ` code=${event.errorCode}` : ""}`;
  if (event.success) {
    console.log(line);
  } else {
    console.warn(line);
  }
}

/** Wraps an async operation with timing + success/failure usage logging. */
export async function withUsageLogging<T>(
  operation: UsageEvent["operation"],
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    logMapProviderUsage({ provider: "graphhopper", operation, durationMs: Date.now() - start, success: true });
    return result;
  } catch (err) {
    const errorCode = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : undefined;
    logMapProviderUsage({ provider: "graphhopper", operation, durationMs: Date.now() - start, success: false, errorCode });
    throw err;
  }
}