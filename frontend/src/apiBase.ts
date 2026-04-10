/** 生产环境在 Vercel（或构建时）设置 VITE_API_URL 为公网后端地址，勿写死 localhost。 */
const raw = import.meta.env.VITE_API_URL?.trim() ?? "";
export const API_BASE = raw.replace(/\/$/, "") || "http://127.0.0.1:8000";
