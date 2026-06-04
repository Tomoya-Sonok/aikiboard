// 定期稽古(繰り返しイベント)の展開ロジック。外部パッケージは使わず、RFC5545 RRULE の
// サブセット(FREQ=DAILY|WEEKLY|MONTHLY + INTERVAL + BYDAY + BYMONTHDAY + UNTIL|COUNT)を
// 自前で parse / serialize / 展開する。
//
// タイムゾーン方針(計画で確定):
//   events.start_at / end_at は TIMESTAMPTZ(絶対時刻)で保存。繰り返しは「毎週月曜 19:00」の
//   ような壁時計を保ちたいので、Asia/Tokyo の壁時計基準で日付計算する。日本は DST が無く
//   固定オフセット(+09:00)なので、instant に +9h して UTC ゲッタで壁時計成分を読み、
//   日付計算後に -9h して instant に戻す方式で正しく扱える。
//
// 出欠(event_rsvps)はオカレンスの「アンカー = 元の開始時刻」で識別する。admin が
// この回だけ時刻を上書き(override)しても、出欠の紐付けはアンカーで維持される。

import { logger } from "./logger.js";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// 暴走防止の内部ガード(月窓 + 妥当な interval なら遥かに届かない)。
const MAX_ITERATIONS = 100_000;

export type Weekday = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";
export type RecurrenceFreq = "DAILY" | "WEEKLY" | "MONTHLY";

export type RecurrenceRule = {
  freq: RecurrenceFreq;
  interval: number; // >= 1
  byweekday?: Weekday[]; // WEEKLY のみ
  bymonthday?: number; // MONTHLY のみ(1..31)
  until?: string; // ISO instant(両端含む)
  count?: number; // >= 1
};

// RFC BYDAY → JS getUTCDay(0=Sun..6=Sat)
const WEEKDAY_TO_JS: Record<Weekday, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};
const JS_TO_WEEKDAY: Weekday[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

const isWeekday = (v: string): v is Weekday => v in WEEKDAY_TO_JS;

// 週開始は月曜(RFC 既定 WKST=MO)。月曜からの日数。
const daysFromMonday = (jsWeekday: number): number => (jsWeekday + 6) % 7;

type JstParts = {
  year: number;
  month: number; // 0-11
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0=Sun..6=Sat
};

const toJstParts = (ms: number): JstParts => {
  const d = new Date(ms + JST_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    weekday: d.getUTCDay(),
  };
};

const fromJst = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): number => Date.UTC(year, month, day, hour, minute, second) - JST_OFFSET_MS;

// ────────────────────────────────────────────────────────────────
// parse / serialize
// ────────────────────────────────────────────────────────────────

// `YYYYMMDD` / `YYYYMMDDTHHMMSSZ`(UTC)/ ISO のいずれかを ISO instant に正規化。
const compactToIso = (value: string): string | null => {
  const v = value.trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(v);
  if (m) {
    const ms = Date.UTC(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      m[4] ? Number(m[4]) : 0,
      m[5] ? Number(m[5]) : 0,
      m[6] ? Number(m[6]) : 0,
    );
    return new Date(ms).toISOString();
  }
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
};

const isoToCompact = (iso: string): string => {
  const t = Date.parse(iso);
  const d = new Date(Number.isNaN(t) ? 0 : t);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
};

// RRULE 文字列をパース。サポート外/不正は null(呼び出し側は単発として扱う)。
export const parseRule = (
  text: string | null | undefined,
): RecurrenceRule | null => {
  if (!text) {
    return null;
  }
  const map: Record<string, string> = {};
  for (const part of text.split(";")) {
    const [rawKey, rawValue] = part.split("=");
    if (rawKey && rawValue != null) {
      map[rawKey.trim().toUpperCase()] = rawValue.trim();
    }
  }

  const freq = map.FREQ?.toUpperCase();
  if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY") {
    return null;
  }

  const rule: RecurrenceRule = { freq, interval: 1 };

  if (map.INTERVAL) {
    const n = Number.parseInt(map.INTERVAL, 10);
    if (Number.isFinite(n) && n >= 1) {
      rule.interval = n;
    }
  }

  if (freq === "WEEKLY" && map.BYDAY) {
    const days = [
      ...new Set(
        map.BYDAY.split(",")
          .map((d) => d.trim().toUpperCase())
          .filter(isWeekday),
      ),
    ];
    if (days.length > 0) {
      rule.byweekday = days;
    }
  }

  if (freq === "MONTHLY" && map.BYMONTHDAY) {
    const n = Number.parseInt(map.BYMONTHDAY, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 31) {
      rule.bymonthday = n;
    }
  }

  if (map.COUNT) {
    const n = Number.parseInt(map.COUNT, 10);
    if (Number.isFinite(n) && n >= 1) {
      rule.count = n;
    }
  } else if (map.UNTIL) {
    const iso = compactToIso(map.UNTIL);
    if (iso) {
      rule.until = iso;
    }
  }

  return rule;
};

