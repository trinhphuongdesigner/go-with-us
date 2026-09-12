import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    "process.env.NEXT_PUBLIC_DEMO_MODE": JSON.stringify("true"),
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    css: true,
  },
});
