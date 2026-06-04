// ボードホームのダッシュボード本体。シェル(サイドバー/ヘッダー)とメンバーガードは
// layout.tsx が提供する。次の稽古 / お知らせ / フィードのカードは後続 PR で追加する。

import { getTranslations } from "next-intl/server";
import styles from "./page.module.css";

export default async function BoardHomePage() {
  const t = await getTranslations("boards.dashboard");
  return (
    <div className={styles.placeholder}>
      <p>{t("preparing")}</p>
    </div>
  );
}
