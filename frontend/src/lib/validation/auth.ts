// 認証フォームの Zod スキーマ。i18n メッセージを使うため翻訳関数を受け取る factory にする。

import { z } from "zod";

type Translate = (key: string) => string;

// パスワード強度: 8〜128 文字、かつ 大文字 / 小文字 / 数字 / 記号 のうち 3 種以上。
export function isStrongPassword(password: string): boolean {
  if (password.length < 8 || password.length > 128) {
    return false;
  }
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  return [hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length >= 3;
}

export type LoginFormValues = { email: string; password: string };
export type EmailPasswordValues = { email: string; password: string };
export type UsernameValues = { username: string };

export function createLoginSchema(t: Translate) {
  return z.object({
    email: z.email(t("validation.emailInvalid")),
    password: z.string().min(1, t("validation.required")),
  });
}

export function createEmailPasswordSchema(t: Translate) {
  return z.object({
    email: z.email(t("validation.emailInvalid")),
    password: z
      .string()
      .min(8, t("validation.passwordMin"))
      .max(128, t("validation.passwordMax"))
      .refine(isStrongPassword, t("validation.passwordComplexity")),
  });
}

export function createUsernameSchema(t: Translate) {
  return z.object({
    username: z
      .string()
      .min(1, t("validation.usernameRequired"))
      .max(20, t("validation.usernameMax"))
      .regex(/^[a-zA-Z0-9_-]+$/, t("validation.usernameFormat")),
  });
}
