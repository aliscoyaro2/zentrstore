// MapErrorHandler — the one place that decides how a raw failure (a
// thrown error, a bad HTTP status, a malformed response) becomes a
// MapProviderError with a stable `code`, and whether an operation is
// worth retrying.
//
// Nothing outside map-provider/ should be constructing MapProviderError
// directly from a caught exception — route through normalizeError so the
// error `code` stays consistent no matter where the failure happened.

import { MapProviderError } from "./types";

/** Maps an HTTP status from GraphHopper (or any future provider) to a stable internal error code. */
export function httpStatusToErrorCode(status: number): MapProviderError["code"] {
  if (status === 429) return "RATE_LIMITED";
  if (status === 404) return "NOT_FOUND";
  if (status >= 400 && status < 500) return "INVALID_COORDINATES";
  return "PROVIDER_ERROR";
}

/** Normalizes any caught error into a MapProviderError, preserving a MapProviderError as-is. */
export function normalizeError(err: unknown): MapProviderError {
  if (err instanceof MapProviderError) return err;

  if (err instanceof Error) {
    return new MapProviderError(err.message || "Map provider request failed", "PROVIDER_ERROR", err);
  }

  return new MapProviderError("Map provider request failed", "PROVIDER_ERROR", err);
}

const RETRYABLE_CODES: ReadonlyArray<MapProviderError["code"]> = ["NETWORK_ERROR", "RATE_LIMITED", "PROVIDER_ERROR"];

function isRetryable(err: unknown): boolean {
  const normalized = normalizeError(err);
  return RETRYABLE_CODES.includes(normalized.code);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries a provider call up to `maxAttempts` times with exponential
 * backoff, but only for error codes worth retrying (network blips, rate
 * limits, transient provider errors). Validation errors (bad coordinates,
 * empty query, not-found) fail fast — retrying them would just waste
 * calls on a request that can never succeed.
 */
export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3, baseDelayMs = 300): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const normalized = normalizeError(err);

      if (attempt === maxAttempts || !isRetryable(normalized)) {
        throw normalized;
      }

      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  // Unreachable — the loop above always returns or throws — but keeps TS happy.
  throw normalizeError(lastError);
}