// RecurrenceRule を RFC5545 RRULE 文字列に直す(events.recurrence_rule に保存する形)。
export const serializeRule = (rule: RecurrenceRule): string => {
  const out = [`FREQ=${rule.freq}`];
  if (rule.interval && rule.interval > 1) {
    out.push(`INTERVAL=${rule.interval}`);
  }
  if (rule.freq === "WEEKLY" && rule.byweekday && rule.byweekday.length > 0) {
    out.push(`BYDAY=${rule.byweekday.join(",")}`);
  }
  if (rule.freq === "MONTHLY" && rule.bymonthday) {
    out.push(`BYMONTHDAY=${rule.bymonthday}`);
  }
  if (rule.count) {
    out.push(`COUNT=${rule.count}`);
  } else if (rule.until) {
    out.push(`UNTIL=${isoToCompact(rule.until)}`);
  }
  return out.join(";");
};

// ────────────────────────────────────────────────────────────────
// 展開
// ────────────────────────────────────────────────────────────────

export type EventForExpand = {
  startAt: string; // dtstart(ISO instant)
  endAt: string; // 終了(ISO instant)。長さ = endAt - startAt を各回に加算
  recurrenceRule: string | null;
};

export type RawOccurrence = {
  occurrenceStart: string; // アンカー(ISO)
  occurrenceEnd: string; // アンカー + 長さ(ISO)
};

// イベントを [fromIso, toIso) の窓に展開する(occurrence の開始が窓内のものを返す)。
export const expandEvent = (
  event: EventForExpand,
  fromIso: string,
  toIso: string,
): RawOccurrence[] => {
  const startMs = Date.parse(event.startAt);
  const endMs = Date.parse(event.endAt);
  const fromMs = Date.parse(fromIso);
  const toMs = Date.parse(toIso);
  if (
    Number.isNaN(startMs) ||
    Number.isNaN(endMs) ||
    Number.isNaN(fromMs) ||
    Number.isNaN(toMs)
  ) {
    return [];
  }

  const durationMs = Math.max(0, endMs - startMs);
  const make = (occMs: number): RawOccurrence => ({
    occurrenceStart: new Date(occMs).toISOString(),
    occurrenceEnd: new Date(occMs + durationMs).toISOString(),
  });

  const rule = parseRule(event.recurrenceRule);
  // 単発(またはサポート外ルール)は dtstart のみ。
  if (!rule) {
    return startMs >= fromMs && startMs < toMs ? [make(startMs)] : [];
  }

  const untilMs = rule.until ? Date.parse(rule.until) : null;
  const maxCount = rule.count ?? null;
  const results: RawOccurrence[] = [];
  let generated = 0;

  // 内部ガードに達して結果を打ち切った場合は無言で切り捨てず可観測にする
  // (dtstart が窓より極端に過去で、窓に到達する前に枯渇するようなデータ起因の取りこぼし対策)。
  const warnTruncated = () =>
    logger.warn("繰り返し展開が MAX_ITERATIONS に達して打ち切られた", {
      feature: "recurrence",
      recurrenceRule: event.recurrenceRule,
      startAt: event.startAt,
      fromIso,
      toIso,
    });

  // occMs は窓内(< toMs)であることを呼び出し側が保証する。
  // 戻り値 "stop" で全体の生成を打ち切る(until / count に到達)。
  const tryAdd = (occMs: number): "added" | "stop" => {
    if (untilMs != null && occMs > untilMs) {
      return "stop";
    }
    if (maxCount != null && generated >= maxCount) {
      return "stop";
    }
    generated += 1;
    if (occMs >= fromMs) {
      results.push(make(occMs));
    }
    return "added";
  };

  if (rule.freq === "DAILY") {
    const stepMs = rule.interval * DAY_MS;
    let occMs = startMs;
    let iter = 0;
    while (iter < MAX_ITERATIONS) {
      if (occMs >= toMs) {
        break;
      }
      if (tryAdd(occMs) === "stop") {
        break;
      }
      occMs += stepMs;
      iter += 1;
    }
    if (iter >= MAX_ITERATIONS) {
      warnTruncated();
    }
    return results;
  }

  if (rule.freq === "WEEKLY") {
    const dtp = toJstParts(startMs);
    const bydays =
      rule.byweekday && rule.byweekday.length > 0
        ? rule.byweekday
        : [JS_TO_WEEKDAY[dtp.weekday]];
    const offsets = [
      ...new Set(bydays.map((d) => daysFromMonday(WEEKDAY_TO_JS[d]))),
    ].sort((a, b) => a - b);

    // dtstart の週の月曜(dtstart の時刻のまま)。
    const mondayMs = fromJst(
      dtp.year,
      dtp.month,
      dtp.day - daysFromMonday(dtp.weekday),
      dtp.hour,
      dtp.minute,
      dtp.second,
    );

    let iter = 0;
    let truncated = false;
    weeks: for (let k = 0; k < MAX_ITERATIONS; k += 1) {
      const weekBaseDays = k * rule.interval * 7;
      for (const off of offsets) {
        if (iter >= MAX_ITERATIONS) {
          truncated = true;
          break weeks;
        }
        iter += 1;
        const occMs = mondayMs + (weekBaseDays + off) * DAY_MS;
        if (occMs < startMs) {
          continue; // 最初の週で dtstart より前の曜日は対象外
        }
        if (occMs >= toMs) {
          break weeks; // offsets 昇順 + 週は単調増加なので以降は全て窓外
        }
        if (tryAdd(occMs) === "stop") {
          break weeks;
        }
      }
    }
    if (truncated) {
      warnTruncated();
    }
    return results;
  }

  // MONTHLY
  const dtp = toJstParts(startMs);
  const monthday = rule.bymonthday ?? dtp.day;
  let i = 0;
  for (; i < MAX_ITERATIONS; i += 1) {
    const totalMonths = dtp.year * 12 + dtp.month + i * rule.interval;
    const year = Math.floor(totalMonths / 12);
    const month = totalMonths % 12;
    const occMs = fromJst(
      year,
      month,
      monthday,
      dtp.hour,
      dtp.minute,
      dtp.second,
    );
    if (occMs >= toMs) {
      break; // 月は単調増加なので打ち切り
    }
    // 不正日(例: 2月30日)は当該月をスキップ(カウントもしない)。
    const c = toJstParts(occMs);
    const valid = c.year === year && c.month === month && c.day === monthday;
    if (valid && occMs >= startMs) {
      if (tryAdd(occMs) === "stop") {
        break;
      }
    }
  }
  if (i >= MAX_ITERATIONS) {
    warnTruncated();
  }
  return results;
};

