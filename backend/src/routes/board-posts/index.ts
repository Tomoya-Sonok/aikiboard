// 道場内フィード API(要件 4.3)。メンバー・管理者の双方が投稿でき、各投稿は
// テキスト + 画像/動画(board_post_attachments)を持つ。各投稿へのスレッド返信
// (フラット 1 階層、threads テーブル)も本ルートに同居する(:id でボードを解決できるため)。
//
// 認証は authMiddleware、ボード権限は boardAccess(board_posts 版)で確認する。
//   - 一覧 / 詳細 / 作成 / アップロード URL 発行 / 返信一覧・作成: boardPostMemberMiddleware(メンバー以上)
//   - 投稿削除・返信削除: メンバー判定の上で「本人 or owner/admin」のみ(ハンドラで判定)
//
// 認可について(events / announcements と同じ前提): backend は service_role で RLS を
// バイパスするため、この経路の認可は boardAccess ミドルウェアが唯一の砦。RLS は frontend が
// anon キーで直接読む経路の二重防御(migration 008 で board_posts/attachments を定義済み)。
//
// メディアは Supabase Storage の非公開バケット(board-media)に保存する。
//   1. フロントが POST /upload-url で署名付きアップロード URL を取得
//   2. フロントが署名トークンで直接 Storage に PUT
//   3. POST / で本文 + 添付パスを送り、board_posts + board_post_attachments を作成
//   4. 一覧/詳細では短命の署名付き DL URL を都度発行して返す(lib/storage.ts)

import { type Context, Hono } from "hono";
import { z } from "zod";
import type { AppBindings, AppVariables } from "../../app.js";
import {
  crossPostToAikinote,
  isOwnAikinotePost,
  listOwnAikinotePosts,
  type QuotedAikinotePost,
  resolveQuotedPosts,
} from "../../lib/aikinote.js";
import { logger } from "../../lib/logger.js";
import {
  createNotifications,
  notifyBoardMembers,
} from "../../lib/notifications.js";
import {
  createSignedUpload,
  isAllowedContentType,
  isPathInBoard,
  removeObjects,
  resolveSignedUrls,
} from "../../lib/storage.js";
import { authMiddleware } from "../../middleware/auth.js";
import { boardPostMemberMiddleware } from "../../middleware/boardAccess.js";

// 通知タイトル用に本文を短く切り詰める。
const NOTIFY_SNIPPET = 60;
const snippet = (s: string): string =>
  s.length > NOTIFY_SNIPPET ? `${s.slice(0, NOTIFY_SNIPPET)}…` : s;

type BoardPostsEnv = { Bindings: AppBindings; Variables: AppVariables };

const boardPostsRoute = new Hono<BoardPostsEnv>();

const uuidLike = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const BODY_MAX = 5000;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_ATTACHMENTS = 4;

// 添付メタデータ(width/height/duration 等)。未知キーは strip して保存する。
const metadataSchema = z
  .object({
    width: z.number().int().positive().max(100000).optional(),
    height: z.number().int().positive().max(100000).optional(),
    durationSec: z.number().nonnegative().max(86400).optional(),
    sizeBytes: z.number().int().nonnegative().optional(),
    mime: z.string().max(100).optional(),
    name: z.string().max(255).optional(),
  })
  .strip();

const attachmentSchema = z.object({
  path: z.string().min(1).max(500),
  attachmentType: z.enum(["image", "video"]),
  metadata: metadataSchema.optional(),
});

const createSchema = z
  .object({
    boardId: uuidLike,
    body: z.string().max(BODY_MAX),
    attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS).optional(),
    // AikiNote にも流す(5.3.1 クロスポスト、投稿ごとのオプトイン)。
    crossPostToAikinote: z.boolean().optional(),
    // AikiNote 稽古日誌の引用共有(5.3.2)。本人の SocialPost id。
    syncedFromPostId: uuidLike.optional(),
  })
  .refine(
    (v) =>
      v.body.trim().length > 0 ||
      (v.attachments?.length ?? 0) > 0 ||
      v.syncedFromPostId != null,
    { message: "本文・添付・引用のいずれかが必要です" },
  );

const uploadUrlSchema = z.object({
  boardId: uuidLike,
  contentType: z.string().min(1).max(100),
});

