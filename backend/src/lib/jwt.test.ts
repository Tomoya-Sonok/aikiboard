import { sign } from "hono/jwt";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetJwksCache,
  extractTokenFromHeader,
  verifySupabaseToken,
} from "./jwt.js";

const SECRET = "test-secret-token-with-at-least-32-characters";

// base64url(パディング無し)
function b64url(input: Uint8Array | string): string {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  let bin = "";
  for (const b of bytes) {
    bin += String.fromCharCode(b);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// hono の sign は kid を付与しないため、JWKS 検証用に kid 付き ES256 トークンを手で作る。
async function makeEs256Token(
  payload: Record<string, unknown>,
  privateKey: CryptoKey,
  kid: string,
): Promise<string> {
  const header = { alg: "ES256", kid, typ: "JWT" };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(
    JSON.stringify(payload),
  )}`;
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${b64url(new Uint8Array(sig))}`;
}

afterEach(() => {
  vi.unstubAllGlobals();
  __resetJwksCache();
});

describe("extractTokenFromHeader", () => {
  it("Bearer ヘッダから token を取り出す", () => {
    expect(extractTokenFromHeader("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("ヘッダが無いと throw する", () => {
    expect(() => extractTokenFromHeader(undefined)).toThrow(
      "Authorization header missing",
    );
  });

  it("Bearer 形式でないと throw する", () => {
    expect(() => extractTokenFromHeader("Token abc.def.ghi")).toThrow(
      "Invalid authorization format",
    );
  });
});

describe("verifySupabaseToken — HS256(legacy フォールバック)", () => {
  it("正しい secret で署名された HS256 token を検証する", async () => {
    // Arrange
    const token = await sign(
      { sub: "user-1", email: "taro@example.com" },
      SECRET,
    );

    // Act
    const payload = await verifySupabaseToken(token, { hs256Secret: SECRET });

    // Assert
    expect(payload.sub).toBe("user-1");
    expect(payload.email).toBe("taro@example.com");
  });

  it("secret が異なると throw する", async () => {
    // Arrange
    const token = await sign({ sub: "user-1" }, SECRET);

    // Act & Assert
    await expect(
      verifySupabaseToken(token, { hs256Secret: "wrong-secret" }),
    ).rejects.toThrow();
  });

  it("HS256 token で secret 未設定なら throw する", async () => {
    // Arrange
    const token = await sign({ sub: "user-1" }, SECRET);

    // Act & Assert
    await expect(verifySupabaseToken(token, {})).rejects.toThrow(
      "HS256 secret is not configured",
    );
  });
});

describe("verifySupabaseToken — ES256(JWKS 本線)", () => {
  it("ES256 token を Supabase の JWKS で検証する", async () => {
    // Arrange: EC 鍵を生成し、公開鍵を JWKS として返す fetch をモック
    const { publicKey, privateKey } = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    );
    const exported = await crypto.subtle.exportKey("jwk", publicKey);
    const kid = "test-kid-1";
    const jwk = { ...exported, kid, alg: "ES256", use: "sig" };
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ keys: [jwk] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const token = await makeEs256Token(
      { sub: "user-es", exp: Math.floor(Date.now() / 1000) + 3600 },
      privateKey,
      kid,
    );

    // Act
    const payload = await verifySupabaseToken(token, {
      supabaseUrl: "http://127.0.0.1:54321",
    });

    // Assert
    expect(payload.sub).toBe("user-es");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("ES256 token で SUPABASE_URL 未設定なら throw する", async () => {
    // Arrange: 検証まで到達させず alg 分岐だけ確認する(署名は適当でよい)
    const header = b64url(
      JSON.stringify({ alg: "ES256", kid: "x", typ: "JWT" }),
    );
    const body = b64url(JSON.stringify({ sub: "user-es" }));
    const token = `${header}.${body}.AAAA`;

    // Act & Assert
    await expect(verifySupabaseToken(token, {})).rejects.toThrow(
      "SUPABASE_URL is not configured",
    );
  });
});
