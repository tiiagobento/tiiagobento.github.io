import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "src/test/server-only.ts"),
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
    // Keep one reusable worker on Windows. The forks pool intermittently timed
    // out while starting the jsdom worker after the suites had already passed.
    // Threads keep the same serial execution without leaving child processes
    // behind at shutdown.
    pool: "threads",
    fileParallelism: false,
    maxWorkers: 1,
    isolate: false,
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
