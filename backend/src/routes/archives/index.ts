// アーカイブ API(要件 4.4、有料機能 archive)。階層構造ページ + リッチテキスト + 画像/動画添付。
//
//   閲覧(一覧/検索/詳細): 全メンバー + requireFeature("archive")
//   作成/編集/削除/アップロード URL: owner/admin + requireFeature("archive")
//
// 認可は boardAccess(archives 版)+ feature_flag(requireFeature)。backend は service_role で
// RLS をバイパスするためミドルウェアが砦(RLS は migration 008 で anon 直アクセス向けに定義済み)。
// メディアは board-media バケット(prefix "archive")に保存(フィードと共通、lib/storage.ts)。
//
// 添付の AikiNote 稽古日誌引用(archive_attachment_type=aikinote_page)は列のみ確保し将来対応。

import { type Context, Hono } from "hono";
import { z } from "zod";
import type { AppBindings, AppVariables } from "../../app.js";
import { logger } from "../../lib/logger.js";
import {
  bodyRichSchema,
  extractPlainText,
  parseBodyRich,
} from "../../lib/richtext.js";
import {
  createSignedUpload,
  isAllowedContentType,
  isPathInBoard,
  removeObjects,
  resolveSignedUrls,
} from "../../lib/storage.js";
import { authMiddleware } from "../../middleware/auth.js";
import {
  archiveAdminMiddleware,
  archiveMemberMiddleware,
} from "../../middleware/boardAccess.js";
import { requireFeature } from "../../middleware/featureGuard.js";

type ArchivesEnv = { Bindings: AppBindings; Variables: AppVariables };

const archivesRoute = new Hono<ArchivesEnv>();

const uuidLike = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const TITLE_MAX = 200;
const MAX_ATTACHMENTS = 12;
const SEARCH_FETCH_MAX = 500;
const SNIPPET_MAX = 100;

