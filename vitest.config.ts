import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    // Most suites exercise pure business logic or route handlers and do not
    // need a browser. Keeping those in Node avoids paying the jsdom startup
    // cost for every file on Windows; UI-facing suites opt into jsdom below.
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e"],
    css: true,
    // Preserve module isolation between route and UI suites. This avoids mock
    // state leaking between authorization tests on Windows.
    pool: "forks",
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
