"use client";

import { Megaphone, UsersThree } from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button } from "@/components/shared/Button/Button";
import { useRouter } from "@/lib/i18n/routing";
import { trpcClient } from "@/lib/trpc/client";
import styles from "./InviteJoin.module.css";

type Props = {
  token: string;
};

// 招待リンクのプレビュー + 参加。非メンバーが使う。
export function InviteJoin({ token }: Props) {
  const t = useTranslations("boards.invite");
  const router = useRouter();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["invitePreview", token],
    queryFn: () => trpcClient.invitations.preview.query({ token }),
    retry: false,
  });
  const preview = data?.data;
  // backend は無効/期限切れを 404 で返すため、query エラー or success:false を invalid とみなす。
  const invalid =
    isError || (data && !data.success) || (!isLoading && !preview);

  const joinMutation = useMutation({
    mutationFn: () => trpcClient.invitations.join.mutate({ token }),
    onSuccess: (res) => {
      const slug = res.data?.boardSlug;
      if (slug) {
        router.replace(`/d/${slug}`);
      }
    },
  });

  if (isLoading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.card}>
          <p className={styles.loading}>{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (invalid || !preview) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.card}>
          <Megaphone size={32} className={styles.iconMuted} />
          <h1 className={styles.title}>{t("invalidTitle")}</h1>
          <p className={styles.desc}>{t("invalidDesc")}</p>
          <Button onClick={() => router.replace("/home")}>{t("toHome")}</Button>
        </div>
      </div>
    );
  }

  if (preview.alreadyMember) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.card}>
          <h1 className={styles.title}>{preview.boardName}</h1>
          <p className={styles.desc}>{t("alreadyMember")}</p>
          <Button onClick={() => router.replace(`/d/${preview.boardSlug}`)}>
            {t("openBoard")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <span className={styles.inviteLabel}>{t("invitedTo")}</span>
        <h1 className={styles.title}>{preview.boardName}</h1>
        <p className={styles.memberCount}>
          <UsersThree size={15} className={styles.countIcon} />
          {t("memberCount", { count: preview.memberCount })}
        </p>
        <Button
          onClick={() => joinMutation.mutate()}
          disabled={joinMutation.isPending}
        >
          {joinMutation.isPending ? t("joining") : t("join")}
        </Button>
        {joinMutation.isError ? (
          <p className={styles.error}>{t("joinError")}</p>
        ) : null}
      </div>
    </div>
  );
}
