import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "./logger.js";

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("info は console.log に構造化 JSON を出力し、context をマージする", () => {
    // Arrange
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Act
    logger.info("ボードを作成した", {
      boardId: "b1",
      userId: "u1",
      feature: "boards",
    });

    // Assert
    expect(spy).toHaveBeenCalledOnce();
    const payload = JSON.parse(spy.mock.calls[0][0] as string);
    expect(payload).toMatchObject({
      level: "info",
      message: "ボードを作成した",
      boardId: "b1",
      userId: "u1",
      feature: "boards",
    });
    expect(typeof payload.timestamp).toBe("string");
    // ISO8601 としてパースできること
    expect(Number.isNaN(Date.parse(payload.timestamp))).toBe(false);
  });

  it("error は console.error に出力する", () => {
    // Arrange
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Act
    logger.error("ボード作成に失敗", { feature: "boards" });

    // Assert
    expect(spy).toHaveBeenCalledOnce();
    const payload = JSON.parse(spy.mock.calls[0][0] as string);
    expect(payload.level).toBe("error");
    expect(payload.message).toBe("ボード作成に失敗");
    expect(payload.feature).toBe("boards");
  });

  it("warn は console.warn に出力する", () => {
    // Arrange
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Act
    logger.warn("レート制限に接近");

    // Assert
    expect(spy).toHaveBeenCalledOnce();
    expect(JSON.parse(spy.mock.calls[0][0] as string).level).toBe("warn");
  });

  it("context なしでも timestamp / level / message を出力する", () => {
    // Arrange
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Act
    logger.debug("デバッグログ");

    // Assert
    const payload = JSON.parse(spy.mock.calls[0][0] as string);
    expect(payload.level).toBe("debug");
    expect(payload.message).toBe("デバッグログ");
    expect(payload.timestamp).toBeDefined();
  });
});
