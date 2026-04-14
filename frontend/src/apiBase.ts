/** 可选：前后端不同域时在构建/运行前设置 VITE_API_URL（公网 HTTPS 根地址，无末尾斜杠）。 */
const raw = import.meta.env.VITE_API_URL?.trim() ?? "";
/**
 * 未设置 VITE_API_URL 时使用相对路径（空字符串）：请求当前页面的 origin + /api/...。
 * - 本地 dev：Vite 把 /api 代理到本机后端。
 * - 云端同域：Nginx/Caddy 反代 /api 到 FastAPI，或后端托管 dist（见 backend main.py）。
 */
function normalizeBase(built: string): string {
  let b = built.replace(/\/$/, "").trim() || "";
  // 生产包若误把 VITE_API_URL 打成本机，浏览器里绝不能再用它，否则外网用户会打自己的 127.0.0.1
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
 * 页面是 https 而显式配置的 API 为 http 时，浏览器会拦截（混合内容），表现为 failed to fetch。
 */
export function apiBlockedByMixedContent(): boolean {
  if (typeof window === "undefined") return false;
  if (!API_BASE) return false;
  return (
    window.location.protocol === "https:" && API_BASE.startsWith("http://")
  );
}
