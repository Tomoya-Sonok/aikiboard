"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/shared/Button/Button";
import { Dialog } from "@/components/shared/Dialog/Dialog";
import { Input } from "@/components/shared/Input/Input";
import { RichTextEditor } from "@/components/shared/RichTextEditor/RichTextEditor";
import { trpcClient } from "@/lib/trpc/client";
import styles from "./AnnouncementForm.module.css";

// 編集対象(編集モードのみ)。詳細取得済みの値で初期化する。
export type AnnouncementEditing = {
  id: string;
  title: string;
  bodyRich: unknown;
  notifyEmail: boolean;
  isDraft: boolean;
};

type Props = {
  boardId: string;
  editing?: AnnouncementEditing;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const emptyDoc = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

// お知らせの作成・編集フォーム。下書き保存 → 公開の 2 段階。
// 公開は内部で(必要なら作成→)update → publish を直列に呼び、メール送信は backend に委ねる。
export function AnnouncementForm({
  boardId,
  editing,
  open,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations("boards.announcements");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [bodyRich, setBodyRich] = useState<unknown>(
    editing?.bodyRich ?? emptyDoc,
  );
  const [notifyEmail, setNotifyEmail] = useState(editing?.notifyEmail ?? false);
  const [error, setError] = useState<string | null>(null);

  // 公開済みの編集中は公開ボタンを出さない(保存のみ)。
  const isPublishedEdit = editing != null && !editing.isDraft;

  const saveMutation = useMutation({
    // publish=true のとき、保存後に公開まで行う。
    mutationFn: async (publish: boolean) => {
      let id = editing?.id;
      if (editing) {
        await trpcClient.announcements.update.mutate({
          id: editing.id,
          title,
          bodyRich,
          notifyEmail,
        });
      } else {
        const res = await trpcClient.announcements.create.mutate({
          boardId,
          title,
          bodyRich,
          notifyEmail,
        });
        id = res.data?.id;
      }
      if (publish && id) {
        await trpcClient.announcements.publish.mutate({ id });
      }
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: () => setError(t("saveError")),
  });

  const submit = (publish: boolean) => {
    if (title.trim() === "") {
      setError(t("titleRequired"));
      return;
    }
    if (publish) {
      const message = notifyEmail
        ? t("publishConfirmEmail")
        : t("publishConfirm");
      if (!window.confirm(message)) {
        return;
      }
    }
    setError(null);
    saveMutation.mutate(publish);
  };

  const busy = saveMutation.isPending;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? t("editTitle") : t("createTitle")}
      maxWidth={640}
      footer={
        <div className={styles.footer}>
          {isPublishedEdit ? (
            <Button onClick={() => submit(false)} disabled={busy}>
              {t("save")}
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() => submit(false)}
                disabled={busy}
              >
                {t("saveDraft")}
              </Button>
              <Button onClick={() => submit(true)} disabled={busy}>
                {t("publish")}
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className={styles.body}>
        <Input
          name="announcement-title"
          label={t("titleLabel")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("titlePlaceholder")}
          maxLength={200}
          required
        />

        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t("bodyLabel")}</span>
          <RichTextEditor
            value={editing?.bodyRich ?? emptyDoc}
            onChange={setBodyRich}
            placeholder={t("bodyPlaceholder")}
          />
        </div>

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.checked)}
            disabled={isPublishedEdit}
          />
          <span>{t("notifyEmailLabel")}</span>
        </label>
        {isPublishedEdit ? (
          <p className={styles.hint}>{t("notifyEmailPublishedHint")}</p>
        ) : (
          <p className={styles.hint}>{t("notifyEmailHint")}</p>
        )}

        {error ? <p className={styles.error}>{error}</p> : null}
      </div>
    </Dialog>
  );
}
