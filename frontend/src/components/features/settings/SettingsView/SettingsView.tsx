"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { trpcClient } from "@/lib/trpc/client";
import type { PublicPageConfig } from "@/lib/types/publicBoard";
import styles from "./SettingsView.module.css";

type Props = {
  boardId: string;
  slug: string;
};

// 10 色プリセット(9.4)。色は表示用のスウォッチ。実際のテーマ適用は将来対応。
const THEMES: { code: string; color: string }[] = [
  { code: "sumi", color: "#2C2C2C" },
  { code: "dou", color: "#C4956A" },
  { code: "fukamidori", color: "#2E5E4E" },
  { code: "ai", color: "#234D70" },
  { code: "enji", color: "#B23A48" },
  { code: "yamabuki", color: "#E8A33D" },
  { code: "shikon", color: "#4A3C6E" },
  { code: "toki", color: "#E29DB0" },
  { code: "usuzumi", color: "#8A8A8A" },
  { code: "nezumi", color: "#6E7173" },
];

export function SettingsView({ boardId, slug }: Props) {
  const t = useTranslations("boards.settings");

  const { data, isLoading } = useQuery({
    queryKey: ["boardSettings", boardId],
    queryFn: () => trpcClient.boardSettings.get.query({ boardId }),
  });

  const [isPublic, setIsPublic] = useState(false);
  const [theme, setTheme] = useState("sumi");
  const [logoUrl, setLogoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [cfg, setCfg] = useState<PublicPageConfig>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 取得後にフォームへ反映する(初回のみ)。
  useEffect(() => {
    const s = data?.data;
    if (!s) {
      return;
    }
    setIsPublic(s.isPublic);
    setTheme(s.themeColorCode);
    setLogoUrl(s.logoUrl ?? "");
    setDescription(s.description ?? "");
    setCfg(s.publicPageConfig ?? {});
  }, [data]);

  const setCfgField = (key: keyof PublicPageConfig, value: unknown) => {
    setCfg((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await trpcClient.boardSettings.update.mutate({
        boardId,
        isPublic,
        themeColorCode: theme as never,
        logoUrl: logoUrl.trim() === "" ? null : logoUrl.trim(),
        description: description.trim() === "" ? null : description.trim(),
        publicPageConfig: cfg,
      });
      if (!res.success) {
        throw new Error(res.error ?? t("saveError"));
      }
      setMessage(t("saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <p className={styles.loading}>{t("loading")}</p>;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h1 className={styles.heading}>{t("title")}</h1>
        <a
          className={styles.previewLink}
          href={`/d/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("previewPublic")}
        </a>
      </div>

      {/* 公開設定 */}
      <section className={styles.section}>
        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          <span>
            <span className={styles.toggleTitle}>{t("isPublic")}</span>
            <span className={styles.hint}>{t("isPublicHint")}</span>
          </span>
        </label>
      </section>

      {/* テーマカラー */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t("theme")}</h2>
        <div className={styles.swatches}>
          {THEMES.map((th) => (
            <button
              key={th.code}
              type="button"
              className={`${styles.swatch} ${theme === th.code ? styles.swatchActive : ""}`}
              style={{ background: th.color }}
              onClick={() => setTheme(th.code)}
              aria-label={th.code}
              aria-pressed={theme === th.code}
            />
          ))}
        </div>
      </section>

      {/* 基本情報 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t("basics")}</h2>
        <label className={styles.field}>
          <span className={styles.label}>{t("logoUrl")}</span>
          <input
            className={styles.input}
            value={logoUrl}
            placeholder="https://…"
            onChange={(e) => setLogoUrl(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>{t("description")}</span>
          <textarea
            className={styles.textarea}
            value={description}
            rows={3}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>{t("organization")}</span>
          <input
            className={styles.input}
            value={cfg.organization ?? ""}
            onChange={(e) => setCfgField("organization", e.target.value)}
          />
        </label>
      </section>

      {/* 公開ページの内容 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t("publicPage")}</h2>
        <label className={styles.field}>
          <span className={styles.label}>{t("instructorIntro")}</span>
          <textarea
            className={styles.textarea}
            value={cfg.instructorIntro ?? ""}
            rows={3}
            onChange={(e) => setCfgField("instructorIntro", e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>{t("access")}</span>
          <textarea
            className={styles.textarea}
            value={cfg.access ?? ""}
            rows={2}
            onChange={(e) => setCfgField("access", e.target.value)}
          />
        </label>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={cfg.showCalendar !== false}
            onChange={(e) => setCfgField("showCalendar", e.target.checked)}
          />
          <span>{t("showCalendar")}</span>
        </label>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={cfg.showContact !== false}
            onChange={(e) => setCfgField("showContact", e.target.checked)}
          />
          <span>{t("showContact")}</span>
        </label>
      </section>

      {/* 問い合わせ先 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t("contact")}</h2>
        <label className={styles.field}>
          <span className={styles.label}>{t("contactEmail")}</span>
          <input
            className={styles.input}
            value={cfg.contactEmail ?? ""}
            onChange={(e) => setCfgField("contactEmail", e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>{t("contactPhone")}</span>
          <input
            className={styles.input}
            value={cfg.contactPhone ?? ""}
            onChange={(e) => setCfgField("contactPhone", e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>{t("contactUrl")}</span>
          <input
            className={styles.input}
            value={cfg.contactUrl ?? ""}
            placeholder="https://…"
            onChange={(e) => setCfgField("contactUrl", e.target.value)}
          />
        </label>
      </section>

      {error ? <p className={styles.error}>{error}</p> : null}
      {message ? <p className={styles.message}>{message}</p> : null}

      <div className={styles.actions}>
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
  );
}