const parseJson = async (
  c: Context<BoardPostsEnv>,
): Promise<unknown | undefined> => {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
};

type AuthorInfo = { username: string; profileImageUrl: string | null };

// author_user_id 群 → public."User"(username / profile_image_url)を解決する。
const resolveAuthors = async (
  supabase: NonNullable<AppVariables["supabase"]>,
  userIds: string[],
): Promise<Map<string, AuthorInfo>> => {
  const byId = new Map<string, AuthorInfo>();
  const ids = [...new Set(userIds)];
  if (ids.length === 0) {
    return byId;
  }
  const { data, error } = await supabase
    .from("User")
    .select("id, username, profile_image_url")
    .in("id", ids);
  if (error) {
    return byId;
  }
  for (const u of data ?? []) {
    byId.set(u.id, {
      username: u.username ?? "",
      profileImageUrl: u.profile_image_url ?? null,
    });
  }
  return byId;
};

type AttachmentRow = {
  id: string;
  post_id: string;
  attachment_type: "image" | "video";
  url: string;
  metadata: Record<string, unknown>;
  order_index: number;
};

// 投稿行 + 添付 + 返信数 を DTO に整形する(一覧・詳細で共用)。
const toPostDto = (
  row: {
    id: string;
    body: string;
    author_user_id: string;
    cross_post_to_aikinote: boolean;
    synced_from_post_id: string | null;
    created_at: string;
  },
  authors: Map<string, AuthorInfo>,
  attachmentsByPost: Map<string, AttachmentRow[]>,
  signedUrls: Map<string, string>,
  replyCountByPost: Map<string, number>,
  quotedByPostId: Map<string, QuotedAikinotePost>,
  viewerUserId: string | undefined,
  isAdmin: boolean,
) => {
  const author = authors.get(row.author_user_id);
  const attachments = (attachmentsByPost.get(row.id) ?? [])
    .slice()
    .sort((a, b) => a.order_index - b.order_index)
    .map((a) => ({
      id: a.id,
      type: a.attachment_type,
      url: signedUrls.get(a.url) ?? null,
      metadata: a.metadata ?? {},
    }));
  const quoted = row.synced_from_post_id
    ? (quotedByPostId.get(row.synced_from_post_id) ?? null)
    : null;
  return {
    id: row.id,
    body: row.body,
    author: {
      userId: row.author_user_id,
      username: author?.username ?? "",
      profileImageUrl: author?.profileImageUrl ?? null,
    },
    attachments,
    replyCount: replyCountByPost.get(row.id) ?? 0,
    crossPostToAikinote: row.cross_post_to_aikinote,
    syncedFromPostId: row.synced_from_post_id,
    quotedAikinotePost: quoted,
    createdAt: row.created_at,
    canDelete: isAdmin || row.author_user_id === viewerUserId,
  };
};

// 投稿 id 群に対し、添付・返信数・著者・署名 URL をまとめて解決する。
const hydratePosts = async (
  supabase: NonNullable<AppVariables["supabase"]>,
  rows: {
    id: string;
    body: string;
    author_user_id: string;
    cross_post_to_aikinote: boolean;
    synced_from_post_id: string | null;
    created_at: string;
  }[],
  viewerUserId: string | undefined,
  isAdmin: boolean,
): Promise<ReturnType<typeof toPostDto>[] | null> => {
  const aikiboard = supabase.schema("aikiboard");
  const postIds = rows.map((r) => r.id);
  if (postIds.length === 0) {
    return [];
  }

  const [attachmentsRes, threadsRes] = await Promise.all([
    aikiboard
      .from("board_post_attachments")
      .select("id, post_id, attachment_type, url, metadata, order_index")
      .in("post_id", postIds),
    aikiboard.from("threads").select("post_id").in("post_id", postIds),
  ]);
  if (attachmentsRes.error || threadsRes.error) {
    return null;
  }

  const attachmentsByPost = new Map<string, AttachmentRow[]>();
  for (const a of (attachmentsRes.data ?? []) as AttachmentRow[]) {
    const list = attachmentsByPost.get(a.post_id) ?? [];
    list.push(a);
    attachmentsByPost.set(a.post_id, list);
  }

  const replyCountByPost = new Map<string, number>();
  for (const t of threadsRes.data ?? []) {
    const pid = t.post_id as string;
    replyCountByPost.set(pid, (replyCountByPost.get(pid) ?? 0) + 1);
  }

  const authors = await resolveAuthors(
    supabase,
    rows.map((r) => r.author_user_id),
  );
  const signedUrls = await resolveSignedUrls(
    supabase,
    [...attachmentsByPost.values()].flat().map((a) => a.url),
  );
  // 引用共有(synced_from_post_id)があれば AikiNote の SocialPost を解決する。
  const quotedByPostId = await resolveQuotedPosts(
    supabase,
    rows
      .map((r) => r.synced_from_post_id)
      .filter((id): id is string => id != null),
  );

  return rows.map((r) =>
    toPostDto(
      r,
      authors,
      attachmentsByPost,
      signedUrls,
      replyCountByPost,
      quotedByPostId,
      viewerUserId,
      isAdmin,
    ),
  );
};

