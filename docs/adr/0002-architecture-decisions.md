# アーキテクチャ方針 — 型生成・認証・tRPC 構造・状態管理

Phase 1 の実装に先立ち、フロントエンド / バックエンドの基盤アーキテクチャを 4 点確定する。いずれも AikiNote の実装パターンをベースに、AikiNote が抱える負債(`SupabaseClient<any>` の型漏れ、複雑な自前 JWT 生成、巨大なフラット `procedures.ts`)について AikiBoard では意図的に改善・乖離する。

> 本 ADR は B テーマ(B-4〜B-7)を 1 本にまとめている。Phase 1 で各機能(特に認証)を実装し詳細が固まった段階で、必要なら独立した ADR(0005 以降)へ切り出す。

## B-4: Supabase 型生成は導入しない(BFF + Zod で型を定義)

- Supabase CLI による DB スキーマからの型生成は **導入しない**。`SupabaseClient<any>` で運用する。
- API 層は別途 **Zod schema + 戻り型(`ApiResponse`)** で型を定義する。**DB の型 ≠ API の型**(BFF パターンの徹底)。
- 狙い: 内部実装(DB スキーマ)の API への漏洩を防ぎ、API 契約を安定させる。スキーマ変更が即フロントの型崩壊に波及しない。

## B-5: 認証は Supabase access_token を BFF で検証し Hono へ転送

- Supabase Auth で SSO(Email + Google + Apple)。AikiNote と同一 Supabase Auth を共有。
- フロント session: `proxy.ts` で `createServerClient` + cookies、**`AuthProvider` Context で一元管理**(AikiNote が後から学んだ Provider 一元化を最初から採用)。
- ルートグループ: `(authenticated)` / `(public)` で分離。
- BFF(Next.js tRPC)で `serverSupabase.auth.getUser()` により session 検証 → ctx に access_token を渡す。
- Hono backend で `hono/jwt` により **HS256 verify**(`SUPABASE_JWT_SECRET` 使用、`payload.sub` → `userId`)。
- ミドルウェア 3 層: `authMiddleware`(JWT 検証)/ `boardMemberMiddleware`(board_members JOIN 確認)/ `boardAdminMiddleware`(role 確認)。
- Cookie: `httpOnly + Secure + SameSite=Strict`。有効期限は Supabase 標準(access_token 1h + refresh_token 60d)。
- **AikiNote の自前 JWT 生成レイヤー(`generateToken`)は採用しない**(意図的に剥がす)。

## B-6: tRPC ルーターは feature 別に分割する

- `frontend/src/server/trpc/`:
  - `index.ts`(initTRPC + publicProcedure / authenticatedProcedure / boardMemberProcedure / boardAdminProcedure)
  - `router.ts`(各 sub router を mergeRouters)
  - `hono.ts`(callHonoApi、AikiNote から流用)/ `error.ts`(status → TRPC error code マッピング、AikiNote から流用)
  - `routers/<feature>.ts`(boards, boardMembers, events, announcements, posts, threads, archives, finance, members, subscriptions, publicPage, ...)
- backend Hono: `backend/src/routes/<feature>/index.ts`、`/api/<feature>` プレフィックス(AikiNote と完全同位)。
- tRPC procedure ↔ Hono endpoint は原則 1:1。
- **AikiNote のフラット `procedures.ts` 構造は採用しない**(可読性 / PR diff サイズ改善のため意図的に乖離)。

## B-7: 状態管理の境界 + アクティブボードは URL 駆動

- Server state: TanStack Query + tRPC / Form state: React Hook Form + Zod / 永続 UI 設定: Zustand(`frontend/src/stores/`)/ Session: AuthProvider Context / 一時 UI: `useState`。
- **アクティブボードは URL で表現**(Linear / Notion 流): `/<locale>/d/<board-slug>/...`。
- 公開ページは `localePrefix: "as-needed"` 既定で `/d/<slug>` / `/ja/d/<slug>` / `/en/d/<slug>` 全てに到達可能。

URL 構造の代表例:

```
/ja/boards                        所属ボード一覧
/ja/d/<board-slug>                ボードホーム
/ja/d/<board-slug>/calendar       稽古カレンダー
/d/<board-slug>                   公開ページ(認証不要、locale as-needed)
/ja/settings                      ユーザー個人設定(ボード横断)
```

## Considered Options

- **型生成あり vs なし(採用: なし)**: 生成型はボイラープレート削減になるが、DB 型が API・フロントに漏れて BFF の利点(契約の安定)を損なう。AikiBoard は契約安定を優先し型生成なしを採用。
- **自前 JWT 生成 vs Supabase token 直検証(採用: 直検証)**: AikiNote は `generateToken` で独自 JWT を発行する層を持つが、複雑で保守コストが高い。Supabase の access_token をそのまま HS256 で検証すれば層が 1 つ減り、Supabase の token ライフサイクルに乗れる。
- **フラット procedures.ts vs feature 別分割(採用: feature 別)**: AikiNote の単一 `procedures.ts` は規模拡大で肥大化し PR diff が読みにくい。feature 別ファイルに分割して可読性と diff の局所性を確保。
- **アクティブボードの保持(採用: URL / 不採用: Zustand・Context)**: グローバル state で「現在のボード」を持つとリロード・共有・戻る操作で不整合が出る。URL を single source of truth にすることで、リンク共有・ブラウザ履歴・並行タブが自然に機能する。

## Consequences

- `SUPABASE_JWT_SECRET` を Cloudflare Workers Secret として登録する必要がある(Phase 1 認証実装時、`pnpm wrangler secret put SUPABASE_JWT_SECRET`)。
- ミドルウェア 3 層(auth / boardMember / boardAdmin)は RLS と多重防御の関係になる。RLS テスト(ADR 0003)と併せて各ロールの境界を検証する。
- URL 駆動のため、board-slug の決定地点(ボード作成フロー)とユニーク性担保が Phase 1 第 1 機能の要になる。
- 本 ADR は方針レベル。実装の細部(Context の API 形状、procedure の命名)は Phase 1 実装中に確定し、必要なら追補 ADR を作る。
