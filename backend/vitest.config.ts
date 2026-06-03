import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["src/**/*.test.ts"],
    // *.integration.test.ts はローカル Supabase 必須のため default(CI)からは除外。
    // 実行は `pnpm test:integration`(vitest.integration.config.ts)で行う。
    exclude: ["node_modules", "dist", "**/*.integration.test.ts"],
    env: {
      SUPABASE_URL: "https://localhost:3000",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    },
  },
});