// ────────────────────────────────────────────────────────────────
// POST /api/board-posts/upload-url — 署名付きアップロード URL(メンバー)
//   body: { boardId, contentType }。Storage の board-media バケットに直接 PUT させる。
// ────────────────────────────────────────────────────────────────
boardPostsRoute.post(
  "/upload-url",
  authMiddleware,
  boardPostMemberMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const boardId = c.get("boardId");

    const body = await parseJson(c);
    const parsed = uploadUrlSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
    }
    if (!isAllowedContentType(parsed.data.contentType)) {
      return c.json(
        { success: false, error: "対応していないファイル形式です" },
        400,
      );
    }

    const upload = await createSignedUpload(
      supabase,
      "feed",
      boardId as string,
      parsed.data.contentType,
    );
    if (!upload) {
      return c.json(
        { success: false, error: "アップロード URL の発行に失敗しました" },
        500,
      );
    }

    return c.json({
      success: true,
      data: {
        path: upload.path,
        token: upload.token,
        signedUrl: upload.signedUrl,
        attachmentType: upload.kind,
      },
    });
  },
);

// ────────────────────────────────────────────────────────────────
// GET /api/board-posts?boardId=&limit=&offset= — フィード一覧(メンバー)
//   新しい順。添付の署名 URL・返信数・著者名を付けて返す。
// ────────────────────────────────────────────────────────────────
boardPostsRoute.get(
  "/",
  authMiddleware,
  boardPostMemberMiddleware,
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
      logger.error(logMessage, { feature: "board-posts", boardId, userId });
      return c.json(
        { success: false, error: "フィードの取得に失敗しました" },
        500,
      );
    };

    const { data, error, count } = await aikiboard
      .from("board_posts")
      .select(
        "id, body, author_user_id, cross_post_to_aikinote, synced_from_post_id, created_at",
        { count: "exact" },
      )
      .eq("board_id", boardId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) {
      return failWith("board_posts の取得に失敗");
    }

    const items = await hydratePosts(supabase, data ?? [], userId, isAdmin);
    if (!items) {
      return failWith("フィードの関連データ取得に失敗");
    }

    return c.json({
      success: true,
      data: { items, total: count ?? items.length, limit, offset },
    });
  },
);

// ────────────────────────────────────────────────────────────────
// GET /api/board-posts/aikinote-posts?boardId= — 引用ピッカー用(メンバー)
//   閲覧者本人の AikiNote 投稿(SocialPost)一覧を新しい順で返す(5.3.2)。
//   静的セグメントなので /:id より前に定義する。
// ────────────────────────────────────────────────────────────────
boardPostsRoute.get(
  "/aikinote-posts",
  authMiddleware,
  boardPostMemberMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const userId = c.get("userId");
    const posts = await listOwnAikinotePosts(supabase, userId as string);
    return c.json({ success: true, data: posts });
  },
);

// ────────────────────────────────────────────────────────────────
// GET /api/board-posts/:id — 投稿 1 件(メンバー)。スレッド画面の先頭表示用。
// ────────────────────────────────────────────────────────────────
boardPostsRoute.get(
  "/:id",
  authMiddleware,
  boardPostMemberMiddleware,
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
      .from("board_posts")
      .select(
        "id, body, author_user_id, cross_post_to_aikinote, synced_from_post_id, created_at",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) {
      logger.error("board_post の取得に失敗", {
        feature: "board-posts",
        postId: id,
      });
      return c.json({ success: false, error: "投稿の取得に失敗しました" }, 500);
    }
    if (!row) {
      return c.json({ success: false, error: "対象が見つかりません" }, 404);
    }

    const items = await hydratePosts(supabase, [row], userId, isAdmin);
    if (!items) {
      return c.json(
        { success: false, error: "投稿の関連データ取得に失敗しました" },
        500,
      );
    }

    return c.json({ success: true, data: items[0] });
  },
);

