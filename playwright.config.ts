import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const configuredBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = configuredBaseUrl ?? `http://127.0.0.1:${port}`;
const shouldUseLocalWebServer = !configuredBaseUrl;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: process.env.CI ? 120000 : 90000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL,
    navigationTimeout: process.env.CI ? 60000 : 45000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  ...(shouldUseLocalWebServer
    ? {
        webServer: {
          command: `pnpm exec next dev -H 127.0.0.1 -p ${port}`,
          url: `http://127.0.0.1:${port}`,
          reuseExistingServer: false,
          timeout: 120000,
        },
      }
    : {}),
});
