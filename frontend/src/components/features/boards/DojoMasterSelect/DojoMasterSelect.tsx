"use client";

// 道場(public."DojoStyleMaster")を検索して1件選ぶ combobox。
// 検索関数は注入(searchDojos)するため Storybook / テストでモックできる。
// 紐付けは MVP では単一選択(先頭 = primary)。複数紐付けは将来対応。

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import styles from "./DojoMasterSelect.module.css";

export type DojoMaster = {
  id: string;
  dojo_name: string;
  dojo_name_kana: string | null;
};

type DojoMasterSelectProps = {
  label: string;
  value: DojoMaster | null;
  onChange: (dojo: DojoMaster | null) => void;
  searchDojos: (query: string) => Promise<DojoMaster[]>;
  error?: string;
};

export function DojoMasterSelect({
  label,
  value,
  onChange,
  searchDojos,
  error,
}: DojoMasterSelectProps) {
  const t = useTranslations("boards.create");
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["dojoMasters", debounced],
    queryFn: () => searchDojos(debounced),
    enabled: debounced.length > 0 && !value,
  });

  if (value) {
    return (
      <div className={styles.field}>
        <span className={styles.label}>{label}</span>
        <div className={styles.selected}>
          <span className={styles.selectedName}>{value.dojo_name}</span>
          <button
            type="button"
            className={styles.clearButton}
            onClick={() => {
              onChange(null);
              setQuery("");
            }}
          >
            {t("dojoChange")}
          </button>
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
      </div>
    );
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        autoComplete="off"
        className={`${styles.input} ${error ? styles.inputError : ""}`}
        placeholder={t("dojoSearchPlaceholder")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {debounced.length > 0 ? (
        <ul className={styles.results}>
          {isFetching ? (
            <li className={styles.resultEmpty}>{t("dojoSearching")}</li>
          ) : results.length === 0 ? (
            <li className={styles.resultEmpty}>{t("dojoNoResults")}</li>
          ) : (
            results.map((dojo) => (
              <li key={dojo.id}>
                <button
                  type="button"
                  className={styles.resultItem}
                  onClick={() => {
                    onChange(dojo);
                    setQuery("");
                  }}
                >
                  <span className={styles.resultName}>{dojo.dojo_name}</span>
                  {dojo.dojo_name_kana ? (
                    <span className={styles.resultKana}>
                      {dojo.dojo_name_kana}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
