import { defineConfig } from "@playwright/test";
import { execFileSync } from "node:child_process";
import baseConfig from "./playwright.config";

const port = 3122;
const expectedSha = process.env.CAREERMATE_EXPECTED_SHA ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (!/^[0-9a-f]{40}$/.test(expectedSha)) throw new Error("CAREERMATE_EXPECTED_SHA must be a full lowercase git SHA");
const useProductionBuild = process.env.CAREERMATE_E2E_USE_BUILD === "true";
const webServerCommand = useProductionBuild
  ? `npm run start -- --hostname 127.0.0.1 --port ${port}`
  : `NEXT_PUBLIC_DEMO_MODE=true NEXT_PUBLIC_BUILD_SHA=${expectedSha} npm run dev -- --hostname 127.0.0.1 --port ${port}`;

export default defineConfig({
  ...baseConfig,
  testMatch: /appearance\.spec\.ts$/,
  use: {
    ...baseConfig.use,
    baseURL: `http://127.0.0.1:${port}`,
  },
  webServer: {
    ...baseConfig.webServer,
    command: webServerCommand,
    url: `http://127.0.0.1:${port}/login`,
    reuseExistingServer: false,
  },
});
