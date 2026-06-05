"use client";

// 道場(public."DojoStyleMaster")を検索して1件選ぶオートコンプリート。
// AikiNote の DojoStyleAutocomplete の仕様に準拠:
//   - 300ms デバウンスで検索、候補ドロップダウン(オーバーレイ)
//   - キーボード操作(↑↓ で移動・Enter 選択・Esc 閉じる)+ ARIA combobox/listbox
//   - 候補は道場名のみ表示(+ 承認済みバッジ)。外側クリックで閉じる
//   - 選択後は「道場名(タップで再編集)+ クリア(×)」表示
// 検索関数は注入(searchDojos)するため Storybook / テストでモックできる。
// 紐付けは MVP では単一選択(先頭 = primary)。複数紐付け・新規道場追加は将来対応。

import { CheckCircle, X } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import styles from "./DojoMasterSelect.module.css";

export type DojoMaster = {
  id: string;
  dojo_name: string;
  dojo_name_kana: string | null;
  is_approved?: boolean;
};

type DojoMasterSelectProps = {
  label: string;
  value: DojoMaster | null;
  onChange: (dojo: DojoMaster | null) => void;
  searchDojos: (query: string) => Promise<DojoMaster[]>;
  error?: string;
  required?: boolean;
};

export function DojoMasterSelect({
  label,
  value,
  onChange,
  searchDojos,
  error,
  required,
}: DojoMasterSelectProps) {
  const t = useTranslations("boards.create");
  const inputId = useId();
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["dojoMasters", debounced],
    queryFn: () => searchDojos(debounced),
    enabled: debounced.length > 0 && !value,
  });

  // 新しい検索語になったらハイライト位置とドロップダウンの開閉を整える。
  useEffect(() => {
    setActiveIndex(-1);
    if (!value && debounced.length > 0) {
      setIsOpen(true);
    }
  }, [debounced, value]);

  // 外側クリックでドロップダウンを閉じる。
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const requiredMark = required ? (
    <span className={styles.required} aria-hidden="true">
      *
    </span>
  ) : null;

  const handleSelect = (dojo: DojoMaster) => {
    onChange(dojo);
    setQuery("");
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) {
      return;
    }
    const total = results.length;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
        break;
      case "Enter":
        if (activeIndex >= 0 && activeIndex < total) {
          e.preventDefault();
          handleSelect(results[activeIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  // 選択済み状態: 道場名(タップで再編集)+ クリアボタン。
  if (value) {
    const enterEdit = () => {
      const name = value.dojo_name;
      onChange(null);
      setQuery(name);
      setIsOpen(true);
      requestAnimationFrame(() => inputRef.current?.focus());
    };
    return (
      <div className={styles.field} ref={containerRef}>
        <span className={styles.label}>
          {label}
          {requiredMark}
        </span>
        <div className={styles.selected}>
          <button
            type="button"
            className={styles.selectedTextButton}
            onClick={enterEdit}
            aria-label={t("dojoEdit")}
          >
            <span className={styles.selectedName}>{value.dojo_name}</span>
          </button>
          <button
            type="button"
            className={styles.clearButton}
            onClick={() => {
              onChange(null);
              setQuery("");
            }}
            aria-label={t("dojoClear")}
          >
            <X size={16} weight="bold" />
          </button>
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
      </div>
    );
  }

  const activeOptionId =
    activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined;

  return (
    <div className={styles.field} ref={containerRef}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
        {requiredMark}
      </label>
      <div className={styles.control}>
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          autoComplete="off"
          className={`${styles.input} ${error ? styles.inputError : ""}`}
          placeholder={t("dojoSearchPlaceholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            if (debounced.length > 0) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          aria-invalid={error ? true : undefined}
        />
        {isOpen && debounced.length > 0 ? (
          <div className={styles.dropdown} id={listboxId} role="listbox">
            {isFetching ? (
              <div className={styles.stateItem}>{t("dojoSearching")}</div>
            ) : results.length === 0 ? (
              <div className={styles.stateItem}>{t("dojoNoResults")}</div>
            ) : (
              results.map((dojo, index) => (
                <button
                  key={dojo.id}
                  type="button"
                  id={`${listboxId}-opt-${index}`}
                  className={`${styles.suggestionItem} ${index === activeIndex ? styles.active : ""}`}
                  onClick={() => handleSelect(dojo)}
                  onMouseEnter={() => setActiveIndex(index)}
                  role="option"
                  aria-selected={index === activeIndex}
                >
                  <span className={styles.suggestionName}>
                    {dojo.dojo_name}
                  </span>
                  {dojo.is_approved ? (
                    <span className={styles.approvedBadge}>
                      <CheckCircle size={14} weight="fill" />
                      <span className={styles.approvedText}>
                        {t("dojoApproved")}
                      </span>
                    </span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
