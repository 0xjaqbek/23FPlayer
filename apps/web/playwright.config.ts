import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const shouldStartWebServer = !process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: shouldStartWebServer
    ? {
        command: "corepack pnpm --filter web dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        env: {
          AUTH_SECRET: "playwright-auth-secret",
          DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/23fplayer_test",
          REGISTRATION_ACCESS_PASSWORD: "access-test",
          REGISTRATION_GATE_SECRET: "playwright-registration-gate-secret",
          RELAY_SHARED_SECRET: "playwright-relay-secret",
          RELAY_LISTENER_SECRET: "playwright-listener-secret",
        },
        timeout: 120_000,
      }
    : undefined,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
