/**
 * The deployed site's own origin (e.g. "https://zentra.ng" or a Lovable
 * preview URL) — needed whenever we build a redirect URL for a Supabase
 * auth email (invite, password reset).
 *
 * In the browser this is just `window.location.origin` — always correct,
 * whatever domain/preview URL is currently serving the page.
 *
 * Server-side (inside a server function, e.g. approving an application),
 * there is no request/browser to ask, so it falls back to the SITE_URL
 * env var. This MUST be set correctly in production — a wrong value here
 * means approved merchants/riders land on a broken or wrong URL when they
 * open their invite email.
 */
export function getSiteUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  const configured = process.env["SITE_URL"];
  if (configured) return configured.replace(/\/$/, "");

  console.warn(
    "[site-url] SITE_URL is not set — falling back to a placeholder. " +
      "Invite/reset emails will contain a broken link until this is configured.",
  );
  return "http://localhost:3000";
}
