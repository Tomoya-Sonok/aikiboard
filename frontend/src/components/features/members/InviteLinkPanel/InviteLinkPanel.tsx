"use client";

import { Check, Copy, LinkSimple, Trash } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { type CalendarLocale, formatJstDateLong } from "@/lib/calendar/format";
import { trpcClient } from "@/lib/trpc/client";
import { getBaseUrl } from "@/lib/utils/env";
import styles from "./InviteLinkPanel.module.css";

type Props = {
  boardId: string;
};

const inviteUrl = (token: string) => `${getBaseUrl()}/invite/${token}`;

// 共有招待リンクの発行・コピー・失効(管理者向け)。
export function InviteLinkPanel({ boardId }: Props) {
  const t = useTranslations("boards.members");
  const rawLocale = useLocale();
  const locale: CalendarLocale = rawLocale === "en" ? "en" : "ja";
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["invitations", boardId],
    queryFn: () => trpcClient.invitations.list.query({ boardId }),
  });
  const invitations = data?.data ?? [];

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["invitations", boardId] });

  const createMutation = useMutation({
    mutationFn: () => trpcClient.invitations.create.mutate({ boardId }),
    onSuccess: refresh,
  });
  const revokeMutation = useMutation({
    mutationFn: (id: string) => trpcClient.invitations.revoke.mutate({ id }),
    onSuccess: refresh,
  });

  const copy = async (token: string, id: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // クリップボード非対応環境では何もしない(URL は表示済み)。
    }
  };

  const busy = createMutation.isPending || revokeMutation.isPending;

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <span className={styles.title}>
          <LinkSimple size={16} className={styles.titleIcon} />
          {t("inviteTitle")}
        </span>
        <button
          type="button"
          className={styles.createBtn}
          onClick={() => createMutation.mutate()}
          disabled={busy}
        >
          {t("createInvite")}
        </button>
      </div>
      <p className={styles.desc}>{t("inviteDesc")}</p>

      {invitations.length === 0 ? (
        <p className={styles.empty}>{t("noInvite")}</p>
      ) : (
        <ul className={styles.list}>
          {invitations.map((inv) => (
            <li key={inv.id} className={styles.item}>
              <input
                className={styles.url}
                value={inviteUrl(inv.token)}
                readOnly
                onFocus={(e) => e.target.select()}
                aria-label={t("inviteUrl")}
              />
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => copy(inv.token, inv.id)}
                aria-label={t("copy")}
                title={t("copy")}
              >
                {copiedId === inv.id ? (
                  <Check size={15} weight="bold" />
                ) : (
                  <Copy size={15} />
                )}
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => revokeMutation.mutate(inv.id)}
                disabled={busy}
                aria-label={t("revoke")}
                title={t("revoke")}
              >
                <Trash size={15} />
              </button>
              <span className={styles.expiry}>
                {t("expiresAt", {
                  date: formatJstDateLong(inv.expiresAt, locale),
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