// ────────────────────────────────────────────────────────────────
// 例外(休み / 上書き)の適用
// ────────────────────────────────────────────────────────────────

export type OccurrenceOverride = {
  occurrenceStart: string; // アンカー(展開後の元の開始時刻に一致)
  isCancelled: boolean;
  overrideStartAt: string | null;
  overrideEndAt: string | null;
  place: string | null;
  instructorName: string | null;
  note: string | null;
};

export type EffectiveOccurrence = {
  occurrenceStart: string; // アンカー(出欠の識別キー)
  startAt: string; // 表示用の開始(上書き適用後)
  endAt: string; // 表示用の終了(上書き適用後)
  isOverridden: boolean;
  override: OccurrenceOverride | null; // place/instructor/note の合成用に保持
};

// 展開済みオカレンスに例外を適用する。is_cancelled は除外し、時刻上書きを反映する。
// place / instructor_name / note の合成(override ?? event の既定値)は呼び出し側で行う。
export const applyOverrides = (
  occurrences: RawOccurrence[],
  overrides: OccurrenceOverride[],
): EffectiveOccurrence[] => {
  const byAnchor = new Map<number, OccurrenceOverride>();
  for (const ov of overrides) {
    const t = Date.parse(ov.occurrenceStart);
    if (!Number.isNaN(t)) {
      byAnchor.set(t, ov);
    }
  }

  const out: EffectiveOccurrence[] = [];
  for (const occ of occurrences) {
    const ov = byAnchor.get(Date.parse(occ.occurrenceStart)) ?? null;
    if (ov?.isCancelled) {
      continue;
    }
    // 片側だけの時刻上書きでも endAt < startAt の不整合を作らない。
    // - 開始のみ上書き: 元の所要時間を保って終了をずらす
    // - 終了のみ上書き: 開始はアンカー据え置き
    // - 結果が end <= start になる場合は所要時間を保って終了を再計算(防御)
    const durationMs =
      Date.parse(occ.occurrenceEnd) - Date.parse(occ.occurrenceStart);
    const startAt = ov?.overrideStartAt ?? occ.occurrenceStart;
    let endAt: string;
    if (ov?.overrideEndAt) {
      endAt = ov.overrideEndAt;
    } else if (ov?.overrideStartAt) {
      endAt = new Date(Date.parse(startAt) + durationMs).toISOString();
    } else {
      endAt = occ.occurrenceEnd;
    }
    if (Date.parse(endAt) <= Date.parse(startAt)) {
      endAt = new Date(Date.parse(startAt) + durationMs).toISOString();
    }
    out.push({
      occurrenceStart: occ.occurrenceStart,
      startAt,
      endAt,
      isOverridden: ov != null,
      override: ov,
    });
  }
  return out;
};
