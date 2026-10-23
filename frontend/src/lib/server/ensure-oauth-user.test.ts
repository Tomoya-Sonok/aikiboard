import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildBaseUsername,
  ensureOAuthUser,
  pickOAuthAvatarUrl,
} from "./ensure-oauth-user";

const selectMaybeSingle = vi.fn();
const insertFn = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getServiceRoleSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => selectMaybeSingle() }),
      }),
      insert: (row: unknown) => insertFn(row),
    }),
  }),
}));

const USER = {
  id: "auth-user-1",
  email: "tomoya@example.com",
  user_metadata: {},
  identities: [],
};

describe("buildBaseUsername", () => {
  it("email のローカル部を使う", () => {
    expect(buildBaseUsername("tomoya@example.com")).toBe("tomoya");
  });

  it("使えない文字を除去する", () => {
    expect(buildBaseUsername("tomoya.sonok+tag@example.com")).toBe(
      "tomoyasonoktag",
    );
  });

  it("20文字に収める", () => {
    expect(
      buildBaseUsername("abcdefghijklmnopqrstuvwxyz@example.com").length,
    ).toBe(20);
  });

  it("使える文字が無ければ user にフォールバックする", () => {
    expect(buildBaseUsername("...@example.com")).toBe("user");
  });
});

describe("ensureOAuthUser", () => {
  beforeEach(() => {
    selectMaybeSingle.mockReset();
    insertFn.mockReset();
  });

  it("既存の User 行があれば INSERT しない", async () => {
    // Arrange
    selectMaybeSingle.mockResolvedValue({
      data: { id: USER.id },
      error: null,
    });

    // Act
    await ensureOAuthUser(USER);

    // Assert
    expect(insertFn).not.toHaveBeenCalled();
  });

  it("行が無ければ id/email/username/profile_image_url の4列で作成する", async () => {
    // Arrange
    selectMaybeSingle.mockResolvedValue({ data: null, error: null });
    insertFn.mockResolvedValue({ error: null });

    // Act
    await ensureOAuthUser(USER);

    // Assert
    expect(insertFn).toHaveBeenCalledTimes(1);
    expect(insertFn).toHaveBeenCalledWith({
      id: USER.id,
      email: USER.email,
      username: "tomoya",
      profile_image_url: null,
    });
  });

  it("username が衝突したら連番を付けてリトライする", async () => {
    // Arrange
    selectMaybeSingle.mockResolvedValue({ data: null, error: null });
    insertFn
      .mockResolvedValueOnce({ error: { code: "23505" } })
      .mockResolvedValueOnce({ error: { code: "23505" } })
      .mockResolvedValueOnce({ error: null });

    // Act
    await ensureOAuthUser(USER);

    // Assert
    expect(insertFn).toHaveBeenCalledTimes(3);
    expect(insertFn).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ username: "tomoya2" }),
    );
    expect(insertFn).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ username: "tomoya3" }),
    );
  });

  it("衝突以外のエラーではリトライしない", async () => {
    // Arrange
    selectMaybeSingle.mockResolvedValue({ data: null, error: null });
    insertFn.mockResolvedValue({ error: { code: "42501" } }); // 権限エラー

    // Act
    await ensureOAuthUser(USER);

    // Assert
    expect(insertFn).toHaveBeenCalledTimes(1);
  });

  it("存在確認でエラーが出たら INSERT しない", async () => {
    // Arrange
    selectMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });

    // Act
    await ensureOAuthUser(USER);

    // Assert
    expect(insertFn).not.toHaveBeenCalled();
  });
});

describe("pickOAuthAvatarUrl", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1MB 以下のアバターは採用する", async () => {
    // Arrange
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        headers: { get: () => "1024" },
      })),
    );

    // Act
    const url = await pickOAuthAvatarUrl({
      ...USER,
      user_metadata: { avatar_url: "https://example.com/a.png" },
    });

    // Assert
    expect(url).toBe("https://example.com/a.png");
  });

  it("1MB を超えるアバターは採用しない", async () => {
    // Arrange
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        headers: { get: () => String(2 * 1024 * 1024) },
      })),
    );

    // Act
    const url = await pickOAuthAvatarUrl({
      ...USER,
      user_metadata: { avatar_url: "https://example.com/big.png" },
    });

    // Assert
    expect(url).toBeNull();
  });

  it("アバターが無ければ null", async () => {
    // Act
    const url = await pickOAuthAvatarUrl(USER);

    // Assert
    expect(url).toBeNull();
  });
});
