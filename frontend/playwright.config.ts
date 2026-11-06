import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  use: {
    baseURL: baseURL || undefined,
  },
  webServer:
    baseURL && /localhost|127\.0\.0\.1/.test(baseURL)
      ? {
          command: "npm run dev",
          url: baseURL,
          reuseExistingServer: true,
        }
      : undefined,
});
