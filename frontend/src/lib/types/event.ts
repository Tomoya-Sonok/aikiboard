// 稽古カレンダー(イベント)の API 型(ADR 0002 B-4: DB の型 ≠ API の型)。
// backend /api/events のレスポンス・入力に対応する。

export type RsvpStatus = "attend" | "decline";
export type Weekday = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";
export type RecurrenceFreq = "DAILY" | "WEEKLY" | "MONTHLY";

// POST/PATCH の recurrence パラメータ(RRULE 文字列ではなく構造化オブジェクトで渡す)。
export type RecurrenceInput = {
  freq: RecurrenceFreq;
  interval?: number;
  byweekday?: Weekday[];
  bymonthday?: number;
  until?: string; // ISO instant
  count?: number;
};

// GET /api/events が返す「展開済みオカレンス」1 件。
export type EventOccurrence = {
  eventId: string;
  occurrenceStart: string; // アンカー(ISO、出欠の識別キー)
  startAt: string; // 表示用の開始(上書き適用後、ISO)
  endAt: string; // 表示用の終了(ISO)
  place: string;
  instructorName: string | null;
  note: string | null;
  isPublic: boolean;
  isRecurring: boolean;
  isOverridden: boolean;
  recurrenceRule: string | null; // シリーズの RFC5545 文字列(編集フォームの初期化に使う)
  attendingCount: number;
  decliningCount: number;
  myStatus: RsvpStatus | null;
  canManage: boolean;
};
