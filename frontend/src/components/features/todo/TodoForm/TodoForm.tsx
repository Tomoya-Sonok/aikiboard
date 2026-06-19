"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Dialog } from "@/components/shared/Dialog/Dialog";
import { trpcClient } from "@/lib/trpc/client";
import type {
  BoardTodo,
  TodoAssigneeOption,
  TodoStatus,
} from "@/lib/types/todo";
import styles from "./TodoForm.module.css";

type Props = {
  boardId: string;
  editing?: BoardTodo;
  assignees: TodoAssigneeOption[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const TITLE_MAX = 20;
const NOTE_MAX = 300;
const STATUSES: TodoStatus[] = ["todo", "in_progress", "done"];

export function TodoForm({
  boardId,
  editing,
  assignees,
  open,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations("boards.todo");
  const isEdit = Boolean(editing);

  const [title, setTitle] = useState(editing?.title ?? "");
  const [assigneeUserId, setAssigneeUserId] = useState(
    editing?.assignee.userId ?? assignees[0]?.userId ?? "",
  );
  const [status, setStatus] = useState<TodoStatus>(editing?.status ?? "todo");
  const [dueDate, setDueDate] = useState(editing?.dueDate ?? "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (saving) return;
    if (title.trim().length === 0) {
      setError(t("titleRequired"));
      return;
    }
    if (!assigneeUserId) {
      setError(t("assigneeRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const due = dueDate.trim() === "" ? null : dueDate;
      if (isEdit && editing) {
        const res = await trpcClient.boardTodos.update.mutate({
          id: editing.id,
          title: title.trim(),
          assigneeUserId,
          status,
          dueDate: due,
          note: note.trim() === "" ? null : note.trim(),
        });
        if (!res.success) throw new Error(res.error ?? t("saveError"));
      } else {
        const res = await trpcClient.boardTodos.create.mutate({
          boardId,
          title: title.trim(),
          assigneeUserId,
          status,
          dueDate: due,
          note: note.trim() === "" ? undefined : note.trim(),
        });
        if (!res.success) throw new Error(res.error ?? t("saveError"));
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? t("editTitle") : t("createTitle")}
      maxWidth={480}
    >
      <div className={styles.form}>
        <label className={styles.field}>
          <span className={styles.label}>
            {t("titleLabel")} <span className={styles.req}>*</span>
          </span>
          <input
            className={styles.input}
            value={title}
            maxLength={TITLE_MAX}
            placeholder={t("titlePlaceholder")}
            onChange={(e) => setTitle(e.target.value)}
          />
          <span className={styles.counter}>
            {title.length}/{TITLE_MAX}
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>
            {t("assignee")} <span className={styles.req}>*</span>
          </span>
          <select
            className={styles.input}
            value={assigneeUserId}
            onChange={(e) => setAssigneeUserId(e.target.value)}
          >
            {assignees.length === 0 ? (
              <option value="">{t("noAssignees")}</option>
            ) : null}
            {assignees.map((a) => (
              <option key={a.userId} value={a.userId}>
                {a.username || "—"}
              </option>
            ))}
          </select>
        </label>

        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>{t("status")}</span>
            <select
              className={styles.input}
              value={status}
              onChange={(e) => setStatus(e.target.value as TodoStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`status_${s}`)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{t("dueDate")}</span>
            <input
              type="date"
              className={styles.input}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>{t("note")}</span>
          <textarea
            className={styles.textarea}
            value={note}
            maxLength={NOTE_MAX}
            rows={3}
            placeholder={t("notePlaceholder")}
            onChange={(e) => setNote(e.target.value)}
          />
          <span className={styles.counter}>
            {note.length}/{NOTE_MAX}
          </span>
        </label>

        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancel}
            onClick={onClose}
            disabled={saving}
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            className={styles.save}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
