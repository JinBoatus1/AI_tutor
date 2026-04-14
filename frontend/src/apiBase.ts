/** Optional: set VITE_API_URL before build/run when frontend and API differ (public HTTPS origin, no trailing slash). */
const raw = import.meta.env.VITE_API_URL?.trim() ?? "";
/**
 * If VITE_API_URL is unset, use a relative base (""): requests go to current origin + /api/...
 * - Local dev: Vite proxies /api to the backend.
 * - Same-origin deploy: reverse-proxy /api to FastAPI, or serve dist from the backend (see backend main.py).
 */
function normalizeBase(built: string): string {
  let b = built.replace(/\/$/, "").trim() || "";
  // In production, never keep a loopback API URL—remote users would hit their own machine.
  const loopback =
    /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(b) ||
    /^\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(b);
  if (loopback && import.meta.env.PROD && typeof window !== "undefined") {
    return "";
  }
  return b;
}

export const API_BASE = normalizeBase(raw);

/**
 * HTTPS page + explicit http:// API triggers mixed-content blocking (failed to fetch).
 */
export function apiBlockedByMixedContent(): boolean {
  if (typeof window === "undefined") return false;
  if (!API_BASE) return false;
  return (
    window.location.protocol === "https:" && API_BASE.startsWith("http://")
  );
}