// ────────────────────────────────────────────────────────────────
// POST /api/board-posts — 投稿作成(メンバー)。本文 + 添付(任意)。
// ────────────────────────────────────────────────────────────────
boardPostsRoute.post(
  "/",
  authMiddleware,
  boardPostMemberMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const userId = c.get("userId");
    const boardId = c.get("boardId") as string;

    const body = await parseJson(c);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
    }
    const attachments = parsed.data.attachments ?? [];
    const syncedFromPostId = parsed.data.syncedFromPostId ?? null;
    const wantsCrossPost = parsed.data.crossPostToAikinote === true;

    // 添付パスが当該ボード配下(feed/<boardId>/...)かを検証(越境防止)。
    // attachment_type は contentType 由来だが、パスの拡張子と種別の整合も担保する。
    for (const a of attachments) {
      if (!isPathInBoard(a.path, "feed", boardId)) {
        return c.json(
          { success: false, error: "不正な添付が含まれています" },
          400,
        );
      }
    }

    // 引用共有: 指定の AikiNote 投稿が本人のものか検証(他人の投稿の引用詐称を防ぐ)。
    if (
      syncedFromPostId &&
      !(await isOwnAikinotePost(supabase, syncedFromPostId, userId as string))
    ) {
      return c.json(
        { success: false, error: "引用できる投稿ではありません" },
        400,
      );
    }

    const { data: post, error } = await aikiboardInsertPost(supabase, {
      boardId,
      userId: userId as string,
      body: parsed.data.body,
      crossPostToAikinote: wantsCrossPost,
      syncedFromPostId,
    });
    if (error || !post) {
      logger.error("board_post の作成に失敗", {
        feature: "board-posts",
        boardId,
        userId,
      });
      return c.json({ success: false, error: "投稿の作成に失敗しました" }, 500);
    }

    if (attachments.length > 0) {
      const rows = attachments.map((a, index) => ({
        post_id: post.id,
        attachment_type: a.attachmentType,
        url: a.path,
        metadata: a.metadata ?? {},
        order_index: index,
      }));
      const { error: attachError } = await supabase
        .schema("aikiboard")
        .from("board_post_attachments")
        .insert(rows);
      if (attachError) {
        // 添付の保存に失敗したら投稿ごとロールバック(CASCADE で添付も消える)。
        await supabase
          .schema("aikiboard")
          .from("board_posts")
          .delete()
          .eq("id", post.id);
        logger.error("添付の保存に失敗(投稿をロールバック)", {
          feature: "board-posts",
          boardId,
          postId: post.id,
        });
        return c.json(
          { success: false, error: "添付の保存に失敗しました" },
          500,
        );
      }
    }

    // AikiNote クロスポスト(5.3.1)。本文がある場合のみ、ボードの主道場名義で SocialPost を
    // 1 件作る。失敗してもボード投稿は止めない(fire-and-forget 相当)。
    if (wantsCrossPost && parsed.data.body.trim().length > 0) {
      const primary = await resolvePrimaryDojo(supabase, boardId);
      await crossPostToAikinote(supabase, {
        userId: userId as string,
        content: parsed.data.body,
        dojoStyleId: primary.dojoStyleId,
        dojoName: primary.dojoName,
      });
    }

    // フィード新規投稿をボードメンバー(投稿者除く)に通知する。
    await notifyBoardMembers(supabase, {
      boardId,
      actorUserId: userId as string,
      type: "post.created",
      targetType: "post",
      targetId: post.id,
      title:
        parsed.data.body.trim().length > 0
          ? snippet(parsed.data.body.trim())
          : "(画像・動画)",
    });

    logger.info("フィード投稿を作成した", {
      feature: "board-posts",
      boardId,
      postId: post.id,
    });
    return c.json({
      success: true,
      data: { id: post.id },
      message: "投稿しました",
    });
  },
);

