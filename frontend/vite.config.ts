import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const envAll = loadEnv(mode, process.cwd(), "");
  if (mode === "production") {
    const apiUrl = (envAll.VITE_API_URL ?? "").trim();
    if (
      apiUrl &&
      /127\.0\.0\.1|localhost/i.test(apiUrl)
    ) {
      throw new Error(
        "生产构建的 VITE_API_URL 指向了本机（127.0.0.1 / localhost），打进 JS 后外网用户会请求自己的电脑。请检查：① frontend/.env.production 是否已提交；② Vercel/Netlify 等项目环境变量里是否误设了 VITE_API_URL=http://127.0.0.1:8000（平台变量会覆盖文件）。应改为公网 HTTPS 后端根地址，或留空走同域 /api。",
      );
    }
  }

  // 仅给 Vite 用，不打进浏览器；用 DEV_API_ 前缀避免 loadEnv 混入整份系统环境变量
  const env = loadEnv(mode, process.cwd(), "DEV_API_");
  const proxyTarget = (
    env.DEV_API_PROXY_TARGET || "http://127.0.0.1:8000"
  ).replace(/\/$/, "");

  const proxy = {
    "/api": {
      target: proxyTarget,
      changeOrigin: true,
    },
  };

  return {
    plugins: [react()],
    server: {
      host: true,
      proxy,
    },
    preview: {
      host: true,
      proxy,
    },
  };
});
