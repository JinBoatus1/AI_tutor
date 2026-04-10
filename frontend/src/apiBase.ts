/** 生产环境在 Vercel（或构建时）设置 VITE_API_URL 为公网后端地址，勿写死 localhost。 */
const raw = import.meta.env.VITE_API_URL?.trim() ?? "";
/**
 * 开发模式默认用空字符串：请求发到当前页面 origin，由 Vite 把 /api 代理到本机后端。
 * 这样别人用 http://你的局域网IP:5173 打开时，不会错误地请求他们电脑上的 127.0.0.1。
 */
export const API_BASE =
  raw.replace(/\/$/, "") ||
  (import.meta.env.DEV ? "" : "http://127.0.0.1:8000");

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
