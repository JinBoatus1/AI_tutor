import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default {
  server: {
    host: "127.0.0.1",
    port: 3000,
    strictPort: true,
    https: false,
    watch: { usePolling: true },
  },
}
