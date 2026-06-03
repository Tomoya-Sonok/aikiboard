// AikiBoard backend 用の軽量構造化ロガー。
//
// 目的: Phase 1 では `console.*` に JSON 1 行で出力するだけの薄いラッパーとし、
// Phase 2 で Sentry / Axiom を導入する際に **この 1 ファイルの `emit()` を差し替える**
// だけで送信処理を追加できるようにする（呼び出し側 API は変えない）。
//
// context には AikiBoard 固有のメタデータ（boardId / userId / feature）を渡せる。
// 将来 Sentry の tag / Axiom のフィールドにそのままマッピングする想定。

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  boardId?: string;
  userId?: string;
  feature?: string;
  // 上記以外の任意メタデータも許容する
  [key: string]: unknown;
}

interface LogEntry extends LogContext {
  timestamp: string;
  level: LogLevel;
  message: string;
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };
  const serialized = JSON.stringify(entry);

  // Phase 2: ここに Sentry.captureMessage / Axiom 送信を 1 箇所追加する。
  if (level === "error") {
    console.error(serialized);
  } else if (level === "warn") {
    console.warn(serialized);
  } else {
    console.log(serialized);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext): void =>
    emit("debug", message, context),
  info: (message: string, context?: LogContext): void =>
    emit("info", message, context),
  warn: (message: string, context?: LogContext): void =>
    emit("warn", message, context),
  error: (message: string, context?: LogContext): void =>
    emit("error", message, context),
};
