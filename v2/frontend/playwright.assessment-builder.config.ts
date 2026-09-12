import { defineConfig, devices } from "@playwright/test";
import { execFileSync } from "node:child_process";

const expectedSha =
  process.env.CAREERMATE_EXPECTED_SHA ??
  execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

if (!/^[0-9a-f]{40}$/.test(expectedSha)) {
  throw new Error("CAREERMATE_EXPECTED_SHA must be a full lowercase git SHA");
}

const port = 3130;
const useProductionBuild = process.env.CAREERMATE_E2E_USE_BUILD === "true";
const webServerCommand = useProductionBuild
  ? `NEXT_PUBLIC_DEMO_MODE=true NEXT_PUBLIC_BUILD_SHA=${expectedSha} npm run start -- --hostname 127.0.0.1 --port ${port}`
  : `NEXT_PUBLIC_DEMO_MODE=true NEXT_PUBLIC_BUILD_SHA=${expectedSha} npm run dev -- --hostname 127.0.0.1 --port ${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "assessment-builder.spec.ts",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    screenshot: "off",
  },
  webServer: {
    command: webServerCommand,
    url: `http://127.0.0.1:${port}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "desktop-1440",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "tablet-768",
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } },
    },
    {
      name: "mobile-390",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
  ],
});
