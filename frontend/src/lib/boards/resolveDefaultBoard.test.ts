import { describe, expect, it } from "vitest";
import { resolveDefaultBoardSlug } from "./resolveDefaultBoard";

describe("resolveDefaultBoardSlug", () => {
  const boards = [{ slug: "warabi" }, { slug: "yoshinkan" }];

  it("所属ボードが無ければ null を返す", () => {
    // Arrange / Act
    const result = resolveDefaultBoardSlug([], "warabi");

    // Assert
    expect(result).toBeNull();
  });

  it("最後に開いたボードが一覧にあればそれを返す", () => {
    // Arrange / Act
    const result = resolveDefaultBoardSlug(boards, "yoshinkan");

    // Assert
    expect(result).toBe("yoshinkan");
  });

  it("最後に開いたボードが一覧に無ければ先頭を返す(stale cookie 対策)", () => {
    // Arrange / Act
    const result = resolveDefaultBoardSlug(boards, "deleted-board");

    // Assert
    expect(result).toBe("warabi");
  });

  it("cookie が無ければ先頭を返す", () => {
    // Arrange / Act
    const result = resolveDefaultBoardSlug(boards, undefined);

    // Assert
    expect(result).toBe("warabi");
  });
});
