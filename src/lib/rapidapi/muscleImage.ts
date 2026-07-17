/**
 * Muscle Group Image Generator — V3 API.
 * The "single-color highlight" endpoint is /v2/images/single with `muscles` (comma-separated).
 * Some subscribed tiers may still expose the legacy /getImage — see the /api/muscle-image
 * route which handles both by attempting v2 first with a v1 fallback.
 *
 * We expose `highlightUrl` returning our own proxy URL so the RapidAPI key stays server-side.
 */

export const muscleImage = {
  highlightUrl: (muscles: string[], color = "#FF6B35", transparent = false): string => {
    const q = new URLSearchParams({
      muscles: muscles.join(","),
      color,
      transparent: transparent ? "true" : "false",
    });
    return `/api/muscle-image?${q.toString()}`;
  },
};
