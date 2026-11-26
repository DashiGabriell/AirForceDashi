import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@afd/shared-types": path.resolve(__dirname, "../../packages/shared-types/src"),
      "@afd/game-core": path.resolve(__dirname, "../../packages/game-core/src"),
      "@afd/game-render": path.resolve(__dirname, "../../packages/game-render/src"),
      "@afd/economy": path.resolve(__dirname, "../../packages/economy/src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      // Windows locks big binaries while they are copied or played.
      ignored: ["**/public/audio/**", "**/public/**/*.glb"],
    },
    proxy: {
      "/auth": "http://localhost:8787",
      "/me": "http://localhost:8787",
      "/wallet": "http://localhost:8787",
      "/rewards": "http://localhost:8787",
      "/hangar": "http://localhost:8787",
      "/shop": "http://localhost:8787",
      "/inventory": "http://localhost:8787",
      "/flags": "http://localhost:8787",
      "/telemetry": "http://localhost:8787",
      "/health": "http://localhost:8787",
      "/operations": "http://localhost:8787",
      "/mastery": "http://localhost:8787",
      "/medals": "http://localhost:8787",
      "/leaderboard": "http://localhost:8787",
      "/payments": "http://localhost:8787",
      "/season": "http://localhost:8787",
      "/lobby": "http://localhost:8787",
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
    chunkSizeWarningLimit: 900,
    worker: {
      format: "es",
    },
  },
});
