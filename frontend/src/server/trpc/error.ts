import type { TRPC_ERROR_CODE_KEY } from "@trpc/server";

// Hono backend の HTTP status を tRPC のエラーコードに対応づける。
export function mapTRPCErrorCodeKeyFromStatusCode(
  statusCode: number,
): TRPC_ERROR_CODE_KEY {
  switch (statusCode) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 429:
      return "TOO_MANY_REQUESTS";
    default:
      return "INTERNAL_SERVER_ERROR";
  }
}
