"use client";

// ボード作成ページ。作成は tRPC(BFF)→ Hono(service_role)経由。
// 道場検索も BFF 経由。成功で暫定的に /home へ(ボードホーム/一覧は後続 PR)。

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  BoardCreateForm,
  type BoardCreateValues,
} from "@/components/features/boards/BoardCreateForm/BoardCreateForm";
import type { DojoMaster } from "@/components/features/boards/DojoMasterSelect/DojoMasterSelect";
import { useRouter } from "@/lib/i18n/routing";
import { trpcClient } from "@/lib/trpc/client";
import styles from "./page.module.css";

async function searchDojos(query: string): Promise<DojoMaster[]> {
  const res = await trpcClient.dojoMasters.search.query({ q: query });
  return res.data ?? [];
}

// 検索で見つからない道場を新規追加(双方向書き込み 5.2)。作成した(or 既存の)道場を返す。
async function createDojo(name: string): Promise<DojoMaster> {
  const res = await trpcClient.dojoMasters.create.mutate({ dojoName: name });
  if (!res.success || !res.data) {
    throw new Error(res.error ?? "道場の追加に失敗しました");
  }
  const { existed, ...dojo } = res.data;
  void existed;
  return dojo;
}

export default function NewBoardPage() {
  const t = useTranslations("boards.create");
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: BoardCreateValues) =>
      trpcClient.boards.create.mutate(input),
    onSuccess: () => {
      router.replace("/home");
    },
    onError: (error) => {
      setServerError(error instanceof Error ? error.message : t("error"));
    },
  });

  const handleSubmit = (values: BoardCreateValues) => {
    setServerError(null);
    mutation.mutate(values);
  };

  return (
    <main className={styles.page}>
      <BoardCreateForm
        onSubmit={handleSubmit}
        searchDojos={searchDojos}
        createDojo={createDojo}
        isSubmitting={mutation.isPending}
        serverError={serverError}
      />
    </main>
  );
}
