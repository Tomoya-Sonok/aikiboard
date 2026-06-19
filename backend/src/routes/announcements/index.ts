// お知らせ配信 API(要件 4.2)。管理者(owner/admin)→ メンバーへの一方向配信。
//
// 認証は authMiddleware、ボード権限は boardAccess(announcements 版)で確認する。
//   - 一覧 / 詳細 / 未読数 / 既読: announcementMemberMiddleware(メンバー以上)
//   - 作成 / 編集 / 削除 / 公開    : announcementAdminMiddleware(owner/admin)
//
// 下書き(published_at IS NULL)は管理者のみ閲覧でき、メンバーには存在を伏せる(404)。
// 公開は published_at をセットする一方向操作。notify_email が ON のときは公開時に
// メンバー全員へ Resend でメール送信する(fire-and-forget、lib/announcement-email.ts)。
//
// 認可について(events と同じ前提): backend は service_role で RLS をバイパスするため、
// この経路の認可は boardAccess ミドルウェアが唯一の砦。RLS は frontend が anon キーで
// 直接読む経路の二重防御(migration 011 で下書きの可視性も絞っている)。

import type { SupabaseClient } from "@supabase/supabase-js";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { AppBindings, AppVariables } from "../../app.js";
import { logActivity } from "../../lib/activity.js";
import { sendAnnouncementEmails } from "../../lib/announcement-email.js";
import { logger } from "../../lib/logger.js";
import { notifyBoardMembers } from "../../lib/notifications.js";
import {
  bodyRichSchema,
  extractPlainText,
  parseBodyRich,
} from "../../lib/richtext.js";
import { authMiddleware } from "../../middleware/auth.js";
import {
  announcementAdminMiddleware,
  announcementMemberMiddleware,
} from "../../middleware/boardAccess.js";

type AnnouncementsEnv = { Bindings: AppBindings; Variables: AppVariables };

const announcementsRoute = new Hono<AnnouncementsEnv>();

const getEnv = (
  c: Context<AnnouncementsEnv>,
  key: keyof AppBindings,
): string | undefined =>
  c.env?.[key] ??
  (typeof process !== "undefined" ? process.env?.[key] : undefined);

