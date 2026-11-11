import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The pipeline is plain TypeScript with no DOM, so tests run in Node.
export default defineConfig({
  resolve: {
    // Same "@/..." alias as tsconfig.json.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
