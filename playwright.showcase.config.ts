import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3102",
    colorScheme: "dark",
    trace: "on",
    video: { mode: "on", size: { width: 1440, height: 960 } },
    viewport: { width: 1440, height: 960 },
    launchOptions: { slowMo: 120 },
  },
  projects: [{ name: "showcase-video", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm exec next dev -p 3102",
    url: "http://127.0.0.1:3102",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