// 公開時のメール通知(fire-and-forget)。宛先解決から送信まで一括で行い、呼び出し側は
// waitUntil に渡すだけ。失敗は各所でログ化し、公開処理自体は止めない。
const notifyOnPublish = async (
  supabase: SupabaseClient,
  boardId: string,
  announcementId: string,
  env: {
    resendApiKey: string | undefined;
    resendFromEmail: string | undefined;
  },
  appUrl: string,
): Promise<void> => {
  try {
    await notifyOnPublishInner(supabase, boardId, announcementId, env, appUrl);
  } catch (error) {
    // fire-and-forget: 通知の失敗は公開に影響させない。
    logger.error("お知らせメール通知で予期しない例外", {
      feature: "announcements",
      announcementId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const notifyOnPublishInner = async (
  supabase: SupabaseClient,
  boardId: string,
  announcementId: string,
  env: {
    resendApiKey: string | undefined;
    resendFromEmail: string | undefined;
  },
  appUrl: string,
): Promise<void> => {
  const aikiboard = supabase.schema("aikiboard");

  const [annRes, boardRes, membersRes] = await Promise.all([
    aikiboard
      .from("announcements")
      .select("title, body_rich")
      .eq("id", announcementId)
      .maybeSingle(),
    aikiboard
      .from("boards")
      .select("name, slug")
      .eq("id", boardId)
      .maybeSingle(),
    aikiboard.from("board_members").select("user_id").eq("board_id", boardId),
  ]);

  if (annRes.error || !annRes.data || boardRes.error || !boardRes.data) {
    logger.error("お知らせメールの下準備に失敗", {
      feature: "announcements",
      announcementId,
      boardId,
    });
    return;
  }
  if (membersRes.error) {
    logger.error("お知らせメールの宛先取得に失敗", {
      feature: "announcements",
      announcementId,
      boardId,
    });
    return;
  }

  const userIds = (membersRes.data ?? []).map((m) => m.user_id as string);
  if (userIds.length === 0) {
    return;
  }
  const { data: users, error: usersError } = await supabase
    .from("User")
    .select("email")
    .in("id", userIds);
  if (usersError) {
    logger.error("お知らせメールのアドレス解決に失敗", {
      feature: "announcements",
      announcementId,
    });
    return;
  }
  const recipients = [
    ...new Set(
      (users ?? [])
        .map((u) => (u.email as string | null) ?? "")
        .filter((e) => e.length > 0),
    ),
  ];

  await sendAnnouncementEmails(
    {
      boardName: boardRes.data.name as string,
      slug: boardRes.data.slug as string,
      title: annRes.data.title as string,
      bodyRich: annRes.data.body_rich,
      appUrl,
      recipients,
    },
    env,
  );
};

// 一覧の抜粋の最大文字数。
const EXCERPT_MAX = 120;
// 一覧ページサイズ。
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const createSchema = z.object({
  boardId: z
    .string()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  title: z.string().min(1).max(200),
  bodyRich: bodyRichSchema,
  notifyEmail: z.boolean().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  bodyRich: bodyRichSchema.optional(),
  notifyEmail: z.boolean().optional(),
});

const parseJson = async (
  c: Context<AnnouncementsEnv>,
): Promise<unknown | undefined> => {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
};

const excerptOf = (bodyRich: unknown): string => {
  const text = extractPlainText(bodyRich).replace(/\n+/g, " ");
  return text.length > EXCERPT_MAX ? `${text.slice(0, EXCERPT_MAX)}…` : text;
};

// created_by_user_id 群 → public."User" の表示名を解決する。
const resolveAuthorNames = async (
  supabase: NonNullable<AppVariables["supabase"]>,
  userIds: string[],
): Promise<Map<string, string>> => {
  const byId = new Map<string, string>();
  const ids = [...new Set(userIds)];
  if (ids.length === 0) {
    return byId;
  }
  const { data, error } = await supabase
    .from("User")
    .select("id, username")
    .in("id", ids);
  if (error) {
    return byId;
  }
  for (const u of data ?? []) {
    byId.set(u.id, u.username ?? "");
  }
  return byId;
};

// ────────────────────────────────────────────────────────────────
// GET /api/announcements?boardId=&limit=&offset= — 一覧(メンバー)
//   member: 公開済みのみ。owner/admin: 下書きも含め、下書きを先頭に。
// ────────────────────────────────────────────────────────────────
announcementsRoute.get(
  "/",
  authMiddleware,
  announcementMemberMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const userId = c.get("userId");
    const boardId = c.get("boardId");
    const boardRole = c.get("boardRole");
    const isAdmin = boardRole === "owner" || boardRole === "admin";
    const aikiboard = supabase.schema("aikiboard");

    const limit = Math.min(
      Math.max(Number(c.req.query("limit")) || DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const offset = Math.max(Number(c.req.query("offset")) || 0, 0);

    const failWith = (logMessage: string) => {
      logger.error(logMessage, { feature: "announcements", boardId, userId });
      return c.json(
        { success: false, error: "お知らせの取得に失敗しました" },
        500,
      );
    };

    let query = aikiboard
      .from("announcements")
      .select(
        "id, title, body_rich, notify_email, created_by_user_id, published_at, created_at",
        { count: "exact" },
      )
      .eq("board_id", boardId);
    // member は公開済みのみ。admin は下書き(published_at NULL)を先頭に出す。
    if (!isAdmin) {
      query = query.not("published_at", "is", null);
    }
    query = query
      .order("published_at", { ascending: false, nullsFirst: true })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) {
      return failWith("announcements の取得に失敗");
    }
    const rows = data ?? [];

    // 既読状態をまとめて引く(返却対象の id 群のみ)。
    const ids = rows.map((r) => r.id as string);
    const readSet = new Set<string>();
    if (ids.length > 0) {
      const { data: reads, error: readError } = await aikiboard
        .from("announcement_reads")
        .select("announcement_id")
        .eq("user_id", userId)
        .in("announcement_id", ids);
      if (readError) {
        return failWith("既読状態の取得に失敗");
      }
      for (const r of reads ?? []) {
        readSet.add(r.announcement_id as string);
      }
    }

    const authorNames = await resolveAuthorNames(
      supabase,
      rows.map((r) => r.created_by_user_id as string),
    );

    const items = rows.map((r) => ({
      id: r.id as string,
      title: r.title as string,
      excerpt: excerptOf(r.body_rich),
      notifyEmail: r.notify_email as boolean,
      authorName: authorNames.get(r.created_by_user_id as string) ?? "",
      publishedAt: (r.published_at as string | null) ?? null,
      createdAt: r.created_at as string,
      isDraft: r.published_at == null,
      // 下書きは既読概念を持たない(常に false)。
      isRead: r.published_at != null && readSet.has(r.id as string),
    }));

    return c.json({
      success: true,
      data: { items, total: count ?? items.length, limit, offset },
    });
  },
);

// ────────────────────────────────────────────────────────────────
// GET /api/announcements/unread-count?boardId= — 未読数(メンバー)
//   公開済みのうち、自分の既読行が無いものの件数。サイドバー/ダッシュボードのバッジ用。
// ────────────────────────────────────────────────────────────────
announcementsRoute.get(
  "/unread-count",
  authMiddleware,
  announcementMemberMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const userId = c.get("userId");
    const boardId = c.get("boardId");
    const aikiboard = supabase.schema("aikiboard");

    const failWith = (logMessage: string) => {
      logger.error(logMessage, { feature: "announcements", boardId, userId });
      return c.json(
        { success: false, error: "未読数の取得に失敗しました" },
        500,
      );
    };

    const { data: published, error: pubError } = await aikiboard
      .from("announcements")
      .select("id")
      .eq("board_id", boardId)
      .not("published_at", "is", null);
    if (pubError) {
      return failWith("公開お知らせの取得に失敗");
    }
    const publishedIds = (published ?? []).map((r) => r.id as string);
    if (publishedIds.length === 0) {
      return c.json({ success: true, data: { count: 0 } });
    }

    const { data: reads, error: readError } = await aikiboard
      .from("announcement_reads")
      .select("announcement_id")
      .eq("user_id", userId)
      .in("announcement_id", publishedIds);
    if (readError) {
      return failWith("既読状態の取得に失敗");
    }
    const readSet = new Set((reads ?? []).map((r) => r.announcement_id));
    const count = publishedIds.filter((id) => !readSet.has(id)).length;

    return c.json({ success: true, data: { count } });
  },
);

// ────────────────────────────────────────────────────────────────
// GET /api/announcements/:id — 詳細(メンバー)。下書きは管理者のみ。
// ────────────────────────────────────────────────────────────────
announcementsRoute.get(
  "/:id",
  authMiddleware,
  announcementMemberMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const userId = c.get("userId");
    const boardRole = c.get("boardRole");
    const isAdmin = boardRole === "owner" || boardRole === "admin";
    const id = c.req.param("id");
    const aikiboard = supabase.schema("aikiboard");

    const { data: row, error } = await aikiboard
      .from("announcements")
      .select(
        "id, title, body_rich, notify_email, created_by_user_id, published_at, created_at",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) {
      logger.error("announcement の取得に失敗", {
        feature: "announcements",
        announcementId: id,
      });
      return c.json(
        { success: false, error: "お知らせの取得に失敗しました" },
        500,
      );
    }
    if (!row) {
      return c.json({ success: false, error: "対象が見つかりません" }, 404);
    }
    // 下書きは管理者のみ。メンバーには存在を伏せる(404)。
    if (row.published_at == null && !isAdmin) {
      return c.json({ success: false, error: "対象が見つかりません" }, 404);
    }

    let isRead = false;
    if (row.published_at != null) {
      const { data: read } = await aikiboard
        .from("announcement_reads")
        .select("announcement_id")
        .eq("announcement_id", id)
        .eq("user_id", userId)
        .maybeSingle();
      isRead = Boolean(read);
    }

    const authorNames = await resolveAuthorNames(supabase, [
      row.created_by_user_id as string,
    ]);

    return c.json({
      success: true,
      data: {
        id: row.id as string,
        title: row.title as string,
        bodyRich: row.body_rich,
        notifyEmail: row.notify_email as boolean,
        authorName: authorNames.get(row.created_by_user_id as string) ?? "",
        publishedAt: (row.published_at as string | null) ?? null,
        createdAt: row.created_at as string,
        isDraft: row.published_at == null,
        isRead,
      },
    });
  },
);

// ────────────────────────────────────────────────────────────────
// POST /api/announcements — 作成(owner/admin)。常に下書きで作る。
// ────────────────────────────────────────────────────────────────
announcementsRoute.post(
  "/",
  authMiddleware,
  announcementAdminMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const userId = c.get("userId");
    const boardId = c.get("boardId");

    const body = await parseJson(c);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
    }
    if (!parseBodyRich(parsed.data.bodyRich).ok) {
      return c.json({ success: false, error: "本文が不正です" }, 400);
    }

    const { data, error } = await supabase
      .schema("aikiboard")
      .from("announcements")
      .insert({
        board_id: boardId,
        title: parsed.data.title,
        body_rich: parsed.data.bodyRich,
        notify_email: parsed.data.notifyEmail ?? false,
        created_by_user_id: userId,
        published_at: null,
      })
      .select("id")
      .single();
    if (error || !data) {
      logger.error("announcement の作成に失敗", {
        feature: "announcements",
        boardId,
        userId,
      });
      return c.json(
        { success: false, error: "お知らせの作成に失敗しました" },
        500,
      );
    }

    logger.info("お知らせを作成した(下書き)", {
      feature: "announcements",
      boardId,
      announcementId: data.id,
    });
    return c.json({
      success: true,
      data: { id: data.id },
      message: "下書きを保存しました",
    });
  },
);

