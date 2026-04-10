/** 可选：前后端不同域时在构建/运行前设置 VITE_API_URL（公网 HTTPS 根地址，无末尾斜杠）。 */
const raw = import.meta.env.VITE_API_URL?.trim() ?? "";
/**
 * 未设置 VITE_API_URL 时使用相对路径（空字符串）：请求当前页面的 origin + /api/...。
 * - 本地 dev：Vite 把 /api 代理到本机后端。
 * - 云端同域：Nginx/Caddy 反代 /api 到 FastAPI，或后端托管 dist（见 backend main.py）。
 */
export const API_BASE = raw.replace(/\/$/, "") || "";

/**
 * 页面是 https 而显式配置的 API 为 http 时，浏览器会拦截（混合内容），表现为 failed to fetch。
 */
export function apiBlockedByMixedContent(): boolean {
  if (typeof window === "undefined") return false;
  if (!API_BASE) return false;
  return (
    window.location.protocol === "https:" && API_BASE.startsWith("http://")
  );
}
