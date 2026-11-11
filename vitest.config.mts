import path from "node:path";
import { defineConfig } from "vitest/config";

// The pipeline is plain TypeScript with no DOM, so tests run in Node.
export default defineConfig({
  resolve: {
    // Same "@/..." alias as tsconfig.json.
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
