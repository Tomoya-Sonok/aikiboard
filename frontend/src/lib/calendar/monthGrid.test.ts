import { describe, expect, it } from "vitest";
import {
  currentJstYearMonth,
  getMonthGrid,
  gridWindow,
  isoToJstDateTime,
  jstDateKey,
  jstDateTimeToIso,
  shiftMonth,
} from "./monthGrid";

// 適当な「今」(JST 2026-06-10 19:00)。
const NOW = Date.parse("2026-06-10T10:00:00.000Z");

describe("getMonthGrid", () => {
  it("42 セルで、日曜始まり・前月末を含む", () => {
    // Arrange / Act(2026 年 6 月。6/1 は月曜なので前の日曜 5/31 から始まる)
    const cells = getMonthGrid(2026, 5, NOW);

    // Assert
    expect(cells).toHaveLength(42);
    expect(cells[0].year).toBe(2026);
    expect(cells[0].month).toBe(4); // 5月
    expect(cells[0].day).toBe(31);
    expect(cells[0].inCurrentMonth).toBe(false);
    // 6/1 は 2 セル目
    expect(cells[1]).toMatchObject({ month: 5, day: 1, inCurrentMonth: true });
  });

  it("今日フラグを JST で立てる", () => {
    // Arrange / Act
    const cells = getMonthGrid(2026, 5, NOW);
    const today = cells.find((c) => c.isToday);

    // Assert
    expect(today).toMatchObject({ year: 2026, month: 5, day: 10 });
  });
});

describe("gridWindow", () => {
  it("先頭セル 00:00 JST 〜 末尾セル翌日 00:00 JST", () => {
    // Arrange
    const cells = getMonthGrid(2026, 5, NOW);

    // Act
    const { from, to } = gridWindow(cells);

    // Assert(5/31 00:00 JST = 5/30 15:00Z)
    expect(from).toBe("2026-05-30T15:00:00.000Z");
    expect(Date.parse(to)).toBeGreaterThan(Date.parse(from));
  });
});

describe("jstDateKey", () => {
  it("instant を JST 日付に割り当てる", () => {
    // 2026-06-01T10:00Z = JST 6/1 19:00
    expect(jstDateKey("2026-06-01T10:00:00.000Z")).toBe("2026-06-01");
    // 2026-06-01T16:00Z = JST 6/2 01:00 → 翌日扱い
    expect(jstDateKey("2026-06-01T16:00:00.000Z")).toBe("2026-06-02");
  });
});

describe("shiftMonth", () => {
  it("年跨ぎを正しく扱う", () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });
});

describe("currentJstYearMonth", () => {
  it("JST の年月を返す", () => {
    expect(currentJstYearMonth(NOW)).toEqual({ year: 2026, month: 5 });
  });
});

describe("jstDateTimeToIso / isoToJstDateTime", () => {
  it("JST 壁時計 ⇄ instant を往復できる", () => {
    // Arrange / Act
    const iso = jstDateTimeToIso("2026-06-01", "19:00");

    // Assert
    expect(iso).toBe("2026-06-01T10:00:00.000Z");
    expect(isoToJstDateTime("2026-06-01T10:00:00.000Z")).toEqual({
      date: "2026-06-01",
      time: "19:00",
    });
  });
});