const aikiboardInsertPost = (
  supabase: NonNullable<AppVariables["supabase"]>,
  params: {
    boardId: string;
    userId: string;
    body: string;
    crossPostToAikinote: boolean;
    syncedFromPostId: string | null;
  },
) =>
  supabase
    .schema("aikiboard")
    .from("board_posts")
    .insert({
      board_id: params.boardId,
      author_user_id: params.userId,
      body: params.body,
      cross_post_to_aikinote: params.crossPostToAikinote,
      synced_from_post_id: params.syncedFromPostId,
    })
    .select("id")
    .single();

// クロスポスト時の道場アカウント名義。ボードの主道場(board_dojo_masters.is_primary)から
// DojoStyleMaster.dojo_name を引く。無ければ board 名で代替する。
const resolvePrimaryDojo = async (
  supabase: NonNullable<AppVariables["supabase"]>,
  boardId: string,
): Promise<{ dojoStyleId: string | null; dojoName: string | null }> => {
  const aikiboard = supabase.schema("aikiboard");
  const { data: link } = await aikiboard
    .from("board_dojo_masters")
    .select("dojo_master_id")
    .eq("board_id", boardId)
    .eq("is_primary", true)
    .maybeSingle();
  const dojoStyleId = (link?.dojo_master_id as string | undefined) ?? null;

  let dojoName: string | null = null;
  if (dojoStyleId) {
    const { data: dojo } = await supabase
      .from("DojoStyleMaster")
      .select("dojo_name")
      .eq("id", dojoStyleId)
      .maybeSingle();
    dojoName = (dojo?.dojo_name as string | undefined) ?? null;
  }
  if (!dojoName) {
    const { data: board } = await aikiboard
      .from("boards")
      .select("name")
      .eq("id", boardId)
      .maybeSingle();
    dojoName = (board?.name as string | undefined) ?? null;
  }
  return { dojoStyleId, dojoName };
};

// ────────────────────────────────────────────────────────────────
// DELETE /api/board-posts/:id — 削除(投稿者本人 or owner/admin)。
//   添付は CASCADE。ストレージ実体はベストエフォートで削除する。
// ────────────────────────────────────────────────────────────────
boardPostsRoute.delete(
  "/:id",
  authMiddleware,
  boardPostMemberMiddleware,
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

    const { data: post, error: fetchError } = await aikiboard
      .from("board_posts")
      .select("author_user_id")
      .eq("id", id)
      .maybeSingle();
    if (fetchError) {
      logger.error("board_post の取得に失敗(delete)", {
        feature: "board-posts",
        postId: id,
      });
      return c.json({ success: false, error: "削除に失敗しました" }, 500);
    }
    if (!post) {
      return c.json({ success: false, error: "対象が見つかりません" }, 404);
    }
    if (!isAdmin && post.author_user_id !== userId) {
      return c.json({ success: false, error: "権限がありません" }, 403);
    }

    // ストレージ実体の削除のため、先に添付パスを取得しておく。
    const { data: attachments } = await aikiboard
      .from("board_post_attachments")
      .select("url")
      .eq("post_id", id);

    const { error } = await aikiboard.from("board_posts").delete().eq("id", id);
    if (error) {
      logger.error("board_post の削除に失敗", {
        feature: "board-posts",
        postId: id,
      });
      return c.json({ success: false, error: "削除に失敗しました" }, 500);
    }

    await removeObjects(
      supabase,
      (attachments ?? []).map((a) => a.url as string),
    );

    return c.json({ success: true, message: "投稿を削除しました" });
  },
);

// ────────────────────────────────────────────────────────────────
// スレッド(投稿への返信)。フラット 1 階層(要件 4.3)。
//   board は :id(投稿の id)から board_posts 経由で解決する(boardPostMemberMiddleware)。
//   返信はテキストのみ(threads.body)。閲覧/作成=メンバー、削除=返信者本人 or owner/admin。
// ────────────────────────────────────────────────────────────────

const threadCreateSchema = z.object({ body: z.string().min(1).max(BODY_MAX) });

