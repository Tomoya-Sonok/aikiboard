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
const PASSWORD = "Password1!";
// 000 seed で投入済みの道場マスタ(蕨合気道会)。
const DOJO_MASTER_ID = "00000000-0000-0000-0000-000000000001";
const BOARD_SLUG = "warabiaikidokai";

type DevUser = {
  email: string;
  username: string;
  role: "owner" | "member";
};

const USERS: DevUser[] = [
  { email: "dev-owner@aiki-board.com", username: "dev_owner", role: "owner" },
  {
    email: "dev-member@aiki-board.com",
    username: "dev_member",
    role: "member",
  },
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
// dojoStyleId を渡すと AikiNote 道場(DojoStyleMaster)に紐づける(参加申請の発見元)。
async function ensureUser(
  u: { email: string; username: string },
  dojoStyleId?: string,
): Promise<string> {
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

  const { error: profileError } = await admin.from("User").upsert(
    {
      id: userId,
      email: u.email,
      username: u.username,
      dojo_style_id: dojoStyleId ?? null,
    },
    { onConflict: "id" },
  );
  if (profileError) {
    throw profileError;
  }
  return userId;
}

async function seedBoard(
  ownerId: string,
  memberId: string,
  applicantId: string,
): Promise<void> {
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
      name: "蕨合気道会",
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

  // サンプル稽古(JST): 明日の単発 + 蕨合気道会の定期稽古(火金 + 日2枠)。
  // 定期は BYDAY が曜日を決め、start_at は時刻と長さ(end-start)のみを供給する。
  const now = new Date(Date.now() + JST_OFFSET_MS);
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const d = now.getUTCDate();
  const { error: eventsError } = await ab.from("events").insert([
    // 定期: 毎週 火・金 19:00–21:00(一般稽古)。
    {
      board_id: boardId,
      start_at: jstIso(y, m, d, 19, 0),
      end_at: jstIso(y, m, d, 21, 0),
      place: "蕨市民体育館",
      instructor_name: "岩片裕",
      recurrence_rule: "FREQ=WEEKLY;BYDAY=TU,FR",
      is_public: true,
      created_by_user_id: ownerId,
    },
    // 定期: 毎週 日 9:00–10:00(子どもの稽古)。
    {
      board_id: boardId,
      start_at: jstIso(y, m, d, 9, 0),
      end_at: jstIso(y, m, d, 10, 0),
      place: "蕨市民体育館",
      instructor_name: "岩片裕",
      note: "子どもの稽古",
      recurrence_rule: "FREQ=WEEKLY;BYDAY=SU",
      is_public: true,
      created_by_user_id: ownerId,
    },
    // 定期: 毎週 日 10:00–11:30(一般稽古)。
    {
      board_id: boardId,
      start_at: jstIso(y, m, d, 10, 0),
      end_at: jstIso(y, m, d, 11, 30),
      place: "蕨市民体育館",
      instructor_name: "岩片裕",
      recurrence_rule: "FREQ=WEEKLY;BYDAY=SU",
      is_public: true,
      created_by_user_id: ownerId,
    },
  ]);
  if (eventsError) {
    throw eventsError;
  }

  // サンプルお知らせ(本文は ProseMirror/Tiptap JSON。ホワイトリスト準拠)。
  //   1) 公開済み(member 既読)/ 2) 公開済み(未読)/ 3) 下書き(管理者のみ閲覧)。
  const dayMs = 24 * 60 * 60 * 1000;
  const doc = (title: string, body: string) => ({
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: title }],
      },
      { type: "paragraph", content: [{ type: "text", text: body }] },
    ],
  });
  const { data: anns, error: annError } = await ab
    .from("announcements")
    .insert([
      {
        board_id: boardId,
        title: "7月の審査について",
        body_rich: doc(
          "昇級・昇段審査のお知らせ",
          "7月14日(日)に審査を実施します。受験希望者は7月7日までにお知らせください。",
        ),
        notify_email: false,
        created_by_user_id: ownerId,
        published_at: new Date(Date.now() - 5 * dayMs).toISOString(),
      },
      {
        board_id: boardId,
        title: "夏季合宿のご案内",
        body_rich: doc(
          "夏季合宿",
          "8月10日〜12日、箱根にて夏季合宿を予定しています。詳細は追ってお知らせします。",
        ),
        notify_email: true,
        created_by_user_id: ownerId,
        published_at: new Date(Date.now() - 2 * dayMs).toISOString(),
      },
      {
        board_id: boardId,
        title: "道場清掃のお願い(下書き)",
        body_rich: doc(
          "大掃除",
          "6月28日の稽古後に大掃除を行います。雑巾等をご持参ください。",
        ),
        notify_email: false,
        created_by_user_id: ownerId,
        published_at: null,
      },
    ])
    .select("id, title");
  if (annError || !anns) {
    throw annError ?? new Error("お知らせ作成に失敗");
  }
  // 1件目(審査)を member が既読にした状態にする。
  const readTarget = anns.find((a) => a.title === "7月の審査について");
  if (readTarget) {
    const { error: readError } = await ab
      .from("announcement_reads")
      .insert({ announcement_id: readTarget.id, user_id: memberId });
    if (readError) {
      throw readError;
    }
  }

  // applicant(蕨合気道会の道場に紐づく非メンバー)からの参加申請を1件入れる。
  // 管理者でログインするとメンバー画面に「承認待ち」として表示される。
  const { error: requestError } = await ab.from("membership_requests").insert({
    board_id: boardId,
    user_id: applicantId,
    message: "一般稽古に参加しています。よろしくお願いします。",
    status: "pending",
  });
  if (requestError) {
    throw requestError;
  }

  console.log(
    `ボード(${BOARD_SLUG})とサンプル稽古・お知らせ・参加申請を作成しました。`,
  );
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

  // 参加申請の動作確認用: 蕨合気道会の道場に紐づくが、まだ非メンバーの申請者。
  const applicantId = await ensureUser(
    { email: "dev-applicant@aiki-board.com", username: "dev_applicant" },
    DOJO_MASTER_ID,
  );
  console.log("auth ユーザーを用意: dev-applicant@aiki-board.com(applicant)");

  await seedBoard(ids.owner, ids.member, applicantId);

  console.log("\n✅ seed 完了。ローカルログイン情報:");
  for (const u of USERS) {
    console.log(`  - ${u.role}: ${u.email} / ${PASSWORD}`);
  }
  console.log(`  - applicant: dev-applicant@aiki-board.com / ${PASSWORD}`);
  console.log(
    `  ログイン後、ボード「蕨合気道会」(/d/${BOARD_SLUG})で各機能を確認できます。`,
  );
  console.log(
    "  applicant でログインすると「道場ボードを探す」から参加申請でき、owner/admin のメンバー画面に承認待ちが表示されます。",
  );
}

main().catch((err) => {
  console.error("seed:dev に失敗しました:", err);
  process.exitCode = 1;
});
