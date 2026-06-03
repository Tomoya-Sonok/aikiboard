// tRPC procedure から Hono backend(api.aiki-board.com)を呼ぶ共通ラッパー。
// AikiNote の callHonoApi を流用(http-status-codes 依存は外し number で扱う)。

import { TRPCError } from "@trpc/server";
import { getApiBaseUrl, getBaseUrl } from "@/lib/utils/env";
import { mapTRPCErrorCodeKeyFromStatusCode } from "./error";

const buildApiUrl = (path: string) => {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};

type ErrorLike = {
  error?: string;
  message?: string;
};

const extractErrorMessage = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const errorPayload = payload as ErrorLike;
  return errorPayload.error || errorPayload.message || null;
};

export async function callHonoApi<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = buildApiUrl(path);
  const { headers: customHeaders, ...otherOptions } = options;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "X-App-Url": getBaseUrl(),
        ...customHeaders,
      },
      cache: "no-store",
      ...otherOptions,
    });
  } catch (err) {
    const cause = err instanceof Error ? err : undefined;
    console.error("[callHonoApi] fetch failed:", {
      url,
      error: cause?.message,
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Hono API の呼び出しに失敗しました: ${cause?.message ?? "unknown error"}`,
      cause: err,
    });
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorMsg = extractErrorMessage(payload);
    console.error(`[callHonoApi] API Error (${response.status}):`, {
      url,
      status: response.status,
      errorMsg,
    });
    throw new TRPCError({
      code: mapTRPCErrorCodeKeyFromStatusCode(response.status),
      message:
        errorMsg || `Hono API の呼び出しに失敗しました (${response.status})`,
    });
  }

  return payload as T;
}
