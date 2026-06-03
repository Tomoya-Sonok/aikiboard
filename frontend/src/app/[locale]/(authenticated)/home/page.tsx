"use client";

// 認証後のプレースホルダーホーム。ログイン中の表示とログアウトを確認するための最小画面。
// PR-D で所属ボード一覧(/boards)に差し替える。

import { useTranslations } from "next-intl";
import { Button } from "@/components/shared/Button/Button";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRouter } from "@/lib/i18n/routing";
import styles from "./home.module.css";

export default function HomePage() {
  const t = useTranslations("auth.home");
  const router = useRouter();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <p className={styles.greeting}>
          {t("greeting", { name: user?.username ?? user?.email ?? "" })}
        </p>
        <Button variant="secondary" onClick={handleSignOut}>
          {t("signOut")}
        </Button>
      </div>
    </main>
  );
}
