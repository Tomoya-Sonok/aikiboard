import { useTranslations } from "next-intl";
import styles from "./page.module.css";

export default function HomePage() {
  const t = useTranslations("welcome");

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.subtitle}>{t("subtitle")}</p>
        <p className={styles.phase}>{t("phase")}</p>
      </div>
    </main>
  );
}
