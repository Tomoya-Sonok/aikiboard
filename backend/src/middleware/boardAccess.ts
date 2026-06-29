// ボードのメンバーシップ / ロールを確認するミドルウェア(ADR 0002 の 3 層構想の実体化)。
//
// authMiddleware の後段で使う。対象ボードを解決し、board_members を service_role で引いて
// 閲覧者のロールを確認する。以降の機能(お知らせ・フィード等)でも再利用する。
//
// ボード ID の解決順序(重要 = 権限詐称の防止):
//   1. ルートパラメータ `:id`(= 対象リソースの id)があれば、必ずそのリソースの board_id を使う。
//      → `?boardId=` や body で別ボードを指定して権限を偽装する攻撃を防ぐ。
//      どのテーブルから board_id を引くかは createBoardGuard の idTable で指定する
//      (events 既定。お知らせは "announcements" を渡す)。
//   2. それが無ければ query `boardId`(一覧取得)。
//   3. それも無ければ JSON body の `boardId`(作成 POST)。
//
// 解決したボード ID とロールは c.set("boardId" / "boardRole") に載せ、ハンドラから使う。

import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import type { AppBindings, AppVariables, BoardRole } from "../app.js";
import { logger } from "../lib/logger.js";

type AccessLevel = "member" | "admin"; // admin = owner または admin

type GuardEnv = { Bindings: AppBindings; Variables: AppVariables };

const ADMIN_ROLES: BoardRole[] = ["owner", "admin"];

type ResolveResult = { boardId: string | null; dbError: boolean };

// :id ルートで board_id を引くテーブル。リソースごとに切り替える。
type IdTable =
  | "events"
  | "announcements"
  | "invitations"
  | "membership_requests"
  | "board_posts"
  | "archives";

async function resolveBoardId(
  c: Context<GuardEnv>,
  idTable: IdTable,
): Promise<ResolveResult> {
  const supabase = c.get("supabase");

  // 1. :id(対象リソースの id)があれば、そのリソースの board_id を正とする。
  const resourceId = c.req.param("id");
  if (resourceId) {
    if (!supabase) {
      return { boardId: null, dbError: false };
    }
    const { data, error } = await supabase
      .schema("aikiboard")
      .from(idTable)
      .select("board_id")
      .eq("id", resourceId)
      .maybeSingle();
    // 一時的な DB エラーを「存在しない(404)」に倒さず、呼び出し側で 500 にする。
    if (error) {
      return { boardId: null, dbError: true };
    }
    return {
      boardId: (data?.board_id as string | undefined) ?? null,
      dbError: false,
    };
  }

  // 2. query ?boardId=
  const queryBoardId = c.req.query("boardId");
  if (queryBoardId) {
    return { boardId: queryBoardId, dbError: false };
  }

  // 3. JSON body の boardId(POST 作成)。body は Hono がキャッシュするのでハンドラで再読しても良い。
  try {
    const body = await c.req.json();
    if (
      body &&
      typeof body === "object" &&
      typeof (body as { boardId?: unknown }).boardId === "string"
    ) {
      return { boardId: (body as { boardId: string }).boardId, dbError: false };
    }
  } catch {
    // body 無し / 不正 JSON は無視
  }

  return { boardId: null, dbError: false };
}

const createBoardGuard = (level: AccessLevel, idTable: IdTable = "events") =>
  createMiddleware<GuardEnv>(async (c, next) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ success: false, error: "認証エラー" }, 401);
    }

    const { boardId, dbError } = await resolveBoardId(c, idTable);
    if (dbError) {
      logger.error("ボード解決時の DB エラー", {
        feature: "boardAccess",
        userId,
      });
      return c.json({ success: false, error: "権限の確認に失敗しました" }, 500);
    }
    if (!boardId) {
      return c.json({ success: false, error: "対象が見つかりません" }, 404);
    }

    const { data: membership, error } = await supabase
      .schema("aikiboard")
      .from("board_members")
      .select("role")
      .eq("board_id", boardId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      logger.error("ボードロールの確認に失敗", {
        feature: "boardAccess",
        boardId,
        userId,
      });
      return c.json({ success: false, error: "権限の確認に失敗しました" }, 500);
    }

    const role = (membership?.role as BoardRole | undefined) ?? null;
    if (!role) {
      // 非メンバーには存在を伏せる(404)。
      return c.json({ success: false, error: "対象が見つかりません" }, 404);
    }
    if (level === "admin" && !ADMIN_ROLES.includes(role)) {
      return c.json({ success: false, error: "権限がありません" }, 403);
    }

    c.set("boardId", boardId);
    c.set("boardRole", role);
    return next();
  });

// メンバー(owner/admin/member いずれか)であることを要求する。
export const boardMemberMiddleware = createBoardGuard("member");

// owner または admin であることを要求する(稽古の作成・編集・削除・出欠集計など)。
export const boardAdminMiddleware = createBoardGuard("admin");

// お知らせ用(:id はお知らせの id → announcements から board_id を引く)。
export const announcementMemberMiddleware = createBoardGuard(
  "member",
  "announcements",
);
export const announcementAdminMiddleware = createBoardGuard(
  "admin",
  "announcements",
);

// 招待リンク用(:id は invitation の id → invitations から board_id を引く)。
export const invitationAdminMiddleware = createBoardGuard(
  "admin",
  "invitations",
);

// 参加申請の承認/却下用(:id は申請の id → membership_requests から board_id を引く)。
export const membershipRequestAdminMiddleware = createBoardGuard(
  "admin",
  "membership_requests",
);

// 道場内フィード用(:id は投稿の id → board_posts から board_id を引く)。
// 投稿の閲覧・作成はメンバー、削除可否(投稿者本人 or 管理者)はハンドラ側で判定する。
export const boardPostMemberMiddleware = createBoardGuard(
  "member",
  "board_posts",
);

// アーカイブ用(:id はアーカイブの id → archives から board_id を引く)。
// 閲覧=メンバー、作成/編集/削除=admin。さらに requireFeature("archive") でプラン判定する。
export const archiveMemberMiddleware = createBoardGuard("member", "archives");
export const archiveAdminMiddleware = createBoardGuard("admin", "archives");
