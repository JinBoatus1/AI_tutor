/**
 * Optional: set VITE_API_URL when the frontend and API are on different origins.
 * Use either the site origin only (`https://api.example.com`) or the same value with `/api`
 * (`https://api.example.com/api`). Both work: `apiUrl()` avoids generating `/api/api/...`.
 */
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
 * Build a full API URL. If `VITE_API_URL` / `API_BASE` already ends with `/api` (common in reverse-proxy
 * setups), strips the duplicate so we never request `/api/api/...` (which often 404s).
 */
export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = API_BASE.replace(/\/$/, "");
  if (!base) {
    return normalizedPath;
  }
  if (/\/api$/i.test(base)) {
    return base + normalizedPath.replace(/^\/api(?=\/)/, "");
  }
  return base + normalizedPath;
}

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
