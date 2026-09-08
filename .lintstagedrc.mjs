import path from "node:path";

// lint-staged はステージ済みファイルの絶対パスを渡してくる。
// frontend/backend はそれぞれ個別の biome.json を持つため、
// パッケージごとに `pnpm --dir <pkg> exec biome check` へ相対パスで渡す。
const toPackageRelativeArgs = (base) => (files) =>
  files.map((f) => `"${path.relative(base, f)}"`).join(" ");

export default {
  "frontend/**/*.{ts,tsx,js,jsx,mjs,cjs,json}": (files) =>
    `pnpm --dir frontend exec biome check --write ${toPackageRelativeArgs("frontend")(files)}`,
  "backend/**/*.{ts,js,mjs,cjs,json}": (files) =>
    `pnpm --dir backend exec biome check --write ${toPackageRelativeArgs("backend")(files)}`,
};
