// OAuth 初回ログイン時に public."User" 行を作る(specs/auth/spec.md「OAuth ログインの仕様」)。
//
// AikiNote の frontend/src/lib/server/ensure-oauth-user.ts に準拠しつつ、2点だけ変えている:
//   1. INSERT する列は id / email / username / profile_image_url の 4 列のみ。
//      AikiBoard の backend `POST /api/users` が「ローカル seed に合わせ id/email/username のみ」
//      としているため、同一リポジトリ内で列セットが分岐しないよう揃える。
//   2. username の衝突時に自動リトライする。AikiNote は衝突対策が無く、衝突すると
//      「ログインは成功するのにプロフィール行が無い」状態になる(サイレント失敗)。
//
// service_role で直接 INSERT する(backend にエンドポイントを増やさない)。呼び出し元は
// /auth/callback の route handler のみで、そこは exchangeCodeForSession 済み = 本人確認済み。

import { getServiceRoleSupabase } from "@/lib/supabase/server";

const MAX_OAUTH_AVATAR_BYTES = 1 * 1024 * 1024; // 1MB
// public."User".username の制約に合わせる(backend の users route の zod と同じ)。
const USERNAME_MAX = 20;
// 連番サフィックスでの再試行回数。これを超えたらランダムサフィックスへ。
const USERNAME_RETRY_MAX = 5;
// Postgres の unique 制約違反。
const UNIQUE_VIOLATION = "23505";

type SupabaseIdentity = {
  provider?: string | null;
  identity_data?: Record<string, unknown> | null;
};

export type OAuthUser = {
  id: string;
  email: string;
  user_metadata?: Record<string, unknown> | null;
  identities?: SupabaseIdentity[] | null;
};

const getStringFromRecord = (
  record: Record<string, unknown> | null | undefined,
  key: string,
): string | null => {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
};

// OAuth プロバイダのアバター URL を採用してよいか判定する(AikiNote 準拠)。
// HEAD でサイズを確認し、1MB を超える/取得できない場合は null を返す。
export async function pickOAuthAvatarUrl(
  user: OAuthUser | null | undefined,
): Promise<string | null> {
  if (!user) {
    return null;
  }

  // Apple は通常プロフィール画像を提供しない。
  const isAppleOnly =
    user.identities?.every((i) => i.provider === "apple") ?? false;
  if (isAppleOnly && !user.user_metadata?.avatar_url) {
    return null;
  }

  const fromMetadata =
    getStringFromRecord(user.user_metadata, "avatar_url") ??
    getStringFromRecord(user.user_metadata, "picture") ??
    null;

  const oauthIdentity = user.identities?.find(
    (identity) =>
      identity.provider !== "apple" && identity.identity_data?.avatar_url,
  );
  const fromIdentity =
    getStringFromRecord(oauthIdentity?.identity_data, "avatar_url") ??
    getStringFromRecord(oauthIdentity?.identity_data, "picture") ??
    null;

  const candidate = fromMetadata ?? fromIdentity;
  if (!candidate) {
    return null;
  }

  try {
    const headResponse = await fetch(candidate, { method: "HEAD" });
    if (!headResponse.ok) {
      return null;
    }
    const contentLength = headResponse.headers.get("content-length");
    if (!contentLength) {
      return null;
    }
    const size = Number(contentLength);
    if (!Number.isFinite(size) || size <= 0 || size > MAX_OAUTH_AVATAR_BYTES) {
      return null;
    }
    return candidate;
  } catch (error) {
    console.error("OAuth アバターのサイズ確認に失敗", error);
    return null;
  }
}

// email のローカル部から username の基底を作る。使える文字は英数字・ハイフン・アンダースコア
// (backend の users route の zod と同じ)。空になったら "user" にフォールバックする。
export const buildBaseUsername = (email: string): string => {
  const localPart = email.split("@")[0] ?? "";
  const sanitized = localPart.replace(/[^a-zA-Z0-9_-]/g, "");
  const base = sanitized.length > 0 ? sanitized : "user";
  return base.slice(0, USERNAME_MAX);
};

// サフィックスを付けても USERNAME_MAX に収まるよう基底を切り詰める。
const withSuffix = (base: string, suffix: string): string =>
  `${base.slice(0, USERNAME_MAX - suffix.length)}${suffix}`;

/**
 * OAuth ユーザーの public."User" 行が無ければ作成する。既存なら何もしない。
 * username が衝突した場合は連番→ランダムの順に自動リトライする。
 * 失敗しても例外は投げない(ログインの成立を優先し、ログに残す)。
 */
export async function ensureOAuthUser(user: OAuthUser): Promise<void> {
  try {
    const supabase = getServiceRoleSupabase();

    const { data: existingUser, error: selectError } = await supabase
      .from("User")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (selectError) {
      console.error("User 行の存在確認に失敗", selectError);
      return;
    }
    if (existingUser) {
      return;
    }

    const base = buildBaseUsername(user.email);
    const profileImageUrl = await pickOAuthAvatarUrl(user);

    // 連番サフィックスで再試行 → 最後にランダムサフィックスを 1 回だけ試す。
    const candidates = [
      base,
      ...Array.from({ length: USERNAME_RETRY_MAX }, (_, i) =>
        withSuffix(base, String(i + 2)),
      ),
      withSuffix(base, `-${Math.random().toString(36).slice(2, 8)}`),
    ];

    for (const username of candidates) {
      const { error: insertError } = await supabase.from("User").insert({
        id: user.id,
        email: user.email,
        username,
        profile_image_url: profileImageUrl,
      });

      if (!insertError) {
        return;
      }
      // username の衝突以外(権限・接続など)は再試行しても同じなので即座に諦める。
      if (insertError.code !== UNIQUE_VIOLATION) {
        console.error("User 行の作成に失敗", insertError);
        return;
      }
    }

    console.error("username が全候補で衝突したため User 行を作成できなかった", {
      userId: user.id,
    });
  } catch (error) {
    console.error("User 行の作成処理で予期しない例外", error);
  }
}
