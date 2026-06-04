// ローカル開発用 seed スクリプト(本番では絶対に実行しない)。
//
// `supabase db reset`(migrations 000〜010 を適用)では auth ユーザーや aikiboard の
// ボード/稽古データは作られない(000 は public スキーマのダミーのみ、auth.users は GoTrue 管理)。
// このスクリプトは Supabase の **Admin API**(service_role)を使って、ローカルで `/login`
// できる dev ユーザーと、動作確認用のボード・稽古(単発/定期)を冪等に投入する。
//
// 実行: `cd backend && pnpm exec supabase start` → `pnpm exec supabase db reset` →
//       `pnpm seed:dev`(ルート .env.local の値を dotenv で注入)。
//
// ログイン情報は docs/development-guide.md に明記。

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// ローカル開発用の固定パスワード(本番とは無関係)。docs にも明記。
const PASSWORD = "Passw0rd!";
// 000 seed で投入済みの道場マスタ(合気会本部道場)。
const DOJO_MASTER_ID = "00000000-0000-0000-0000-000000000001";
const BOARD_SLUG = "dev-dojo";

type DevUser = {
  email: string;
  username: string;
  role: "owner" | "member";
};

const USERS: DevUser[] = [
  { email: "dev-owner@example.com", username: "dev_owner", role: "owner" },
  { email: "dev-member@example.com", username: "dev_member", role: "member" },
];

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// JST 壁時計(Asia/Tokyo, 固定 +9h)の instant ISO を作る。
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const jstIso = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): string =>
  new Date(
    Date.UTC(year, month - 1, day, hour, minute, 0) - JST_OFFSET_MS,
  ).toISOString();

async function findUserIdByEmail(email: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error) {
    throw error;
  }
  return data.users.find((u) => u.email === email)?.id ?? null;
}

// auth ユーザーを作成(既に居れば取得)し、public."User" プロフィールを upsert する。
async function ensureUser(u: DevUser): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email: u.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { username: u.username },
  });
  let userId = created.data.user?.id ?? null;
  if (!userId) {
    userId = await findUserIdByEmail(u.email);
  }
  if (!userId) {
    throw created.error ?? new Error(`auth ユーザー作成に失敗: ${u.email}`);
  }

  const { error: profileError } = await admin
    .from("User")
    .upsert(
      { id: userId, email: u.email, username: u.username },
      { onConflict: "id" },
    );
  if (profileError) {
    throw profileError;
  }
  return userId;
}

async function seedBoard(ownerId: string, memberId: string): Promise<void> {
  const ab = admin.schema("aikiboard");

  const { data: existing, error: existingError } = await ab
    .from("boards")
    .select("id")
    .eq("slug", BOARD_SLUG)
    .maybeSingle();
  if (existingError) {
    throw existingError;
  }
  if (existing) {
    console.log(`ボード(${BOARD_SLUG})は既に存在するためスキップしました。`);
    return;
  }

  const { data: board, error: boardError } = await ab
    .from("boards")
    .insert({
      name: "開発道場",
      slug: BOARD_SLUG,
      created_by_user_id: ownerId,
      is_public: true,
    })
    .select("id")
    .single();
  if (boardError || !board) {
    throw boardError ?? new Error("ボード作成に失敗");
  }
  const boardId = board.id as string;

  const { error: membersError } = await ab.from("board_members").insert([
    { board_id: boardId, user_id: ownerId, role: "owner" },
    { board_id: boardId, user_id: memberId, role: "member" },
  ]);
  if (membersError) {
    throw membersError;
  }

  await ab.from("board_settings").insert({
    board_id: boardId,
    description: "ローカル開発用のサンプル道場",
    theme_color_code: "dou",
  });
  await ab.from("board_dojo_masters").insert({
    board_id: boardId,
    dojo_master_id: DOJO_MASTER_ID,
    is_primary: true,
  });

  const { data: freePlan } = await ab
    .from("plans")
    .select("id")
    .eq("code", "free")
    .maybeSingle();
  if (freePlan) {
    await ab.from("board_subscriptions").insert({
      board_id: boardId,
      plan_id: freePlan.id,
      status: "active",
    });
  }

  // サンプル稽古(JST): 明日の単発 + 毎週月・水の定期。
  const now = new Date(Date.now() + JST_OFFSET_MS);
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const d = now.getUTCDate();
  const { error: eventsError } = await ab.from("events").insert([
    {
      board_id: boardId,
      start_at: jstIso(y, m, d + 1, 19, 0),
      end_at: jstIso(y, m, d + 1, 21, 0),
      place: "第一道場",
      instructor_name: "田中 一郎",
      is_public: true,
      created_by_user_id: ownerId,
    },
    {
      board_id: boardId,
      start_at: jstIso(y, m, d, 19, 0),
      end_at: jstIso(y, m, d, 21, 0),
      place: "本部道場",
      instructor_name: "山田 花子",
      recurrence_rule: "FREQ=WEEKLY;BYDAY=MO,WE",
      is_public: true,
      created_by_user_id: ownerId,
    },
  ]);
  if (eventsError) {
    throw eventsError;
  }
  console.log(`ボード(${BOARD_SLUG})とサンプル稽古を作成しました。`);
}

async function main(): Promise<void> {
  if (!SERVICE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY が未設定です。ルートの .env.local を確認してください。",
    );
  }

  const ids: Record<string, string> = {};
  for (const u of USERS) {
    ids[u.role] = await ensureUser(u);
    console.log(`auth ユーザーを用意: ${u.email}(${u.role})`);
  }

  await seedBoard(ids.owner, ids.member);

  console.log("\n✅ seed 完了。ローカルログイン情報:");
  for (const u of USERS) {
    console.log(`  - ${u.role}: ${u.email} / ${PASSWORD}`);
  }
  console.log(
    `  ログイン後、ボード「開発道場」(/d/${BOARD_SLUG})で稽古カレンダーを確認できます。`,
  );
}

main().catch((err) => {
  console.error("seed:dev に失敗しました:", err);
  process.exitCode = 1;
});
