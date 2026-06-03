import { describe, expect, it } from "vitest";
import { mapTRPCErrorCodeKeyFromStatusCode } from "./error";

describe("mapTRPCErrorCodeKeyFromStatusCode", () => {
  it.each([
    [400, "BAD_REQUEST"],
    [401, "UNAUTHORIZED"],
    [403, "FORBIDDEN"],
    [404, "NOT_FOUND"],
    [429, "TOO_MANY_REQUESTS"],
    [500, "INTERNAL_SERVER_ERROR"],
  ])("status %i を %s に対応づける", (status, expected) => {
    // Act & Assert
    expect(mapTRPCErrorCodeKeyFromStatusCode(status)).toBe(expected);
  });

  it("未知の status は INTERNAL_SERVER_ERROR にフォールバックする", () => {
    // Act & Assert
    expect(mapTRPCErrorCodeKeyFromStatusCode(418)).toBe(
      "INTERNAL_SERVER_ERROR",
    );
  });
});
