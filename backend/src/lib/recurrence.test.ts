import { describe, expect, it } from "vitest";
import {
  applyOverrides,
  expandEvent,
  type OccurrenceOverride,
  parseRule,
  type RawOccurrence,
  serializeRule,
} from "./recurrence.js";

// dtstart は JST 壁時計で意図を読みやすくするため +09:00 付き ISO を使う。
// 例: "2026-06-01T19:00:00+09:00"(JST 月曜 19:00)= UTC "2026-06-01T10:00:00.000Z"。
// 2026-06-01 は月曜(2026-01-01 は木曜)。

const utc = (y: number, mo: number, d: number, h = 0, mi = 0): string =>
  new Date(Date.UTC(y, mo - 1, d, h, mi, 0)).toISOString();

const starts = (occ: { occurrenceStart: string }[]): string[] =>
  occ.map((o) => o.occurrenceStart);

describe("parseRule / serializeRule", () => {
  it("WEEKLY + BYDAY + INTERVAL を往復できる", () => {
    // Arrange
    const text = "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR";

    // Act
    const rule = parseRule(text);

    // Assert
    expect(rule).toEqual({
      freq: "WEEKLY",
      interval: 2,
      byweekday: ["MO", "WE", "FR"],
    });
    if (!rule) {
      throw new Error("rule should not be null");
    }
    expect(serializeRule(rule)).toBe(text);
  });

  it("COUNT と UNTIL は COUNT を優先する", () => {
    // Arrange / Act
    const rule = parseRule("FREQ=DAILY;COUNT=5;UNTIL=20260601T000000Z");

    // Assert
    expect(rule?.count).toBe(5);
    expect(rule?.until).toBeUndefined();
  });

  it("サポート外の FREQ は null", () => {
    // Arrange / Act / Assert
    expect(parseRule("FREQ=YEARLY")).toBeNull();
    expect(parseRule("")).toBeNull();
    expect(parseRule(null)).toBeNull();
  });
});

describe("expandEvent - 単発", () => {
  it("窓内なら 1 件返す", () => {
    // Arrange
    const event = {
      startAt: utc(2026, 6, 1, 10),
      endAt: utc(2026, 6, 1, 12),
      recurrenceRule: null,
    };

    // Act
    const occ = expandEvent(event, utc(2026, 6, 1), utc(2026, 7, 1));

    // Assert
    expect(occ).toHaveLength(1);
    expect(occ[0].occurrenceStart).toBe(utc(2026, 6, 1, 10));
    expect(occ[0].occurrenceEnd).toBe(utc(2026, 6, 1, 12));
  });

  it("窓外なら 0 件", () => {
    // Arrange
    const event = {
      startAt: utc(2026, 5, 1, 10),
      endAt: utc(2026, 5, 1, 12),
      recurrenceRule: null,
    };

    // Act
    const occ = expandEvent(event, utc(2026, 6, 1), utc(2026, 7, 1));

    // Assert
    expect(occ).toHaveLength(0);
  });
});

describe("expandEvent - DAILY", () => {
  it("毎日: 1週間の窓で 7 件", () => {
    // Arrange
    const event = {
      startAt: utc(2026, 6, 1, 10),
      endAt: utc(2026, 6, 1, 11),
      recurrenceRule: "FREQ=DAILY",
    };

    // Act
    const occ = expandEvent(event, utc(2026, 6, 1), utc(2026, 6, 8));

    // Assert
    expect(occ).toHaveLength(7);
    expect(occ[0].occurrenceStart).toBe(utc(2026, 6, 1, 10));
    expect(occ[6].occurrenceStart).toBe(utc(2026, 6, 7, 10));
  });

  it("COUNT=3: dtstart から 3 件で打ち切る", () => {
    // Arrange
    const event = {
      startAt: utc(2026, 6, 1, 10),
      endAt: utc(2026, 6, 1, 11),
      recurrenceRule: "FREQ=DAILY;COUNT=3",
    };

    // Act
    const occ = expandEvent(event, utc(2026, 6, 1), utc(2026, 7, 1));

    // Assert
    expect(starts(occ)).toEqual([
      utc(2026, 6, 1, 10),
      utc(2026, 6, 2, 10),
      utc(2026, 6, 3, 10),
    ]);
  });

  it("COUNT は窓が後ろにずれても dtstart から数える", () => {
    // Arrange(窓は 6/2 開始。6/1 は count に数えるが結果には含めない)
    const event = {
      startAt: utc(2026, 6, 1, 10),
      endAt: utc(2026, 6, 1, 11),
      recurrenceRule: "FREQ=DAILY;COUNT=3",
    };

    // Act
    const occ = expandEvent(event, utc(2026, 6, 2), utc(2026, 7, 1));

    // Assert(6/2, 6/3 のみ。6/4 は count 超過)
    expect(starts(occ)).toEqual([utc(2026, 6, 2, 10), utc(2026, 6, 3, 10)]);
  });
});

