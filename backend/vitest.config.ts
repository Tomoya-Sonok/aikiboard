import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    env: {
      SUPABASE_URL: "https://localhost:3000",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    },
  },
});