// ────────────────────────────────────────────────────────────────
// PATCH /api/announcements/:id — 編集(owner/admin)。
//   公開済みも編集できる(再メールはしない)。
// ────────────────────────────────────────────────────────────────
announcementsRoute.patch(
  "/:id",
  authMiddleware,
  announcementAdminMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const id = c.req.param("id");

    const body = await parseJson(c);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
    }
    const p = parsed.data;
    if (p.bodyRich !== undefined && !parseBodyRich(p.bodyRich).ok) {
      return c.json({ success: false, error: "本文が不正です" }, 400);
    }

    const update: Record<string, unknown> = {};
    if (p.title !== undefined) update.title = p.title;
    if (p.bodyRich !== undefined) update.body_rich = p.bodyRich;
    if (p.notifyEmail !== undefined) update.notify_email = p.notifyEmail;
    if (Object.keys(update).length === 0) {
      return c.json({ success: false, error: "変更内容がありません" }, 400);
    }

    const { error } = await supabase
      .schema("aikiboard")
      .from("announcements")
      .update(update)
      .eq("id", id);
    if (error) {
      logger.error("announcement の更新に失敗", {
        feature: "announcements",
        announcementId: id,
      });
      return c.json(
        { success: false, error: "お知らせの更新に失敗しました" },
        500,
      );
    }

    return c.json({ success: true, message: "お知らせを更新しました" });
  },
);

