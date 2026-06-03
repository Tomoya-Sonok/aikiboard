// Supabase access_token の検証ユーティリティ。
// ADR 0002 B-5(追補): Supabase は新しい JWT signing keys(非対称 ES256 / JWKS)が
// 既定。従来想定の HS256 + SUPABASE_JWT_SECRET だけでは検証できないため、
// トークンの alg で分岐する:
//   - 非対称(ES256 等) → Supabase の JWKS で検証(本線)
//   - HS256            → SUPABASE_JWT_SECRET で検証(legacy 互換のフォールバック)
// 自前 JWT 生成(generateToken)は持たない。

import { decode, verify, verifyWithJwks } from "hono/jwt";

// Supabase access_token の payload(必要分のみ)。
// sub = auth.users.id = public."User".id。
export interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

type VerifyOptions = {
  supabaseUrl?: string;
  hs256Secret?: string;
};

// `Authorization: Bearer <token>` から token を取り出す。
export function extractTokenFromHeader(authHeader: string | undefined): string {
  if (!authHeader) {
    throw new Error("Authorization header missing");
  }
  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Invalid authorization format");
  }
  return authHeader.slice("Bearer ".length);
}

// --- JWKS キャッシュ(Workers でリクエストごとの fetch を避ける) ---

type JwkKey = JsonWebKey & { kid?: string };

let jwksCache: { keys: JwkKey[]; fetchedAt: number } | null = null;
const JWKS_TTL_MS = 10 * 60 * 1000; // 10 分

async function fetchJwks(jwksUri: string): Promise<JwkKey[]> {
  const res = await fetch(jwksUri);
  if (!res.ok) {
    throw new Error(`failed to fetch JWKS (${res.status})`);
  }
  const body = (await res.json()) as { keys?: JwkKey[] };
  if (!Array.isArray(body.keys)) {
    throw new Error("invalid JWKS response");
  }
  return body.keys;
}

async function getJwksKeys(
  jwksUri: string,
  forceRefresh: boolean,
): Promise<JwkKey[]> {
  const now = Date.now();
  if (!forceRefresh && jwksCache && now - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }
  const keys = await fetchJwks(jwksUri);
  jwksCache = { keys, fetchedAt: now };
  return keys;
}

// テスト用に JWKS キャッシュをリセットする。
export function __resetJwksCache(): void {
  jwksCache = null;
}

// Supabase access_token を検証して payload を返す。不正・期限切れは throw。
export async function verifySupabaseToken(
  token: string,
  options: VerifyOptions,
): Promise<SupabaseJwtPayload> {
  const header = decode(token).header as { alg?: string; kid?: string };
  const alg = String(header.alg ?? "");

  // HS256(legacy)はフォールバックで secret 検証
  if (alg.startsWith("HS")) {
    if (!options.hs256Secret) {
      throw new Error("HS256 secret is not configured");
    }
    return (await verify(
      token,
      options.hs256Secret,
      "HS256",
    )) as unknown as SupabaseJwtPayload;
  }

  // 非対称(ES256 等)は JWKS で検証(本線)
  if (!options.supabaseUrl) {
    throw new Error("SUPABASE_URL is not configured for JWKS verification");
  }
  const jwksUri = `${options.supabaseUrl.replace(/\/+$/, "")}/auth/v1/.well-known/jwks.json`;

  let keys = await getJwksKeys(jwksUri, false);
  // kid が手元の鍵に無い場合は鍵ローテーションの可能性があるので 1 度だけ再取得する
  if (header.kid && !keys.some((k) => k.kid === header.kid)) {
    keys = await getJwksKeys(jwksUri, true);
  }

  return (await verifyWithJwks(token, {
    keys,
    allowedAlgorithms: ["ES256", "RS256"],
  })) as unknown as SupabaseJwtPayload;
}
