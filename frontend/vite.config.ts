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
        "生产构建的 VITE_API_URL 指向了回环地址（本机），打进 JS 后外网用户无法访问。请改为公网 HTTPS 后端根地址，或留空走同域 /api，并检查部署平台环境变量与 frontend/.env.production。",
      );
    }
  }

  // 仅给 Vite 用，不打进浏览器；用 DEV_API_ 前缀避免 loadEnv 混入整份系统环境变量
  const env = loadEnv(mode, process.cwd(), "DEV_API_");
  /** 与 frontend/.env.production 中公网后端一致；本机只跑 uvicorn 时请设 DEV_API_PROXY_TARGET */
  const defaultDevProxy = "https://ai-tutor-3roc.onrender.com";
  const proxyTarget = (env.DEV_API_PROXY_TARGET || defaultDevProxy).replace(
    /\/$/,
    "",
  );

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
