// ログイン後に開くデフォルトボードの slug を決める純関数。
// 最後に開いたボード(cookie)を優先し、一覧に無ければ先頭。所属が無ければ null。
// アクティブボードは URL で表現する方針(ADR 0002 B-7)のため、ここでは「どの slug へ送るか」だけを返す。

// 最後に開いたボードの slug を覚える cookie 名。リゾルバ(読み)と d/[slug](書き)で共有。
export const LAST_BOARD_COOKIE = "ab_last_board_slug";

export function resolveDefaultBoardSlug(
  boards: ReadonlyArray<{ slug: string }>,
  lastSlug: string | null | undefined,
): string | null {
  if (boards.length === 0) {
    return null;
  }
  if (lastSlug && boards.some((board) => board.slug === lastSlug)) {
    return lastSlug;
  }
  return boards[0].slug;
}
