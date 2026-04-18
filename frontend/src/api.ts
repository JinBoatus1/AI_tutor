declare global {
  interface Window {
    __API_BASE_URL__?: string;
  }
}

const rawApiBase = (typeof window !== "undefined" ? window.__API_BASE_URL__ : "")?.trim() ?? "";
const normalizedApiBase = rawApiBase.replace(/\/$/, "");
const localBackendBase = "http://127.0.0.1:8000";

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return normalizedApiBase ? `${normalizedApiBase}${normalizedPath}` : normalizedPath;
}

export function apiCandidates(path: string): string[] {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const primary = apiUrl(normalizedPath);
  const fallback = `${localBackendBase}${normalizedPath}`;
  return primary === fallback ? [primary] : [primary, fallback];
}