// ────────────────────────────────────────────────────────────────
// POST /api/announcements/:id/publish — 公開(owner/admin)。
//   published_at をセットする一方向操作。既に公開済みなら 400。
//   notify_email=true のときのメール送信は別 PR で接続する。
// ────────────────────────────────────────────────────────────────
announcementsRoute.post(
  "/:id/publish",
  authMiddleware,
  announcementAdminMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const id = c.req.param("id");
    const boardId = c.get("boardId");
    const aikiboard = supabase.schema("aikiboard");

    const { data: current, error: fetchError } = await aikiboard
      .from("announcements")
      .select("published_at, notify_email, title, created_by_user_id")
      .eq("id", id)
      .maybeSingle();
    if (fetchError) {
      logger.error("announcement の取得に失敗(publish)", {
        feature: "announcements",
        announcementId: id,
      });
      return c.json({ success: false, error: "公開に失敗しました" }, 500);
    }
    if (!current) {
      return c.json({ success: false, error: "対象が見つかりません" }, 404);
    }
    if (current.published_at != null) {
      return c.json({ success: false, error: "既に公開されています" }, 400);
    }

    const { error } = await aikiboard
      .from("announcements")
      .update({ published_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      logger.error("announcement の公開に失敗", {
        feature: "announcements",
        announcementId: id,
      });
      return c.json({ success: false, error: "公開に失敗しました" }, 500);
    }

    logger.info("お知らせを公開した", {
      feature: "announcements",
      boardId,
      announcementId: id,
    });

    // 公開をボードメンバー(投稿者除く)にアプリ内通知 + 操作履歴に記録する。
    if (boardId) {
      await notifyBoardMembers(supabase, {
        boardId,
        actorUserId: (current.created_by_user_id as string | null) ?? null,
        type: "announcement.published",
        targetType: "announcement",
        targetId: id,
        title: (current.title as string | null) ?? "",
      });
      await logActivity(supabase, {
        boardId,
        userId: c.get("userId") ?? null,
        action: "announcement.published",
        targetType: "announcement",
        targetId: id,
        title: (current.title as string | null) ?? "",
      });
    }

    // notify_email が ON ならメンバー全員へメール送信(fire-and-forget)。
    // 送信の成否は公開の成否に影響させない。boardId はミドルウェアが必ず設定する。
    if (current.notify_email === true && boardId) {
      const appUrl = (
        getEnv(c, "APP_URL") ??
        getEnv(c, "NEXT_PUBLIC_APP_URL") ??
        "https://aiki-board.com"
      ).replace(/\/+$/, "");
      const env = {
        resendApiKey: getEnv(c, "RESEND_API_KEY"),
        resendFromEmail: getEnv(c, "RESEND_FROM_EMAIL"),
      };
      const task = notifyOnPublish(supabase, boardId, id, env, appUrl);
      // c.executionCtx は Workers Runtime 外(テスト/Node)では getter が throw する
      // ことがあるため try/catch で防御する(notifyOnPublish 内部で例外は握りつぶす)。
      try {
        c.executionCtx.waitUntil(task);
      } catch {
        void task;
      }
    }

    return c.json({ success: true, message: "お知らせを公開しました" });
  },
);

