import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react",
              test: /node_modules\/(react|react-dom|scheduler)\//,
            },
            {
              name: "animation",
              test: /node_modules\/(motion|framer-motion|motion-dom|motion-utils|gsap)\//,
            },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      ["/api", "/media", "/auth", "/brand", "/app"].map((path) => [
        path,
        { target: "http://127.0.0.1:8765", changeOrigin: true },
      ]),
    ),
  },
});
