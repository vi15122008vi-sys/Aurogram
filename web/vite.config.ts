import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2020",
    rollupOptions: {
      output: {
        // Функциональная стратегия: каждый пакет из node_modules → свой чанк.
        // Так Rollup не создаёт circular chunks и кэш не инвалидируется целиком.
        manualChunks(id: string) {
          if (id.includes("node_modules")) {
            return id.toString().split("node_modules/")[1].split("/")[0].toString();
          }
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://31.77.67.106:8000",
        changeOrigin: true,
      },
    },
  },
});
