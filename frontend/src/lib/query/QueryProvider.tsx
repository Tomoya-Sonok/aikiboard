"use client";

// TanStack Query の Provider(ADR 0002 B-7: Server state = TanStack Query + tRPC)。
// データ取得/更新は vanilla tRPC client(@/lib/trpc/client)を queryFn/mutationFn から呼ぶ。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
