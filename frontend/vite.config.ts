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
        "Production VITE_API_URL points to localhost/loopback; bundled clients cannot reach your machine. Use a public HTTPS API origin, or leave it empty for same-origin /api. Check deploy env vars and frontend/.env.production.",
      );
    }
  }

  // Node-only; not shipped to the browser. DEV_API_ limits what loadEnv pulls in.
  const env = loadEnv(mode, process.cwd(), "DEV_API_");
  /** Same public API as frontend/.env.production; set DEV_API_PROXY_TARGET for local uvicorn only */
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
