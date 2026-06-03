// ユーザー作成 / 取得 API。
// AikiNote は AikiBoard と同一 Supabase Auth + 共通 public."User" テーブルを共有する。
// サインアップでは Supabase Auth にユーザーを作り、public."User" に profile 行を作る。
// ADR 0002 B-5 / 0004: backend は SERVICE_ROLE(RLS バイパス)で動作する。
//
// 最小実装(Phase 1 第1機能): AikiBoard 専用のサインアップ導線は将来別途整備する。
// ローカル seed の public."User"(id / email / username / profile_image_url / dojo_style_id)
// に合わせ、id / email / username のみを INSERT する。

import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings, AppVariables } from "../../app.js";
import { logger } from "../../lib/logger.js";
import { authMiddleware } from "../../middleware/auth.js";

const usersRoute = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

const signUpSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  username: z.string().min(1).max(20),
});

// POST /api/users — サインアップ(認証不要)。
usersRoute.post("/", async (c) => {
  const supabase = c.get("supabase");
  if (!supabase) {
    return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { success: false, error: "リクエストの形式が正しくありません" },
      400,
    );
  }

  const parsed = signUpSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: "入力内容に誤りがあります" }, 400);
  }
  const { email, password, username } = parsed.data;

  // email の一意性チェック
  const { data: existingEmail, error: emailError } = await supabase
    .from("User")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (emailError) {
    logger.error("email 重複チェックに失敗", { feature: "users" });
    return c.json({ success: false, error: "ユーザー作成に失敗しました" }, 500);
  }
  if (existingEmail) {
    return c.json(
      { success: false, error: "既に登録済みのメールアドレスです" },
      400,
    );
  }

  // username の一意性チェック
  const { data: existingUsername, error: usernameError } = await supabase
    .from("User")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (usernameError) {
    logger.error("username 重複チェックに失敗", { feature: "users" });
    return c.json({ success: false, error: "ユーザー作成に失敗しました" }, 500);
  }
  if (existingUsername) {
    return c.json(
      { success: false, error: "このユーザー名は既に使用されています" },
      400,
    );
  }

  // Supabase Auth にユーザーを作成(メール確認はスキップして即ログイン可能にする)
  const { data: created, error: createError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username },
    });
  if (createError || !created?.user) {
    logger.error("Supabase Auth ユーザー作成に失敗", { feature: "users" });
    if (createError?.message?.toLowerCase().includes("email")) {
      return c.json(
        { success: false, error: "既に登録済みのメールアドレスです" },
        400,
      );
    }
    return c.json({ success: false, error: "ユーザー作成に失敗しました" }, 500);
  }
  const userId = created.user.id;

  // public."User" に profile 行を作成
  const { data: inserted, error: insertError } = await supabase
    .from("User")
    .insert({ id: userId, email, username })
    .select("id, email, username")
    .single();
  if (insertError) {
    // public."User" への INSERT が失敗したら auth ユーザーをロールバックする
    await supabase.auth.admin.deleteUser(userId);
    logger.error(
      "public.User への INSERT に失敗し auth ユーザーをロールバック",
      {
        feature: "users",
        userId,
      },
    );
    return c.json({ success: false, error: "ユーザー作成に失敗しました" }, 500);
  }

  logger.info("ユーザーを作成した", { feature: "users", userId });
  return c.json({
    success: true,
    data: inserted,
    message: "ユーザー登録が完了しました",
  });
});

// GET /api/users/:userId — 本人の profile 取得(認証必須)。
usersRoute.get("/:userId", authMiddleware, async (c) => {
  const supabase = c.get("supabase");
  if (!supabase) {
    return c.json({ success: false, error: "サーバー設定が不正です" }, 500);
  }

  const userId = c.req.param("userId");
  const authenticatedUserId = c.get("userId");
  if (authenticatedUserId !== userId) {
    return c.json(
      { success: false, error: "他のユーザーのプロフィールは取得できません" },
      403,
    );
  }

  const { data, error } = await supabase
    .from("User")
    .select("id, email, username, profile_image_url")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    logger.error("public.User の取得に失敗", { feature: "users", userId });
    return c.json(
      { success: false, error: "ユーザー情報の取得に失敗しました" },
      500,
    );
  }
  if (!data) {
    return c.json({ success: false, error: "ユーザーが見つかりません" }, 404);
  }

  return c.json({ success: true, data });
});

export default usersRoute;
