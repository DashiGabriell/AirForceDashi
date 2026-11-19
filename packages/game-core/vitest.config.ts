import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@afd/shared-types": path.resolve(__dirname, "../shared-types/src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
