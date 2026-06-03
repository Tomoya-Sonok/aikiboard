import { describe, expect, it } from "vitest";
import {
  createEmailPasswordSchema,
  createLoginSchema,
  createUsernameSchema,
  isStrongPassword,
} from "./auth";

// テスト用の翻訳関数(キーをそのまま返す)
const t = (key: string) => key;

describe("isStrongPassword", () => {
  it("8文字以上かつ3種類以上を含むと true", () => {
    expect(isStrongPassword("Passw0rd")).toBe(true);
  });

  it("8文字未満は false", () => {
    expect(isStrongPassword("Pa0")).toBe(false);
  });

  it("文字種が2種類以下は false", () => {
    expect(isStrongPassword("password")).toBe(false);
  });
});

describe("createEmailPasswordSchema", () => {
  const schema = createEmailPasswordSchema(t);

  it("正しい email + 強いパスワードを通す", () => {
    expect(
      schema.safeParse({ email: "taro@example.com", password: "Passw0rd!" })
        .success,
    ).toBe(true);
  });

  it("不正な email を弾く", () => {
    expect(
      schema.safeParse({ email: "bad", password: "Passw0rd!" }).success,
    ).toBe(false);
  });

  it("弱いパスワードを弾く", () => {
    expect(
      schema.safeParse({ email: "taro@example.com", password: "weak" }).success,
    ).toBe(false);
  });
});

describe("createUsernameSchema", () => {
  const schema = createUsernameSchema(t);

  it("英数字・ハイフン・アンダースコアを通す", () => {
    expect(schema.safeParse({ username: "taro_123" }).success).toBe(true);
  });

  it("記号を含むと弾く", () => {
    expect(schema.safeParse({ username: "taro!" }).success).toBe(false);
  });

  it("空文字を弾く", () => {
    expect(schema.safeParse({ username: "" }).success).toBe(false);
  });
});

describe("createLoginSchema", () => {
  const schema = createLoginSchema(t);

  it("email と任意のパスワードを通す", () => {
    expect(
      schema.safeParse({ email: "taro@example.com", password: "x" }).success,
    ).toBe(true);
  });

  it("空パスワードを弾く", () => {
    expect(
      schema.safeParse({ email: "taro@example.com", password: "" }).success,
    ).toBe(false);
  });
});
