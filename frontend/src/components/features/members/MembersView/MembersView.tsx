"use client";

import { SignOut, Trash } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Avatar } from "@/components/shared/Avatar/Avatar";
import { type CalendarLocale, formatJstDateLong } from "@/lib/calendar/format";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRouter } from "@/lib/i18n/routing";
import { trpcClient } from "@/lib/trpc/client";
import type { BoardMember } from "@/lib/types/member";
import { InviteLinkPanel } from "../InviteLinkPanel/InviteLinkPanel";
import styles from "./MembersView.module.css";

type Props = {
  boardId: string;
  canManage: boolean;
};

export function MembersView({ boardId, canManage }: Props) {
  const t = useTranslations("boards.members");
  const rawLocale = useLocale();
  const locale: CalendarLocale = rawLocale === "en" ? "en" : "ja";
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["members", boardId],
    queryFn: () => trpcClient.members.list.query({ boardId }),
  });
  const members = data?.data ?? [];

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["members", boardId] });

  const removeMutation = useMutation({
    mutationFn: (userId: string) =>
      trpcClient.members.remove.mutate({ boardId, userId }),
    onSuccess: refresh,
  });

  const leaveMutation = useMutation({
    mutationFn: () => trpcClient.members.leave.mutate({ boardId }),
    onSuccess: () => {
      // 退会したらこのボードには入れないのでホームへ。
      router.replace("/home");
    },
  });

  const handleRemove = (member: BoardMember) => {
    if (window.confirm(t("removeConfirm", { name: member.username }))) {
      removeMutation.mutate(member.userId);
    }
  };
  const handleLeave = () => {
    if (window.confirm(t("leaveConfirm"))) {
      leaveMutation.mutate();
    }
  };

  const busy = removeMutation.isPending || leaveMutation.isPending;
  const roleLabel = (role: BoardMember["role"]) => t(`role.${role}`);

  return (
    <div className={styles.wrapper}>
      {canManage ? <InviteLinkPanel boardId={boardId} /> : null}

      <div className={styles.header}>
        <h1 className={styles.heading}>{t("title")}</h1>
        <span className={styles.count}>
          {t("memberCount", { count: members.length })}
        </span>
      </div>

      {isLoading ? (
        <p className={styles.empty}>{t("loading")}</p>
      ) : (
        <ul className={styles.list}>
          {members.map((member) => {
            const isSelf = member.userId === user?.id;
            const canRemove = canManage && member.role !== "owner" && !isSelf;
            const canLeave = isSelf && member.role !== "owner";
            return (
              <li key={member.userId} className={styles.row}>
                <Avatar
                  name={member.username}
                  imageUrl={member.profileImageUrl}
                  size={36}
                />
                <div className={styles.info}>
                  <span className={styles.name}>
                    {member.username || t("unknownUser")}
                    {isSelf ? (
                      <span className={styles.youBadge}>{t("you")}</span>
                    ) : null}
                  </span>
                  <span className={styles.meta}>
                    {t("joinedAt", {
                      date: formatJstDateLong(member.joinedAt, locale),
                    })}
                  </span>
                </div>
                <span
                  className={`${styles.roleBadge} ${styles[`role_${member.role}`]}`}
                >
                  {roleLabel(member.role)}
                </span>
                {canRemove ? (
                  <button
                    type="button"
                    className={styles.action}
                    onClick={() => handleRemove(member)}
                    disabled={busy}
                    aria-label={t("remove")}
                    title={t("remove")}
                  >
                    <Trash size={16} />
                  </button>
                ) : canLeave ? (
                  <button
                    type="button"
                    className={styles.action}
                    onClick={handleLeave}
                    disabled={busy}
                    aria-label={t("leave")}
                    title={t("leave")}
                  >
                    <SignOut size={16} />
                  </button>
                ) : (
                  <span className={styles.actionSpacer} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