describe("expandEvent - WEEKLY", () => {
  it("毎週 月水金: 6月で 13 件", () => {
    // Arrange
    const event = {
      startAt: utc(2026, 6, 1, 10), // JST 月曜 19:00
      endAt: utc(2026, 6, 1, 12),
      recurrenceRule: "FREQ=WEEKLY;BYDAY=MO,WE,FR",
    };

    // Act
    const occ = expandEvent(event, utc(2026, 6, 1), utc(2026, 7, 1));

    // Assert(月: 1,8,15,22,29 / 水: 3,10,17,24 / 金: 5,12,19,26)
    expect(occ).toHaveLength(13);
    expect(occ[0].occurrenceStart).toBe(utc(2026, 6, 1, 10));
    expect(occ[1].occurrenceStart).toBe(utc(2026, 6, 3, 10));
    expect(occ[2].occurrenceStart).toBe(utc(2026, 6, 5, 10));
  });

  it("隔週 月曜: 6月で 1,15,29 の 3 件", () => {
    // Arrange
    const event = {
      startAt: utc(2026, 6, 1, 10),
      endAt: utc(2026, 6, 1, 11),
      recurrenceRule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO",
    };

    // Act
    const occ = expandEvent(event, utc(2026, 6, 1), utc(2026, 7, 1));

    // Assert
    expect(starts(occ)).toEqual([
      utc(2026, 6, 1, 10),
      utc(2026, 6, 15, 10),
      utc(2026, 6, 29, 10),
    ]);
  });

  it("UNTIL: 上限日を超えたオカレンスは含めない", () => {
    // Arrange(6/10 00:00Z まで。6/10 のオカレンスは 10:00Z で上限超過)
    const event = {
      startAt: utc(2026, 6, 1, 10),
      endAt: utc(2026, 6, 1, 11),
      recurrenceRule: "FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20260610T000000Z",
    };

    // Act
    const occ = expandEvent(event, utc(2026, 6, 1), utc(2026, 7, 1));

    // Assert(6/1, 6/3, 6/5, 6/8)
    expect(starts(occ)).toEqual([
      utc(2026, 6, 1, 10),
      utc(2026, 6, 3, 10),
      utc(2026, 6, 5, 10),
      utc(2026, 6, 8, 10),
    ]);
  });

  it("BYDAY 省略時は dtstart の曜日を使う", () => {
    // Arrange(月曜 dtstart)
    const event = {
      startAt: utc(2026, 6, 1, 10),
      endAt: utc(2026, 6, 1, 11),
      recurrenceRule: "FREQ=WEEKLY",
    };

    // Act
    const occ = expandEvent(event, utc(2026, 6, 1), utc(2026, 7, 1));

    // Assert(毎週月曜: 1,8,15,22,29)
    expect(starts(occ)).toEqual([
      utc(2026, 6, 1, 10),
      utc(2026, 6, 8, 10),
      utc(2026, 6, 15, 10),
      utc(2026, 6, 22, 10),
      utc(2026, 6, 29, 10),
    ]);
  });
});

describe("expandEvent - MONTHLY", () => {
  it("毎月(dtstart の日): 6/15 開始で 6,7,8月の 15 日", () => {
    // Arrange
    const event = {
      startAt: utc(2026, 6, 15, 10),
      endAt: utc(2026, 6, 15, 11),
      recurrenceRule: "FREQ=MONTHLY",
    };

    // Act
    const occ = expandEvent(event, utc(2026, 6, 1), utc(2026, 9, 1));

    // Assert
    expect(starts(occ)).toEqual([
      utc(2026, 6, 15, 10),
      utc(2026, 7, 15, 10),
      utc(2026, 8, 15, 10),
    ]);
  });

  it("BYMONTHDAY=31: 31日が無い月はスキップ", () => {
    // Arrange(1/31 開始。2月・4月は 31 日が無い)
    const event = {
      startAt: utc(2026, 1, 31, 3),
      endAt: utc(2026, 1, 31, 4),
      recurrenceRule: "FREQ=MONTHLY;BYMONTHDAY=31",
    };

    // Act
    const occ = expandEvent(event, utc(2026, 1, 1), utc(2026, 5, 1));

    // Assert(1/31, 3/31 のみ)
    expect(starts(occ)).toEqual([utc(2026, 1, 31, 3), utc(2026, 3, 31, 3)]);
  });
});