const attachmentSchema = z.object({
  path: z.string().min(1).max(500),
  attachmentType: z.enum(["image", "video"]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const createSchema = z.object({
  boardId: uuidLike,
  parentId: uuidLike.nullable().optional(),
  title: z.string().trim().min(1).max(TITLE_MAX),
  bodyRich: bodyRichSchema,
  attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS).optional(),
});

const updateSchema = z.object({
  title: z.string().trim().min(1).max(TITLE_MAX).optional(),
  bodyRich: bodyRichSchema.optional(),
  parentId: uuidLike.nullable().optional(),
  orderIndex: z.number().int().min(0).max(100000).optional(),
  // 指定時は添付を total replace する(既存を消して入れ直す)。
  attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS).optional(),
});

const uploadUrlSchema = z.object({
  boardId: uuidLike,
  contentType: z.string().min(1).max(100),
});

const parseJson = async (
  c: Context<ArchivesEnv>,
): Promise<unknown | undefined> => {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
};

type AttachmentRow = {
  id: string;
  archive_id: string;
  attachment_type: "image" | "video" | "aikinote_page";
  url: string;
  metadata: Record<string, unknown>;
  order_index: number;
};

const snippetOf = (bodyRich: unknown): string => {
  const text = extractPlainText(bodyRich).replace(/\n+/g, " ").trim();
  return text.length > SNIPPET_MAX ? `${text.slice(0, SNIPPET_MAX)}…` : text;
};

// ────────────────────────────────────────────────────────────────
// POST /api/archives/upload-url — 署名付きアップロード URL(admin + feature)
// ────────────────────────────────────────────────────────────────
archivesRoute.post(
  "/upload-url",
  authMiddleware,
  archiveAdminMiddleware,
  requireFeature("archive"),
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const boardId = c.get("boardId") as string;

    const parsed = uploadUrlSchema.safeParse(await parseJson(c));
    if (!parsed.success || !isAllowedContentType(parsed.data.contentType)) {
      return c.json(
        { success: false, error: "対応していないファイル形式です" },
        400,
      );
    }
    const upload = await createSignedUpload(
      supabase,
      "archive",
      boardId,
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
// GET /api/archives?boardId= — ツリー描画用の全ページ(メンバー + feature)
//   本文は返さず、id / parent_id / title / order で軽量に返す。
// ────────────────────────────────────────────────────────────────
archivesRoute.get(
  "/",
  authMiddleware,
  archiveMemberMiddleware,
  requireFeature("archive"),
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const boardId = c.get("boardId");

    const { data, error } = await supabase
      .schema("aikiboard")
      .from("archives")
      .select("id, parent_id, title, order_index, created_at")
      .eq("board_id", boardId)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      logger.error("アーカイブ一覧の取得に失敗", {
        feature: "archives",
        boardId,
      });
      return c.json(
        { success: false, error: "アーカイブの取得に失敗しました" },
        500,
      );
    }

    const items = (data ?? []).map((r) => ({
      id: r.id as string,
      parentId: (r.parent_id as string | null) ?? null,
      title: r.title as string,
      orderIndex: r.order_index as number,
      createdAt: r.created_at as string,
    }));
    return c.json({ success: true, data: items });
  },
);

// ────────────────────────────────────────────────────────────────
// GET /api/archives/search?boardId=&q= — タイトル + 本文のフリーワード検索
// ────────────────────────────────────────────────────────────────
archivesRoute.get(
  "/search",
  authMiddleware,
  archiveMemberMiddleware,
  requireFeature("archive"),
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const boardId = c.get("boardId");
    const q = (c.req.query("q") ?? "").trim().toLowerCase();
    if (q.length === 0) {
      return c.json({ success: true, data: [] });
    }

    const { data, error } = await supabase
      .schema("aikiboard")
      .from("archives")
      .select("id, title, body_rich")
      .eq("board_id", boardId)
      .limit(SEARCH_FETCH_MAX);
    if (error) {
      logger.error("アーカイブ検索に失敗", { feature: "archives", boardId });
      return c.json({ success: false, error: "検索に失敗しました" }, 500);
    }

    const results = (data ?? [])
      .map((r) => {
        const title = r.title as string;
        const bodyText = extractPlainText(r.body_rich);
        const haystack = `${title}\n${bodyText}`.toLowerCase();
        return haystack.includes(q)
          ? { id: r.id as string, title, snippet: snippetOf(r.body_rich) }
          : null;
      })
      .filter((x): x is { id: string; title: string; snippet: string } =>
        Boolean(x),
      );

    return c.json({ success: true, data: results });
  },
);

// ────────────────────────────────────────────────────────────────
// GET /api/archives/:id — ページ詳細(メンバー + feature)。添付の署名 URL つき。
// ────────────────────────────────────────────────────────────────
archivesRoute.get(
  "/:id",
  authMiddleware,
  archiveMemberMiddleware,
  requireFeature("archive"),
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const id = c.req.param("id");
    const aikiboard = supabase.schema("aikiboard");

    const { data: row, error } = await aikiboard
      .from("archives")
      .select("id, parent_id, title, body_rich, created_at")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      logger.error("アーカイブ詳細の取得に失敗", {
        feature: "archives",
        archiveId: id,
      });
      return c.json(
        { success: false, error: "アーカイブの取得に失敗しました" },
        500,
      );
    }
    if (!row) {
      return c.json({ success: false, error: "対象が見つかりません" }, 404);
    }

    const { data: attachments, error: attError } = await aikiboard
      .from("archive_attachments")
      .select("id, archive_id, attachment_type, url, metadata, order_index")
      .eq("archive_id", id)
      .order("order_index", { ascending: true });
    if (attError) {
      return c.json({ success: false, error: "添付の取得に失敗しました" }, 500);
    }
    const rows = (attachments ?? []) as AttachmentRow[];
    const signed = await resolveSignedUrls(
      supabase,
      rows
        .filter((a) => a.attachment_type !== "aikinote_page")
        .map((a) => a.url),
    );

    return c.json({
      success: true,
      data: {
        id: row.id as string,
        parentId: (row.parent_id as string | null) ?? null,
        title: row.title as string,
        bodyRich: row.body_rich,
        createdAt: row.created_at as string,
        attachments: rows.map((a) => ({
          id: a.id,
          type: a.attachment_type,
          url: signed.get(a.url) ?? null,
          metadata: a.metadata ?? {},
        })),
      },
    });
  },
);

