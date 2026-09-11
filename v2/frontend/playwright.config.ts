import { defineConfig, devices } from "@playwright/test";
import { execFileSync } from "node:child_process";

const expectedSha = process.env.CAREERMATE_EXPECTED_SHA ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (!/^[0-9a-f]{40}$/.test(expectedSha)) throw new Error("CAREERMATE_EXPECTED_SHA must be a full lowercase git SHA");
const port = 3117;
const useProductionBuild = process.env.CAREERMATE_E2E_USE_BUILD === "true";
const webServerCommand = useProductionBuild
  ? `npm run start -- --hostname 127.0.0.1 --port ${port}`
  : `NEXT_PUBLIC_DEMO_MODE=true NEXT_PUBLIC_BUILD_SHA=${expectedSha} npm run dev -- --hostname 127.0.0.1 --port ${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: webServerCommand,
    url: `http://127.0.0.1:${port}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: "mobile-390", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
    { name: "tablet-768", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
});
