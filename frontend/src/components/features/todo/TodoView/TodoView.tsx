"use client";

import { CalendarBlank, DotsThree, Plus } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Avatar } from "@/components/shared/Avatar/Avatar";
import { type CalendarLocale, formatJstShortDate } from "@/lib/calendar/format";
import { trpcClient } from "@/lib/trpc/client";
import type { BoardTodo, TodoStatus } from "@/lib/types/todo";
import { TodoForm } from "../TodoForm/TodoForm";
import styles from "./TodoView.module.css";

type Props = {
  boardId: string;
};

type FormState = { editing?: BoardTodo } | null;

const COLUMNS: TodoStatus[] = ["todo", "in_progress", "done"];

export function TodoView({ boardId }: Props) {
  const t = useTranslations("boards.todo");
  const rawLocale = useLocale();
  const locale: CalendarLocale = rawLocale === "en" ? "en" : "ja";
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState<FormState>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  const { data: todosData, isLoading } = useQuery({
    queryKey: ["boardTodos", boardId, "list"],
    queryFn: () => trpcClient.boardTodos.list.query({ boardId }),
  });
  const todos = todosData?.data ?? [];

  const { data: assigneesData } = useQuery({
    queryKey: ["boardTodos", boardId, "assignees"],
    queryFn: () => trpcClient.boardTodos.assignees.query({ boardId }),
  });
  const assignees = assigneesData?.data ?? [];

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["boardTodos", boardId] });

  const handleStatus = async (todo: BoardTodo, status: TodoStatus) => {
    if (status === todo.status) return;
    await trpcClient.boardTodos.update.mutate({ id: todo.id, status });
    refresh();
  };

  const handleDelete = async (id: string) => {
    setMenuId(null);
    if (!window.confirm(t("deleteConfirm"))) return;
    const res = await trpcClient.boardTodos.remove.mutate({ id });
    if (res.success) refresh();
  };

  const byStatus = (s: TodoStatus) => todos.filter((todo) => todo.status === s);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>{t("title")}</h1>
          <p className={styles.subtitle}>{t("subtitle")}</p>
        </div>
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => setFormState({})}
          disabled={assignees.length === 0}
        >
          <Plus size={14} weight="bold" />
          {t("create")}
        </button>
      </div>

      {isLoading ? (
        <p className={styles.empty}>{t("loading")}</p>
      ) : (
        <div className={styles.board}>
          {COLUMNS.map((status) => {
            const list = byStatus(status);
            return (
              <div key={status} className={styles.column}>
                <div className={styles.columnHead}>
                  <span
                    className={`${styles.statusDot} ${styles[`dot_${status}`]}`}
                  />
                  <span className={styles.columnTitle}>
                    {t(`status_${status}`)}
                  </span>
                  <span className={styles.count}>{list.length}</span>
                </div>
                <div className={styles.cards}>
                  {list.length === 0 ? (
                    <p className={styles.columnEmpty}>{t("columnEmpty")}</p>
                  ) : (
                    list.map((todo) => (
                      <div key={todo.id} className={styles.card}>
                        <div className={styles.cardTop}>
                          <span className={styles.cardTitle}>{todo.title}</span>
                          <div className={styles.menuWrap}>
                            <button
                              type="button"
                              className={styles.menuBtn}
                              onClick={() =>
                                setMenuId(menuId === todo.id ? null : todo.id)
                              }
                              aria-label={t("menu")}
                            >
                              <DotsThree size={16} weight="bold" />
                            </button>
                            {menuId === todo.id ? (
                              <div className={styles.menu}>
                                <button
                                  type="button"
                                  className={styles.menuItem}
                                  onClick={() => {
                                    setMenuId(null);
                                    setFormState({ editing: todo });
                                  }}
                                >
                                  {t("edit")}
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.menuItem} ${styles.menuDelete}`}
                                  onClick={() => handleDelete(todo.id)}
                                >
                                  {t("delete")}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {todo.note ? (
                          <p className={styles.cardNote}>{todo.note}</p>
                        ) : null}

                        <div className={styles.cardMeta}>
                          <span className={styles.assignee}>
                            <Avatar
                              name={todo.assignee.username}
                              imageUrl={todo.assignee.profileImageUrl}
                              size={20}
                            />
                            <span className={styles.assigneeName}>
                              {todo.assignee.username || "—"}
                            </span>
                          </span>
                          {todo.dueDate ? (
                            <span className={styles.due}>
                              <CalendarBlank size={12} />
                              {formatJstShortDate(
                                `${todo.dueDate}T00:00:00+09:00`,
                                locale,
                              )}
                            </span>
                          ) : null}
                        </div>

                        <select
                          className={styles.statusSelect}
                          value={todo.status}
                          onChange={(e) =>
                            handleStatus(todo, e.target.value as TodoStatus)
                          }
                          aria-label={t("changeStatus")}
                        >
                          {COLUMNS.map((s) => (
                            <option key={s} value={s}>
                              {t(`status_${s}`)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {assignees.length === 0 && !isLoading ? (
        <p className={styles.note}>{t("noAssigneesHint")}</p>
      ) : null}

      {formState ? (
        <TodoForm
          boardId={boardId}
          editing={formState.editing}
          assignees={assignees}
          open={formState !== null}
          onClose={() => setFormState(null)}
          onSaved={refresh}
        />
      ) : null}
    </div>
  );
}
