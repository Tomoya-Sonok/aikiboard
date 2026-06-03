// クライアント(ブラウザ)から BFF の tRPC を叩く vanilla クライアント。
// AuthProvider など React Query を介さずに呼びたい箇所で使う。
// 各コンポーネントのデータ取得(React Query 連携)は最初の board 機能で別途導入する。

import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { getBaseUrl } from "@/lib/utils/env";
import type { AppRouter } from "@/server/trpc/router";

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
    }),
  ],
});
