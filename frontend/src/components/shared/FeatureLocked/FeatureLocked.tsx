"use client";

import { LockSimple } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import styles from "./FeatureLocked.module.css";

type Props = {
  // 機能名(例: "アクティビティログ")。見出しに使う。
  featureName: string;
};

// 有料機能が契約プランに含まれない(Free 等)ときに表示する PRO アップセル。
// アクティビティログ・アーカイブ・会計・公開ページなどで共通利用する。
// 決済(プラン変更)は別途実装のため、ここでは案内のみ。
export function FeatureLocked({ featureName }: Props) {
  const t = useTranslations("boards.featureLocked");
  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <span className={styles.iconWrap}>
          <LockSimple size={28} weight="fill" />
        </span>
        <h2 className={styles.title}>{t("title", { feature: featureName })}</h2>
        <p className={styles.desc}>{t("description")}</p>
        <span className={styles.note}>{t("note")}</span>
      </div>
    </div>
  );
}
