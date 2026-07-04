import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import styles from "./page.module.css";

// トップページ(暫定)。本格的な LP は roadmap R3-1 で実装予定。
// 現段階では新規登録・ログインへの導線を提供することが役割。
export default function HomePage() {
  const t = useTranslations("welcome");

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.subtitle}>{t("subtitle")}</p>
        <div className={styles.actions}>
          <Link href="/signup" className={styles.primaryAction}>
            {t("signupCta")}
          </Link>
          <Link href="/login" className={styles.secondaryAction}>
            {t("loginCta")}
          </Link>
        </div>
        <p className={styles.phase}>{t("phase")}</p>
      </div>
    </main>
  );
}