// GET /api/board-posts/:id/threads — 返信一覧(メンバー)。古い順(読み進める順)。
boardPostsRoute.get(
  "/:id/threads",
  authMiddleware,
  boardPostMemberMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const userId = c.get("userId");
    const boardRole = c.get("boardRole");
    const isAdmin = boardRole === "owner" || boardRole === "admin";
    const postId = c.req.param("id");
    const aikiboard = supabase.schema("aikiboard");

    const { data, error } = await aikiboard
      .from("threads")
      .select("id, author_user_id, body, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (error) {
      logger.error("threads の取得に失敗", {
        feature: "board-posts",
        postId,
      });
      return c.json({ success: false, error: "返信の取得に失敗しました" }, 500);
    }
    const rows = data ?? [];
    const authors = await resolveAuthors(
      supabase,
      rows.map((r) => r.author_user_id as string),
    );
    const items = rows.map((r) => ({
      id: r.id as string,
      body: r.body as string,
      author: {
        userId: r.author_user_id as string,
        username: authors.get(r.author_user_id as string)?.username ?? "",
        profileImageUrl:
          authors.get(r.author_user_id as string)?.profileImageUrl ?? null,
      },
      createdAt: r.created_at as string,
      canDelete: isAdmin || r.author_user_id === userId,
    }));

    return c.json({ success: true, data: items });
  },
);

// POST /api/board-posts/:id/threads — 返信作成(メンバー)。
boardPostsRoute.post(
  "/:id/threads",
  authMiddleware,
  boardPostMemberMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const userId = c.get("userId");
    const boardId = c.get("boardId");
    const postId = c.req.param("id");

    const body = await parseJson(c);
    const parsed = threadCreateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
    }

    const { data, error } = await supabase
      .schema("aikiboard")
      .from("threads")
      .insert({
        post_id: postId,
        author_user_id: userId,
        body: parsed.data.body,
      })
      .select("id")
      .single();
    if (error || !data) {
      logger.error("thread の作成に失敗", {
        feature: "board-posts",
        boardId,
        postId,
      });
      return c.json({ success: false, error: "返信の作成に失敗しました" }, 500);
    }

    // 投稿者に「返信がついた」ことを通知する(返信者本人が投稿者なら除外される)。
    const { data: postRow } = await supabase
      .schema("aikiboard")
      .from("board_posts")
      .select("author_user_id")
      .eq("id", postId)
      .maybeSingle();
    if (postRow?.author_user_id) {
      await createNotifications(supabase, {
        boardId: boardId as string,
        recipientUserIds: [postRow.author_user_id as string],
        actorUserId: userId as string,
        type: "thread.replied",
        targetType: "post",
        targetId: postId,
        title: snippet(parsed.data.body),
      });
    }

    return c.json({
      success: true,
      data: { id: data.id },
      message: "返信しました",
    });
  },
);

// DELETE /api/board-posts/:id/threads/:threadId — 返信削除(返信者本人 or owner/admin)。
boardPostsRoute.delete(
  "/:id/threads/:threadId",
  authMiddleware,
  boardPostMemberMiddleware,
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const userId = c.get("userId");
    const boardRole = c.get("boardRole");
    const isAdmin = boardRole === "owner" || boardRole === "admin";
    const postId = c.req.param("id");
    const threadId = c.req.param("threadId");
    const aikiboard = supabase.schema("aikiboard");

    const { data: thread, error: fetchError } = await aikiboard
      .from("threads")
      .select("author_user_id, post_id")
      .eq("id", threadId)
      .maybeSingle();
    if (fetchError) {
      logger.error("thread の取得に失敗(delete)", {
        feature: "board-posts",
        threadId,
      });
      return c.json({ success: false, error: "削除に失敗しました" }, 500);
    }
    // 別投稿の返信 id を渡して消す越境を防ぐ(post_id とルートの :id の一致を要求)。
    if (!thread || thread.post_id !== postId) {
      return c.json({ success: false, error: "対象が見つかりません" }, 404);
    }
    if (!isAdmin && thread.author_user_id !== userId) {
      return c.json({ success: false, error: "権限がありません" }, 403);
    }

    const { error } = await aikiboard
      .from("threads")
      .delete()
      .eq("id", threadId);
    if (error) {
      logger.error("thread の削除に失敗", {
        feature: "board-posts",
        threadId,
      });
      return c.json({ success: false, error: "削除に失敗しました" }, 500);
    }

    return c.json({ success: true, message: "返信を削除しました" });
  },
);

export default boardPostsRoute;
