import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  cacheDir: "./.vite-cache",
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "dist"],
    cache: {
      dir: "./.vitest-cache",
    },
  },
  resolve: {
    alias: {
      "@": resolve(process.cwd(), "./src"),
    },
  },
  server: {
    deps: {
      inline: ["@testing-library/react"],
    },
  },
});