// 兄弟の末尾に並べるための order_index を求める。
const nextOrderIndex = async (
  supabase: NonNullable<AppVariables["supabase"]>,
  boardId: string,
  parentId: string | null,
): Promise<number> => {
  let query = supabase
    .schema("aikiboard")
    .from("archives")
    .select("order_index")
    .eq("board_id", boardId)
    .order("order_index", { ascending: false })
    .limit(1);
  query = parentId
    ? query.eq("parent_id", parentId)
    : query.is("parent_id", null);
  const { data } = await query;
  const max = (data?.[0]?.order_index as number | undefined) ?? -1;
  return max + 1;
};

// ────────────────────────────────────────────────────────────────
// POST /api/archives — 作成(admin + feature)
// ────────────────────────────────────────────────────────────────
archivesRoute.post(
  "/",
  authMiddleware,
  archiveAdminMiddleware,
  requireFeature("archive"),
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const userId = c.get("userId") as string;
    const boardId = c.get("boardId") as string;
    const aikiboard = supabase.schema("aikiboard");

    const parsed = createSchema.safeParse(await parseJson(c));
    if (!parsed.success || !parseBodyRich(parsed.data.bodyRich).ok) {
      return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
    }
    const attachments = parsed.data.attachments ?? [];
    for (const a of attachments) {
      if (!isPathInBoard(a.path, "archive", boardId)) {
        return c.json(
          { success: false, error: "不正な添付が含まれています" },
          400,
        );
      }
    }

    const parentId = parsed.data.parentId ?? null;
    const orderIndex = await nextOrderIndex(supabase, boardId, parentId);

    const { data: created, error } = await aikiboard
      .from("archives")
      .insert({
        board_id: boardId,
        parent_id: parentId,
        title: parsed.data.title,
        body_rich: parsed.data.bodyRich,
        order_index: orderIndex,
        created_by_user_id: userId,
      })
      .select("id")
      .single();
    if (error || !created) {
      logger.error("アーカイブの作成に失敗", { feature: "archives", boardId });
      return c.json(
        { success: false, error: "アーカイブの作成に失敗しました" },
        500,
      );
    }

    if (attachments.length > 0) {
      const rows = attachments.map((a, index) => ({
        archive_id: created.id,
        attachment_type: a.attachmentType,
        url: a.path,
        metadata: a.metadata ?? {},
        order_index: index,
      }));
      const { error: attError } = await aikiboard
        .from("archive_attachments")
        .insert(rows);
      if (attError) {
        await aikiboard.from("archives").delete().eq("id", created.id);
        return c.json(
          { success: false, error: "添付の保存に失敗しました" },
          500,
        );
      }
    }

    logger.info("アーカイブを作成した", {
      feature: "archives",
      boardId,
      archiveId: created.id,
    });
    return c.json({
      success: true,
      data: { id: created.id },
      message: "ページを作成しました",
    });
  },
);

