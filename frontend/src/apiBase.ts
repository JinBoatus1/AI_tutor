/** 生产环境在 Vercel（或构建时）设置 VITE_API_URL 为公网后端地址，勿写死 localhost。 */
const raw = import.meta.env.VITE_API_URL?.trim() ?? "";
export const API_BASE = raw.replace(/\/$/, "") || "http://127.0.0.1:8000";

/** 生产构建未带 VITE_API_URL 时，线上会回退到本机地址，他人必现 failed to fetch */
export const apiUrlMissingInProduction =
  import.meta.env.PROD && !raw;

/**
 * 页面是 https（如 Vercel）而 API 是 http 时，浏览器会拦截请求（混合内容），表现为 failed to fetch。
 * 公网 API 须使用 https://
 */
export function apiBlockedByMixedContent(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.location.protocol === "https:" && API_BASE.startsWith("http://")
  );
}