describe("expandEvent - 窓の境界", () => {
  it("from と一致する開始は含む / to と一致する開始は含まない", () => {
    // Arrange
    const atFrom = {
      startAt: utc(2026, 6, 1),
      endAt: utc(2026, 6, 1, 1),
      recurrenceRule: null,
    };
    const atTo = {
      startAt: utc(2026, 6, 2),
      endAt: utc(2026, 6, 2, 1),
      recurrenceRule: null,
    };

    // Act
    const inWindow = expandEvent(atFrom, utc(2026, 6, 1), utc(2026, 6, 2));
    const outWindow = expandEvent(atTo, utc(2026, 6, 1), utc(2026, 6, 2));

    // Assert
    expect(inWindow).toHaveLength(1);
    expect(outWindow).toHaveLength(0);
  });
});

describe("applyOverrides", () => {
  const occ: RawOccurrence[] = [
    {
      occurrenceStart: utc(2026, 6, 1, 10),
      occurrenceEnd: utc(2026, 6, 1, 12),
    },
    {
      occurrenceStart: utc(2026, 6, 8, 10),
      occurrenceEnd: utc(2026, 6, 8, 12),
    },
    {
      occurrenceStart: utc(2026, 6, 15, 10),
      occurrenceEnd: utc(2026, 6, 15, 12),
    },
  ];

  it("is_cancelled の回は除外される", () => {
    // Arrange
    const overrides: OccurrenceOverride[] = [
      {
        occurrenceStart: utc(2026, 6, 8, 10),
        isCancelled: true,
        overrideStartAt: null,
        overrideEndAt: null,
        place: null,
        instructorName: null,
        note: null,
      },
    ];

    // Act
    const result = applyOverrides(occ, overrides);

    // Assert
    expect(starts(result)).toEqual([utc(2026, 6, 1, 10), utc(2026, 6, 15, 10)]);
  });

  it("時刻上書きは startAt を変えるがアンカー(occurrenceStart)は保持する", () => {
    // Arrange(6/15 を 1 時間繰り下げ)
    const overrides: OccurrenceOverride[] = [
      {
        occurrenceStart: utc(2026, 6, 15, 10),
        isCancelled: false,
        overrideStartAt: utc(2026, 6, 15, 11),
        overrideEndAt: utc(2026, 6, 15, 13),
        place: "別道場",
        instructorName: null,
        note: null,
      },
    ];

    // Act
    const result = applyOverrides(occ, overrides);
    const target = result.find(
      (o) => o.occurrenceStart === utc(2026, 6, 15, 10),
    );

    // Assert
    expect(target?.startAt).toBe(utc(2026, 6, 15, 11));
    expect(target?.endAt).toBe(utc(2026, 6, 15, 13));
    expect(target?.isOverridden).toBe(true);
    expect(target?.override?.place).toBe("別道場");
  });

  it("開始のみ上書き時は元の所要時間を保って終了をずらす(end < start を作らない)", () => {
    // Arrange(6/15 を 13:00 開始へ繰り下げ、終了は未指定。元は 10:00-12:00 の 2 時間)
    const overrides: OccurrenceOverride[] = [
      {
        occurrenceStart: utc(2026, 6, 15, 10),
        isCancelled: false,
        overrideStartAt: utc(2026, 6, 15, 13),
        overrideEndAt: null,
        place: null,
        instructorName: null,
        note: null,
      },
    ];

    // Act
    const result = applyOverrides(occ, overrides);
    const target = result.find(
      (o) => o.occurrenceStart === utc(2026, 6, 15, 10),
    );

    // Assert(13:00 開始、終了は 2 時間後の 15:00。end > start)
    expect(target?.startAt).toBe(utc(2026, 6, 15, 13));
    expect(target?.endAt).toBe(utc(2026, 6, 15, 15));
    expect(Date.parse(target?.endAt ?? "")).toBeGreaterThan(
      Date.parse(target?.startAt ?? ""),
    );
  });

  it("該当する override が無ければそのまま返す", () => {
    // Arrange / Act
    const result = applyOverrides(occ, []);

    // Assert
    expect(result).toHaveLength(3);
    expect(result.every((o) => o.isOverridden === false)).toBe(true);
  });
});
