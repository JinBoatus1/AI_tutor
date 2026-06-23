/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Test config is kept separate from vite.config.ts so the dev server / API proxy
// setup stays untouched. Pure-logic specs run in node; component specs (jsdom)
// opt in via a // @vitest-environment jsdom file pragma where needed.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