// ────────────────────────────────────────────────────────────────
// DELETE /api/announcements/:id — 削除(owner/admin)。reads は CASCADE。
// ────────────────────────────────────────────────────────────────
announcementsRoute.delete(
  "/:id",
  authMiddleware,
  announcementAdminMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const id = c.req.param("id");

    const { error } = await supabase
      .schema("aikiboard")
      .from("announcements")
      .delete()
      .eq("id", id);
    if (error) {
      logger.error("announcement の削除に失敗", {
        feature: "announcements",
        announcementId: id,
      });
      return c.json(
        { success: false, error: "お知らせの削除に失敗しました" },
        500,
      );
    }

    return c.json({ success: true, message: "お知らせを削除しました" });
  },
);

// ────────────────────────────────────────────────────────────────
// PUT /api/announcements/:id/read — 既読(メンバー)。冪等。下書きは 400。
// ────────────────────────────────────────────────────────────────
announcementsRoute.put(
  "/:id/read",
  authMiddleware,
  announcementMemberMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const userId = c.get("userId");
    const id = c.req.param("id");
    const aikiboard = supabase.schema("aikiboard");

    // 下書き(未公開)は既読対象にしない。
    const { data: target, error: fetchError } = await aikiboard
      .from("announcements")
      .select("published_at")
      .eq("id", id)
      .maybeSingle();
    if (fetchError) {
      logger.error("announcement の取得に失敗(read)", {
        feature: "announcements",
        announcementId: id,
      });
      return c.json({ success: false, error: "既読の保存に失敗しました" }, 500);
    }
    if (!target) {
      return c.json({ success: false, error: "対象が見つかりません" }, 404);
    }
    if (target.published_at == null) {
      return c.json({ success: false, error: "未公開のお知らせです" }, 400);
    }

    const { error } = await aikiboard.from("announcement_reads").upsert(
      {
        announcement_id: id,
        user_id: userId,
        read_at: new Date().toISOString(),
      },
      { onConflict: "announcement_id,user_id" },
    );
    if (error) {
      logger.error("既読の保存に失敗", {
        feature: "announcements",
        announcementId: id,
        userId,
      });
      return c.json({ success: false, error: "既読の保存に失敗しました" }, 500);
    }

    return c.json({ success: true, message: "既読にしました" });
  },
);

export default announcementsRoute;
