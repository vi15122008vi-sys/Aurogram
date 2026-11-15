import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    target: "esnext",
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          motion: ["framer-motion"],
          icons: ["lucide-react"],
          markdown: ["react-markdown"],
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
