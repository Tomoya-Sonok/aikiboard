import { defineConfig } from "vitest/config";

// RLS integration テスト専用設定。ローカル Supabase に対して実行する。
// 実行: `pnpm test:integration`(ルート .env.local の実値を dotenv で注入)。
// CI(test:ci)からは default config の exclude で除外している。
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    exclude: ["node_modules", "dist"],
    testTimeout: 30000,
    hookTimeout: 30000,
    // env override はしない(dotenv が注入する実値を使う)。
  },
});
