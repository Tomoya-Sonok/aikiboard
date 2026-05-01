// 本番ビルド前に必要な環境変数が揃っているか確認するスクリプト。
// Vercel CI で実行され、未定義の変数があると非ゼロ終了で build を停止させる。

const requiredVariables = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_APP_URL",
];

const missingVariables = requiredVariables.filter(
  (key) => !process.env[key]?.trim(),
);

if (missingVariables.length > 0) {
  console.error(
    [
      "Frontend production environment check failed.",
      "Missing required variables:",
      ...missingVariables.map((key) => `- ${key}`),
      "",
      "For Vercel, set these in Project Settings > Environment Variables for the Production environment and redeploy.",
    ].join("\n"),
  );
  process.exit(1);
}

console.log("Frontend production environment check passed.");
