import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AnnouncementEmailContent,
  buildBatchPayload,
  buildEmailHtml,
  sendAnnouncementEmails,
} from "./announcement-email.js";

const baseContent = (
  overrides?: Partial<AnnouncementEmailContent>,
): AnnouncementEmailContent => ({
  boardName: "蕨合気道会",
  slug: "warabi-aikido",
  title: "審査のご案内",
  bodyRich: {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "本文です" }] },
    ],
  },
  appUrl: "https://aiki-board.com",
  recipients: ["a@example.com", "b@example.com"],
  ...overrides,
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("buildEmailHtml", () => {
  it("件名枠・本文・お知らせ画面へのリンクを含む", () => {
    // Arrange / Act
    const html = buildEmailHtml(baseContent());

    // Assert
    expect(html).toContain("審査のご案内");
    expect(html).toContain("本文です");
    expect(html).toContain("https://aiki-board.com/d/warabi-aikido/announce");
    expect(html).toContain("AikiBoard で見る");
  });
});

describe("buildBatchPayload", () => {
  it("宛先ごとに 1 通(to に 1 アドレスのみ)を作る", () => {
    // Arrange / Act
    const messages = buildBatchPayload(baseContent(), "noreply@aiki-board.com");

    // Assert
    expect(messages).toHaveLength(2);
    expect(messages[0].to).toEqual(["a@example.com"]);
    expect(messages[1].to).toEqual(["b@example.com"]);
    expect(messages[0].subject).toBe("【蕨合気道会】審査のご案内");
  });
});

describe("sendAnnouncementEmails", () => {
  it("RESEND_API_KEY 未設定なら fetch せずスキップする", async () => {
    // Arrange
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    // Act
    await sendAnnouncementEmails(baseContent(), {
      resendApiKey: undefined,
      resendFromEmail: "noreply@aiki-board.com",
    });

    // Assert
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("宛先が 0 件なら fetch しない", async () => {
    // Arrange
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    // Act
    await sendAnnouncementEmails(baseContent({ recipients: [] }), {
      resendApiKey: "re_test",
      resendFromEmail: "noreply@aiki-board.com",
    });

    // Assert
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Resend batch エンドポイントへ宛先分のメッセージを POST する", async () => {
    // Arrange
    const fetchMock = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response("{}", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    // Act
    await sendAnnouncementEmails(baseContent(), {
      resendApiKey: "re_test",
      resendFromEmail: "noreply@aiki-board.com",
    });

    // Assert
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails/batch");
    const body = JSON.parse(init.body as string);
    expect(body).toHaveLength(2);
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer re_test",
    );
  });

  it("100 件超は 100 件ごとに分割して送る", async () => {
    // Arrange
    const fetchMock = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response("{}", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const recipients = Array.from(
      { length: 150 },
      (_, i) => `user${i}@example.com`,
    );

    // Act
    await sendAnnouncementEmails(baseContent({ recipients }), {
      resendApiKey: "re_test",
      resendFromEmail: "noreply@aiki-board.com",
    });

    // Assert(100 + 50 の 2 リクエスト)
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const second = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(first).toHaveLength(100);
    expect(second).toHaveLength(50);
  });

  it("HTTP 失敗でも例外を投げない(fire-and-forget)", async () => {
    // Arrange
    const fetchMock = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response("error", { status: 500 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    // Act / Assert(throw しないこと)
    await expect(
      sendAnnouncementEmails(baseContent(), {
        resendApiKey: "re_test",
        resendFromEmail: "noreply@aiki-board.com",
      }),
    ).resolves.toBeUndefined();
  });
});
