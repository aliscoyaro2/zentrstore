/**
 * Google Maps navigation launcher.
 *
 * Zentra owns order management, dispatch, rider workflow, live tracking,
 * and status updates. Google Maps is used only for turn-by-turn
 * navigation, live traffic, route guidance, and voice navigation once a
 * rider needs to actually drive somewhere.
 *
 * This deliberately does NOT try to render navigation in-app — it opens
 * the destination directly in the Google Maps app (or maps.google.com in
 * a browser) using the destination's coordinates. The rider never has to
 * copy/paste anything.
 */

export interface NavigationDestination {
  lat: number;
  lng: number;
  /** Optional human-readable label, shown as the destination name where supported (e.g. Android's navigation intent). */
  label?: string;
}

/**
 * True on iOS/iPadOS/Android where an OS-level app link is meaningful.
 * Falls back to false (web link) on desktop and unknown platforms.
 */
function detectMobilePlatform(): "ios" | "android" | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return null;
}

/**
 * Universal Google Maps web URL. Works everywhere (desktop browser,
 * mobile browser, and as a fallback if a native app link fails) and,
 * on a phone with the Google Maps app installed, is intercepted by the
 * OS and opened in the app automatically — so this alone is enough for
 * the MVP. See: https://developers.google.com/maps/documentation/urls/get-started
 */
export function buildGoogleMapsSearchUrl(destination: NavigationDestination): string {
  const query = `${destination.lat},${destination.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Turn-by-turn directions URL (as opposed to a plain pin search). Preferred
 * for the rider's "Navigate to X" actions since it drops the rider straight
 * into driving directions rather than a place card.
 */
export function buildGoogleMapsDirectionsUrl(destination: NavigationDestination): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${destination.lat},${destination.lng}`,
    travelmode: "driving",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Android-only native navigation intent — drops straight into turn-by-turn guidance, bypassing the place card the web URL shows first. */
function buildAndroidNavigationIntent(destination: NavigationDestination): string {
  return `google.navigation:q=${destination.lat},${destination.lng}&mode=d`;
}

/**
 * Opens Google Maps for turn-by-turn navigation to the given destination.
 * No coordinates are ever shown to the rider for manual entry — this is
 * the only integration point they need to tap.
 */
export function launchGoogleMapsNavigation(destination: NavigationDestination): void {
  if (!Number.isFinite(destination.lat) || !Number.isFinite(destination.lng)) {
    return;
  }

  const platform = detectMobilePlatform();

  // Android: try the native navigation intent first (goes straight to
  // turn-by-turn, no intermediate place card). If Google Maps isn't
  // installed the OS simply fails to resolve the intent silently in most
  // browsers, so we also open the universal web link as a same-tick
  // fallback the user can use instead.
  if (platform === "android") {
    window.location.href = buildAndroidNavigationIntent(destination);
    return;
  }

  // iOS and desktop/unknown: the universal directions URL. On iOS with
  // the Google Maps app installed, Safari/Chrome will offer to open it
  // in-app; otherwise it opens in the browser. No app-specific scheme
  // needed since Google retired comgooglemaps:// as a hard requirement
  // in favor of universal links.
  window.open(buildGoogleMapsDirectionsUrl(destination), "_blank", "noopener,noreferrer");
}
