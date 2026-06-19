"use client";

import { Buildings, Lock } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/shared/Button/Button";
import { Dialog } from "@/components/shared/Dialog/Dialog";
import { trpcClient } from "@/lib/trpc/client";
import type { DiscoverableBoard } from "@/lib/types/membershipRequest";
import styles from "./DiscoverBoardsView.module.css";

// 自分の AikiNote 道場に紐づくボードを発見し、参加申請する。
export function DiscoverBoardsView() {
  const t = useTranslations("boards.discover");
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<DiscoverableBoard | null>(null);
  const [message, setMessage] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["discoverableBoards"],
    queryFn: () => trpcClient.membershipRequests.discoverable.query(),
  });
  const boards = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (input: { boardId: string; message?: string }) =>
      trpcClient.membershipRequests.create.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discoverableBoards"] });
      setTarget(null);
      setMessage("");
    },
  });

  const openRequest = (board: DiscoverableBoard) => {
    setMessage("");
    setTarget(board);
  };
  const submit = () => {
    if (!target) {
      return;
    }
    createMutation.mutate({
      boardId: target.id,
      message: message.trim() === "" ? undefined : message.trim(),
    });
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h1 className={styles.heading}>{t("title")}</h1>
        <p className={styles.lead}>{t("lead")}</p>
      </div>

      {isLoading ? (
        <p className={styles.empty}>{t("loading")}</p>
      ) : boards.length === 0 ? (
        <div className={styles.emptyState}>
          <Buildings size={28} className={styles.emptyIcon} />
          <p className={styles.empty}>{t("empty")}</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {boards.map((board) => (
            <li key={board.id} className={styles.row}>
              <span className={styles.boardIcon}>
                {Array.from(board.name)[0] ?? "?"}
              </span>
              <div className={styles.info}>
                <span className={styles.name}>
                  {board.name}
                  {!board.isPublic ? (
                    <Lock
                      size={13}
                      className={styles.lockIcon}
                      aria-label={t("private")}
                    />
                  ) : null}
                </span>
                <span className={styles.meta}>
                  {t("memberCount", { count: board.memberCount })}
                </span>
              </div>
              {board.requestStatus === "pending" ? (
                <span className={styles.pending}>{t("pending")}</span>
              ) : (
                <button
                  type="button"
                  className={styles.requestBtn}
                  onClick={() => openRequest(board)}
                >
                  {board.requestStatus === "rejected"
                    ? t("reRequest")
                    : t("request")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {target ? (
        <Dialog
          open={target !== null}
          onClose={() => setTarget(null)}
          title={t("requestTitle", { name: target.name })}
          footer={
            <Button onClick={submit} disabled={createMutation.isPending}>
              {createMutation.isPending ? t("sending") : t("send")}
            </Button>
          }
        >
          <div className={styles.dialogBody}>
            <span className={styles.dialogLabel}>{t("messageLabel")}</span>
            <textarea
              className={styles.textarea}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("messagePlaceholder")}
              maxLength={500}
              rows={4}
            />
            {createMutation.isError ? (
              <p className={styles.error}>{t("sendError")}</p>
            ) : null}
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
