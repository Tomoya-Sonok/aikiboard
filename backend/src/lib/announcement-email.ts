// お知らせ公開時のメール一斉送信(要件 4.2「メールでも通知する」)。
//
// AikiNote backend(lib/report-notification.ts)と同じく Resend SDK は使わず、
// Cloudflare Workers と相性の良い fetch で REST API を直接叩く。宛先のメールアドレスが
// 受信者間で相互に見えないよう、全員を 1 つの to に並べず Resend の batch API
// (1 リクエスト最大 100 通)で 1 人 1 通として送る。
//
// 本文(ProseMirror/Tiptap JSON)→ メール HTML は richtext.ts の自前シリアライザを使う
// (@tiptap/html の Workers 互換が不確実なため。対応ノードが少ないので自前で十分)。
//
// fire-and-forget 前提: 例外・HTTP 失敗はログのみで握りつぶし、公開処理自体は失敗させない。

import { logger } from "./logger.js";
import { escapeHtml, renderEmailHtml } from "./richtext.js";

const RESEND_BATCH_ENDPOINT = "https://api.resend.com/emails/batch";
// Resend batch API の 1 リクエストあたり上限。
const BATCH_SIZE = 100;

export interface AnnouncementEmailEnv {
  resendApiKey: string | undefined;
  resendFromEmail: string | undefined;
}

export interface AnnouncementEmailContent {
  boardName: string;
  slug: string;
  title: string;
  bodyRich: unknown;
  // お知らせ一覧への導線に使うアプリのベース URL(末尾スラッシュなし)。
  appUrl: string;
  // 宛先メールアドレス(重複・空は呼び出し側で除去済みを想定)。
  recipients: string[];
}

type ResendMessage = {
  from: string;
  to: string[];
  subject: string;
  html: string;
};

const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
};

// 本文 HTML を 600px 幅のメール枠 +「AikiBoard で見る」ボタンで包む。
export const buildEmailHtml = (content: AnnouncementEmailContent): string => {
  const body = renderEmailHtml(content.bodyRich);
  const link = `${content.appUrl.replace(/\/+$/, "")}/d/${encodeURIComponent(
    content.slug,
  )}/announce`;
  return `
    <div style="font-family: 'Hiragino Sans', 'Noto Sans JP', sans-serif; max-width: 600px; margin: 0 auto; color: #2c2c2c;">
      <p style="font-size: 13px; color: #8a8a8a; margin: 0 0 8px;">${escapeHtml(content.boardName)}</p>
      <h1 style="font-size: 20px; margin: 0 0 16px;">${escapeHtml(content.title)}</h1>
      <div style="font-size: 15px; line-height: 1.8;">${body}</div>
      <p style="margin: 32px 0 0;">
        <a href="${escapeHtml(link)}" style="display: inline-block; background: #c4956a; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 4px; font-size: 14px;">AikiBoard で見る</a>
      </p>
    </div>
  `;
};

// 宛先ごとに 1 通の Resend メッセージ配列を作る(件名・本文は共通)。
export const buildBatchPayload = (
  content: AnnouncementEmailContent,
  fromEmail: string,
): ResendMessage[] => {
  const subject = `【${content.boardName}】${content.title}`;
  const html = buildEmailHtml(content);
  return content.recipients.map((to) => ({
    from: fromEmail,
    to: [to],
    subject,
    html,
  }));
};

// お知らせを宛先全員へメール送信する。RESEND_API_KEY 未設定や宛先 0 件なら何もしない。
export async function sendAnnouncementEmails(
  content: AnnouncementEmailContent,
  env: AnnouncementEmailEnv,
): Promise<void> {
  if (!env.resendApiKey) {
    logger.warn("RESEND_API_KEY 未設定のためお知らせメールをスキップ", {
      feature: "announcements",
    });
    return;
  }
  if (content.recipients.length === 0) {
    return;
  }

  const fromEmail = env.resendFromEmail || "noreply@aiki-board.com";
  const messages = buildBatchPayload(content, fromEmail);

  for (const batch of chunk(messages, BATCH_SIZE)) {
    try {
      const response = await fetch(RESEND_BATCH_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        logger.error("お知らせメールの送信に失敗(Resend)", {
          feature: "announcements",
          status: response.status,
          detail: text.slice(0, 500),
          recipients: batch.length,
        });
      }
    } catch (error) {
      logger.error("お知らせメールの送信で例外", {
        feature: "announcements",
        error: error instanceof Error ? error.message : String(error),
        recipients: batch.length,
      });
    }
  }
}
