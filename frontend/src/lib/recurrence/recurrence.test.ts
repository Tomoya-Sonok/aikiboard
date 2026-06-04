import { describe, expect, it } from "vitest";
import {
  buildRecurrence,
  defaultRecurrenceForm,
  describeRecurrence,
  parseRecurrenceToForm,
  type RecurrenceFormValue,
} from "./recurrence";

const form = (over: Partial<RecurrenceFormValue>): RecurrenceFormValue => ({
  ...defaultRecurrenceForm(),
  ...over,
});

describe("buildRecurrence", () => {
  it("freq=NONE は null", () => {
    // Arrange / Act / Assert
    expect(buildRecurrence(form({ freq: "NONE" }))).toBeNull();
  });

  it("毎週 + 曜日 + interval を RecurrenceInput にする", () => {
    // Arrange
    const value = form({
      freq: "WEEKLY",
      interval: 2,
      byweekday: ["WE", "MO"],
    });

    // Act
    const rule = buildRecurrence(value);

    // Assert(曜日は日始まり順に正規化)
    expect(rule).toEqual({
      freq: "WEEKLY",
      interval: 2,
      byweekday: ["MO", "WE"],
    });
  });

  it("endMode=count は count を載せる", () => {
    // Arrange / Act
    const rule = buildRecurrence(
      form({ freq: "DAILY", endMode: "count", count: 5 }),
    );

    // Assert
    expect(rule).toMatchObject({ freq: "DAILY", count: 5 });
  });

  it("endMode=until は until を ISO instant にする(その日の終わり JST)", () => {
    // Arrange / Act
    const rule = buildRecurrence(
      form({
        freq: "WEEKLY",
        byweekday: ["MO"],
        endMode: "until",
        until: "2026-07-31",
      }),
    );

    // Assert(2026-07-31 23:59:59 JST = 14:59:59Z)
    expect(rule?.until).toBe("2026-07-31T14:59:59.000Z");
  });
});

describe("parseRecurrenceToForm", () => {
  it("null はデフォルト(NONE)", () => {
    // Arrange / Act / Assert
    expect(parseRecurrenceToForm(null)).toEqual(defaultRecurrenceForm());
  });

  it("WEEKLY + BYDAY を往復できる", () => {
    // Arrange / Act
    const value = parseRecurrenceToForm("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE");

    // Assert
    expect(value).toMatchObject({
      freq: "WEEKLY",
      interval: 2,
      byweekday: ["MO", "WE"],
      endMode: "never",
    });
  });

  it("COUNT は endMode=count", () => {
    // Arrange / Act
    const value = parseRecurrenceToForm("FREQ=DAILY;COUNT=3");

    // Assert
    expect(value).toMatchObject({ freq: "DAILY", endMode: "count", count: 3 });
  });

  it("UNTIL(compact)は endMode=until + JST 日付", () => {
    // Arrange / Act
    const value = parseRecurrenceToForm(
      "FREQ=WEEKLY;BYDAY=MO;UNTIL=20260731T145959Z",
    );

    // Assert(14:59:59Z = 23:59:59 JST → 2026-07-31)
    expect(value).toMatchObject({ endMode: "until", until: "2026-07-31" });
  });
});

describe("describeRecurrence", () => {
  const t = (key: string, vals?: Record<string, string | number>) =>
    vals ? `${key}(${JSON.stringify(vals)})` : key;

  it("空ルールは空文字", () => {
    expect(describeRecurrence(null, t)).toBe("");
  });

  it("毎週は recur.weekly + 曜日ラベルを使う", () => {
    const text = describeRecurrence("FREQ=WEEKLY;BYDAY=MO,WE", t);
    expect(text).toContain("recur.weekly");
    expect(text).toContain("weekdayShort.MO");
    expect(text).toContain("weekdayShort.WE");
  });
});
