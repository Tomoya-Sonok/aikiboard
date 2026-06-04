// 稽古フォームの繰り返し設定と、RRULE 文字列(backend が返す recurrence_rule)の相互変換。
// backend(lib/recurrence.ts)のサブセットに対応。タイムゾーンは Asia/Tokyo 壁時計基準。
//
// - buildRecurrence(form)        : フォーム値 → API の RecurrenceInput(なしは null)
// - parseRecurrenceToForm(rrule) : RRULE 文字列 → フォーム値(編集時の初期化)
// - describeRecurrence(rrule, t) : RRULE 文字列 → 表示文字列(「毎週 月・水」等)

import type {
  RecurrenceFreq,
  RecurrenceInput,
  Weekday,
} from "@/lib/types/event";

// 曜日の表示・正規化順(日始まり)。
export const WEEKDAY_ORDER: Weekday[] = [
  "SU",
  "MO",
  "TU",
  "WE",
  "TH",
  "FR",
  "SA",
];

export type RecurrenceFreqOption = "NONE" | RecurrenceFreq;
export type RecurrenceEndMode = "never" | "until" | "count";

export type RecurrenceFormValue = {
  freq: RecurrenceFreqOption;
  interval: number;
  byweekday: Weekday[];
  endMode: RecurrenceEndMode;
  until: string; // yyyy-mm-dd(date input)
  count: number;
};

export const defaultRecurrenceForm = (): RecurrenceFormValue => ({
  freq: "NONE",
  interval: 1,
  byweekday: [],
  endMode: "never",
  until: "",
  count: 10,
});

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// yyyy-mm-dd(JST)→ その日の終わり(23:59:59 JST)の instant ISO。
const untilDateToIso = (date: string): string | undefined => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) {
    return undefined;
  }
  const ms =
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59) -
    JST_OFFSET_MS;
  return new Date(ms).toISOString();
};

// instant ISO → yyyy-mm-dd(JST)。
const isoToJstDate = (iso: string): string => {
  const d = new Date(new Date(iso).getTime() + JST_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
};

// `YYYYMMDD` / `YYYYMMDDTHHMMSSZ` / ISO のいずれかを ISO instant に。
const compactToIso = (value: string): string | undefined => {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(
    value.trim(),
  );
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
  const t = Date.parse(value);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
};

// フォーム値 → API の RecurrenceInput。繰り返しなしは null。
export const buildRecurrence = (
  form: RecurrenceFormValue,
): RecurrenceInput | null => {
  if (form.freq === "NONE") {
    return null;
  }
  const rule: RecurrenceInput = { freq: form.freq };
  if (form.interval > 1) {
    rule.interval = form.interval;
  }
  if (form.freq === "WEEKLY" && form.byweekday.length > 0) {
    rule.byweekday = WEEKDAY_ORDER.filter((w) => form.byweekday.includes(w));
  }
  if (form.endMode === "until") {
    const until = untilDateToIso(form.until);
    if (until) {
      rule.until = until;
    }
  } else if (form.endMode === "count") {
    rule.count = form.count;
  }
  return rule;
};

const parseRuleString = (
  rrule: string | null | undefined,
): RecurrenceInput | null => {
  if (!rrule) {
    return null;
  }
  const map: Record<string, string> = {};
  for (const part of rrule.split(";")) {
    const [k, v] = part.split("=");
    if (k && v != null) {
      map[k.trim().toUpperCase()] = v.trim();
    }
  }
  const freq = map.FREQ?.toUpperCase();
  if (freq !== "DAILY" && freq !== "WEEKLY" && freq !== "MONTHLY") {
    return null;
  }
  const rule: RecurrenceInput = { freq: freq as RecurrenceFreq };
  if (map.INTERVAL) {
    const n = Number.parseInt(map.INTERVAL, 10);
    if (Number.isFinite(n) && n >= 1) {
      rule.interval = n;
    }
  }
  if (freq === "WEEKLY" && map.BYDAY) {
    const days = map.BYDAY.split(",")
      .map((d) => d.trim().toUpperCase())
      .filter((d): d is Weekday => WEEKDAY_ORDER.includes(d as Weekday));
    if (days.length > 0) {
      rule.byweekday = WEEKDAY_ORDER.filter((w) => days.includes(w));
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

// RRULE 文字列 → 編集フォームの初期値。
export const parseRecurrenceToForm = (
  rrule: string | null | undefined,
): RecurrenceFormValue => {
  const rule = parseRuleString(rrule);
  if (!rule) {
    return defaultRecurrenceForm();
  }
  return {
    freq: rule.freq,
    interval: rule.interval ?? 1,
    byweekday: rule.byweekday ?? [],
    endMode:
      rule.count != null ? "count" : rule.until != null ? "until" : "never",
    until: rule.until ? isoToJstDate(rule.until) : "",
    count: rule.count ?? 10,
  };
};

type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

// RRULE 文字列 → 人間可読の表示文字列。t は boards.calendar スコープの翻訳関数。
export const describeRecurrence = (
  rrule: string | null | undefined,
  t: Translate,
): string => {
  const rule = parseRuleString(rrule);
  if (!rule) {
    return "";
  }
  const interval = rule.interval ?? 1;
  let base: string;
  if (rule.freq === "WEEKLY") {
    const days = (rule.byweekday ?? [])
      .map((w) => t(`weekdayShort.${w}`))
      .join("・");
    base =
      interval > 1
        ? t("recur.weeklyN", { n: interval, days })
        : t("recur.weekly", { days });
  } else if (rule.freq === "DAILY") {
    base = interval > 1 ? t("recur.dailyN", { n: interval }) : t("recur.daily");
  } else {
    base =
      interval > 1 ? t("recur.monthlyN", { n: interval }) : t("recur.monthly");
  }
  if (rule.count != null) {
    return `${base}・${t("recur.count", { n: rule.count })}`;
  }
  if (rule.until != null) {
    return `${base}・${t("recur.until", { date: isoToJstDate(rule.until) })}`;
  }
  return base;
};
