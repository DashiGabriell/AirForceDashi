import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@afd/shared-types": path.resolve(__dirname, "../../packages/shared-types/src"),
      "@afd/economy": path.resolve(__dirname, "../../packages/economy/src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
