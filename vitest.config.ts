import { defineConfig } from "vitest/config";

// vite.config.ts is the MCP Apps card bundle config (root: "ui"), so vitest
// must not inherit it — tests get their own config here.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
