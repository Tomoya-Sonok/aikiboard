import { execSync } from "node:child_process";

const patterns = [
  "pnpm --filter aikiboard-frontend dev",
  "pnpm --filter aikiboard-backend dev",
];

const stopByPattern = (pattern) => {
  try {
    execSync(`pkill -f "${pattern}"`, { stdio: "ignore" });
    console.log(`[stop] ${pattern}`);
  } catch {
    console.log(`[skip] not running: ${pattern}`);
  }
};

patterns.forEach(stopByPattern);
