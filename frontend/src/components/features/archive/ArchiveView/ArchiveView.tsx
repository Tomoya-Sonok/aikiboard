"use client";

import {
  CaretRight,
  FilePlus,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Trash,
  TreeStructure,
} from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { RichTextView } from "@/components/shared/RichTextView/RichTextView";
import { trpcClient } from "@/lib/trpc/client";
import type { ArchiveTreeNode } from "@/lib/types/archive";
import { type ArchiveEditing, ArchiveForm } from "../ArchiveForm/ArchiveForm";
import styles from "./ArchiveView.module.css";

type Props = {
  boardId: string;
  canManage: boolean;
};

type FormState =
  | { mode: "create"; parentId: string | null }
  | { mode: "edit"; editing: ArchiveEditing }
  | null;

export function ArchiveView({ boardId, canManage }: Props) {
  const t = useTranslations("boards.archive");
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [formState, setFormState] = useState<FormState>(null);

  const { data: listData } = useQuery({
    queryKey: ["archives", boardId, "list"],
    queryFn: () => trpcClient.archives.list.query({ boardId }),
  });
  const nodes = listData?.data ?? [];

  const { data: searchData } = useQuery({
    queryKey: ["archives", boardId, "search", search.trim()],
    queryFn: () =>
      trpcClient.archives.search.query({ boardId, q: search.trim() }),
    enabled: search.trim().length > 0,
  });
  const searchResults = searchData?.data ?? [];

  const { data: detailData } = useQuery({
    queryKey: ["archives", "detail", selectedId],
    queryFn: () => trpcClient.archives.detail.query({ id: selectedId ?? "" }),
    enabled: Boolean(selectedId),
  });
  const detail = detailData?.data ?? null;

  // フラットなノードを親子ツリーに組み立てる。
  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, ArchiveTreeNode[]>();
    for (const n of nodes) {
      const list = map.get(n.parentId) ?? [];
      list.push(n);
      map.set(n.parentId, list);
    }
    return map;
  }, [nodes]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["archives", boardId] });
    if (selectedId) {
      queryClient.invalidateQueries({
        queryKey: ["archives", "detail", selectedId],
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("deleteConfirm"))) {
      return;
    }
    const res = await trpcClient.archives.remove.mutate({ id });
    if (res.success) {
      if (selectedId === id) setSelectedId(null);
      refresh();
    }
  };

  const renderNode = (node: ArchiveTreeNode, depth: number) => {
    const children = childrenByParent.get(node.id) ?? [];
    return (
      <li key={node.id}>
        <div
          className={`${styles.node} ${selectedId === node.id ? styles.nodeActive : ""}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <button
            type="button"
            className={styles.nodeBtn}
            onClick={() => {
              setSelectedId(node.id);
              setSearch("");
            }}
          >
            {children.length > 0 ? (
              <CaretRight size={12} className={styles.caret} />
            ) : (
              <span className={styles.caretSpacer} />
            )}
            <span className={styles.nodeTitle}>{node.title}</span>
          </button>
          {canManage ? (
            <button
              type="button"
              className={styles.addChild}
              onClick={() =>
                setFormState({ mode: "create", parentId: node.id })
              }
              aria-label={t("addChild")}
              title={t("addChild")}
            >
              <FilePlus size={14} />
            </button>
          ) : null}
        </div>
        {children.length > 0 ? (
          <ul className={styles.childList}>
            {children.map((child) => renderNode(child, depth + 1))}
          </ul>
        ) : null}
      </li>
    );
  };

  const roots = childrenByParent.get(null) ?? [];

  return (
    <div className={styles.wrapper}>
      <aside className={styles.sidebar}>
        <div className={styles.searchBox}>
          <MagnifyingGlass size={14} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            value={search}
            placeholder={t("searchPlaceholder")}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {canManage ? (
          <button
            type="button"
            className={styles.newRoot}
            onClick={() => setFormState({ mode: "create", parentId: null })}
          >
            <Plus size={14} weight="bold" />
            {t("newPage")}
          </button>
        ) : null}
        {roots.length === 0 ? (
          <div className={styles.emptyTree}>
            <TreeStructure size={24} className={styles.emptyIcon} />
            <p className={styles.emptyText}>{t("empty")}</p>
          </div>
        ) : (
          <ul className={styles.tree}>
            {roots.map((node) => renderNode(node, 0))}
          </ul>
        )}
      </aside>

      <section className={styles.main}>
        {search.trim().length > 0 ? (
          <div className={styles.searchResults}>
            <h2 className={styles.searchHeading}>
              {t("searchResults", { count: searchResults.length })}
            </h2>
            {searchResults.map((r) => (
              <button
                key={r.id}
                type="button"
                className={styles.resultItem}
                onClick={() => {
                  setSelectedId(r.id);
                  setSearch("");
                }}
              >
                <span className={styles.resultTitle}>{r.title}</span>
                {r.snippet ? (
                  <span className={styles.resultSnippet}>{r.snippet}</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : detail ? (
          <article className={styles.page}>
            <div className={styles.pageHead}>
              <h1 className={styles.pageTitle}>{detail.title}</h1>
              {canManage ? (
                <div className={styles.pageActions}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() =>
                      setFormState({
                        mode: "edit",
                        editing: {
                          id: detail.id,
                          title: detail.title,
                          bodyRich: detail.bodyRich,
                        },
                      })
                    }
                    aria-label={t("edit")}
                  >
                    <PencilSimple size={16} />
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => handleDelete(detail.id)}
                    aria-label={t("delete")}
                  >
                    <Trash size={16} />
                  </button>
                </div>
              ) : null}
            </div>

            <RichTextView doc={detail.bodyRich} />

            {detail.attachments.length > 0 ? (
              <div className={styles.media}>
                {detail.attachments.map((a) =>
                  a.url == null ? null : a.type === "video" ? (
                    // biome-ignore lint/a11y/useMediaCaption: ユーザー投稿動画。キャプションは用意できない
                    <video
                      key={a.id}
                      src={a.url}
                      className={styles.mediaItem}
                      controls
                      preload="metadata"
                    />
                  ) : (
                    // biome-ignore lint/performance/noImgElement: Supabase Storage 署名 URL
                    <img
                      key={a.id}
                      src={a.url}
                      alt=""
                      className={styles.mediaItem}
                      loading="lazy"
                    />
                  ),
                )}
              </div>
            ) : null}
          </article>
        ) : (
          <div className={styles.placeholder}>
            <TreeStructure size={32} className={styles.emptyIcon} />
            <p className={styles.emptyText}>{t("selectPrompt")}</p>
          </div>
        )}
      </section>

      {formState ? (
        <ArchiveForm
          boardId={boardId}
          editing={formState.mode === "edit" ? formState.editing : undefined}
          parentId={formState.mode === "create" ? formState.parentId : null}
          open={formState !== null}
          onClose={() => setFormState(null)}
          onSaved={refresh}
        />
      ) : null}
    </div>
  );
}
