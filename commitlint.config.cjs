// Conventional Commits。type 以外は日本語を許容するため subject-case を無効化する。
// (docs/conventions.md「コミットメッセージ・PR」節を参照。ルールの本文はそちらが正)
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "chore",
        "revert",
      ],
    ],
    "subject-case": [0],
  },
};