// ────────────────────────────────────────────────────────────────
// PATCH /api/archives/:id — 編集(admin + feature)。attachments 指定時は total replace。
// ────────────────────────────────────────────────────────────────
archivesRoute.patch(
  "/:id",
  authMiddleware,
  archiveAdminMiddleware,
  requireFeature("archive"),
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const id = c.req.param("id");
    const boardId = c.get("boardId") as string;
    const aikiboard = supabase.schema("aikiboard");

    const parsed = updateSchema.safeParse(await parseJson(c));
    if (!parsed.success) {
      return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
    }
    const p = parsed.data;
    if (p.bodyRich !== undefined && !parseBodyRich(p.bodyRich).ok) {
      return c.json({ success: false, error: "本文が不正です" }, 400);
    }
    // 自分自身を親にするのは禁止(単純な循環防止)。
    if (p.parentId && p.parentId === id) {
      return c.json({ success: false, error: "親の指定が不正です" }, 400);
    }

    const update: Record<string, unknown> = {};
    if (p.title !== undefined) update.title = p.title;
    if (p.bodyRich !== undefined) update.body_rich = p.bodyRich;
    if (p.parentId !== undefined) update.parent_id = p.parentId;
    if (p.orderIndex !== undefined) update.order_index = p.orderIndex;

    if (Object.keys(update).length > 0) {
      const { error } = await aikiboard
        .from("archives")
        .update(update)
        .eq("id", id);
      if (error) {
        logger.error("アーカイブの更新に失敗", {
          feature: "archives",
          archiveId: id,
        });
        return c.json(
          { success: false, error: "アーカイブの更新に失敗しました" },
          500,
        );
      }
    }

    // 添付の total replace(指定時のみ)。古い添付の実体はベストエフォートで削除。
    if (p.attachments !== undefined) {
      for (const a of p.attachments) {
        if (!isPathInBoard(a.path, "archive", boardId)) {
          return c.json(
            { success: false, error: "不正な添付が含まれています" },
            400,
          );
        }
      }
      const { data: oldAtt } = await aikiboard
        .from("archive_attachments")
        .select("url, attachment_type")
        .eq("archive_id", id);
      await aikiboard.from("archive_attachments").delete().eq("archive_id", id);
      if (p.attachments.length > 0) {
        const rows = p.attachments.map((a, index) => ({
          archive_id: id,
          attachment_type: a.attachmentType,
          url: a.path,
          metadata: a.metadata ?? {},
          order_index: index,
        }));
        const { error: insErr } = await aikiboard
          .from("archive_attachments")
          .insert(rows);
        if (insErr) {
          return c.json(
            { success: false, error: "添付の保存に失敗しました" },
            500,
          );
        }
      }
      // 新しい添付パス集合に含まれない古いファイルだけ消す。
      const keep = new Set(p.attachments.map((a) => a.path));
      await removeObjects(
        supabase,
        (oldAtt ?? [])
          .filter(
            (a) =>
              a.attachment_type !== "aikinote_page" &&
              !keep.has(a.url as string),
          )
          .map((a) => a.url as string),
      );
    }

    return c.json({ success: true, message: "ページを更新しました" });
  },
);

// ────────────────────────────────────────────────────────────────
// DELETE /api/archives/:id — 削除(admin + feature)。子ページ・添付は CASCADE。
//   このページ直下の添付の実体はベストエフォートで削除(子孫の実体は孤児になりうる)。
// ────────────────────────────────────────────────────────────────
archivesRoute.delete(
  "/:id",
  authMiddleware,
  archiveAdminMiddleware,
  requireFeature("archive"),
  async (c) => {
    const supabase = c.get("supabase");
    if (!supabase) {
      return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
    }
    const id = c.req.param("id");
    const aikiboard = supabase.schema("aikiboard");

    const { data: attachments } = await aikiboard
      .from("archive_attachments")
      .select("url, attachment_type")
      .eq("archive_id", id);

    const { error } = await aikiboard.from("archives").delete().eq("id", id);
    if (error) {
      logger.error("アーカイブの削除に失敗", {
        feature: "archives",
        archiveId: id,
      });
      return c.json(
        { success: false, error: "アーカイブの削除に失敗しました" },
        500,
      );
    }

    await removeObjects(
      supabase,
      (attachments ?? [])
        .filter((a) => a.attachment_type !== "aikinote_page")
        .map((a) => a.url as string),
    );

    return c.json({ success: true, message: "ページを削除しました" });
  },
);

export default archivesRoute;
