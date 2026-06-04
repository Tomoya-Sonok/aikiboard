// 月カレンダーの日付ロジック。すべて Asia/Tokyo の壁時計基準(固定 +9h、日本は DST 無し)で
// 計算し、ブラウザのタイムゾーンに依存させない(backend の展開と一致させる)。

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type CalendarCell = {
  key: string; // "YYYY-MM-DD"(JST)
  year: number;
  month: number; // 0-11(JST)
  day: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  startMs: number; // 00:00 JST の instant(ms)
};

type JstParts = {
  year: number;
  month: number;
  day: number;
  weekday: number; // 0=Sun
  hour: number;
  minute: number;
};

const jstParts = (ms: number): JstParts => {
  const d = new Date(ms + JST_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
};

const jstMidnightMs = (year: number, month: number, day: number): number =>
  Date.UTC(year, month, day, 0, 0, 0) - JST_OFFSET_MS;

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (year: number, month: number, day: number) =>
  `${year}-${pad(month + 1)}-${pad(day)}`;

// 指定 JST 年月の 6 週(42 セル)グリッドを返す(日曜始まり)。
export const getMonthGrid = (
  year: number,
  month: number,
  nowMs: number,
): CalendarCell[] => {
  const today = jstParts(nowMs);
  const firstMs = jstMidnightMs(year, month, 1);
  const firstWeekday = jstParts(firstMs).weekday;
  const gridStartMs = firstMs - firstWeekday * DAY_MS;

  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const ms = gridStartMs + i * DAY_MS;
    const p = jstParts(ms);
    cells.push({
      key: keyOf(p.year, p.month, p.day),
      year: p.year,
      month: p.month,
      day: p.day,
      inCurrentMonth: p.year === year && p.month === month,
      isToday:
        p.year === today.year && p.month === today.month && p.day === today.day,
      startMs: ms,
    });
  }
  return cells;
};

// グリッド全体をカバーする取得窓 [from, to)(ISO)。
export const gridWindow = (
  cells: CalendarCell[],
): { from: string; to: string } => {
  const fromMs = cells[0].startMs;
  const toMs = cells[cells.length - 1].startMs + DAY_MS;
  return {
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
  };
};

// instant(ISO)が属する JST 日付キー。オカレンスをセルに割り当てる。
export const jstDateKey = (iso: string): string => {
  const p = jstParts(new Date(iso).getTime());
  return keyOf(p.year, p.month, p.day);
};

// 月送り(delta は ±n ヶ月)。
export const shiftMonth = (
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } => {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
};

// 現在の JST 年月。
export const currentJstYearMonth = (
  nowMs: number,
): { year: number; month: number } => {
  const p = jstParts(nowMs);
  return { year: p.year, month: p.month };
};

// date(yyyy-mm-dd)+ time(HH:mm)を JST 壁時計として instant ISO に。
export const jstDateTimeToIso = (date: string, time: string): string | null => {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const tm = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dm || !tm) {
    return null;
  }
  const ms =
    Date.UTC(
      Number(dm[1]),
      Number(dm[2]) - 1,
      Number(dm[3]),
      Number(tm[1]),
      Number(tm[2]),
      0,
    ) - JST_OFFSET_MS;
  return new Date(ms).toISOString();
};

// instant ISO → JST の {date(yyyy-mm-dd), time(HH:mm)}(編集フォームの初期化)。
export const isoToJstDateTime = (
  iso: string,
): { date: string; time: string } => {
  const p = jstParts(new Date(iso).getTime());
  return {
    date: keyOf(p.year, p.month, p.day),
    time: `${pad(p.hour)}:${pad(p.minute)}`,
  };
};
