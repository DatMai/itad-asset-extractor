import { defineConfig } from "@playwright/test";

/**
 * Browser tests for the one page of the app: upload, mapping, review, export, failure messages.
 * They run against a production build (no dev overlay, the same code a deployment serves) in
 * the Chrome already installed on the machine, so no browser download is needed.
 */
const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: true,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: `pnpm build && pnpm exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
