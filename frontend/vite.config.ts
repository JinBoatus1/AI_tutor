import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
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
