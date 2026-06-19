"use client";

import {
  Buildings,
  EnvelopeSimple,
  Globe,
  MapPin,
  Phone,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import type { PublicBoard } from "@/lib/types/publicBoard";
import { PublicCalendar } from "../PublicCalendar/PublicCalendar";
import styles from "./PublicBoardView.module.css";

type Props = {
  board: PublicBoard;
};

// 道場の公開ページ(未認証でも閲覧可)。プロフィール + 公開カレンダー + 問い合わせ導線。
export function PublicBoardView({ board }: Props) {
  const t = useTranslations("public");
  const cfg = board.publicPageConfig ?? {};
  const showCalendar = cfg.showCalendar !== false;
  const showContact = cfg.showContact !== false;
  const hasContact = Boolean(
    cfg.contactEmail || cfg.contactPhone || cfg.contactUrl,
  );
  const initial = Array.from(board.name)[0] ?? "道";

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        {board.logoUrl ? (
          // biome-ignore lint/performance/noImgElement: 任意ドメインのロゴ。next/image の remotePatterns 設定を避ける
          <img src={board.logoUrl} alt="" className={styles.logo} />
        ) : (
          <span className={styles.logoFallback}>{initial}</span>
        )}
        <div className={styles.heroMain}>
          <h1 className={styles.name}>{board.name}</h1>
          {board.dojoNames.length > 0 ? (
            <p className={styles.dojos}>
              <Buildings size={14} />
              {board.dojoNames.join(" / ")}
            </p>
          ) : null}
          {cfg.organization ? (
            <p className={styles.org}>{cfg.organization}</p>
          ) : null}
        </div>
      </header>

      {board.description ? (
        <section className={styles.section}>
          <p className={styles.description}>{board.description}</p>
        </section>
      ) : null}

      {cfg.instructorIntro ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("instructor")}</h2>
          <p className={styles.text}>{cfg.instructorIntro}</p>
        </section>
      ) : null}

      {cfg.access ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <MapPin size={16} />
            {t("access")}
          </h2>
          <p className={styles.text}>{cfg.access}</p>
        </section>
      ) : null}

      {showCalendar ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("calendar")}</h2>
          <PublicCalendar slug={board.slug} />
        </section>
      ) : null}

      {showContact && hasContact ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("contact")}</h2>
          <div className={styles.contacts}>
            {cfg.contactEmail ? (
              <a className={styles.contact} href={`mailto:${cfg.contactEmail}`}>
                <EnvelopeSimple size={16} />
                {cfg.contactEmail}
              </a>
            ) : null}
            {cfg.contactPhone ? (
              <a className={styles.contact} href={`tel:${cfg.contactPhone}`}>
                <Phone size={16} />
                {cfg.contactPhone}
              </a>
            ) : null}
            {cfg.contactUrl ? (
              <a
                className={styles.contact}
                href={cfg.contactUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Globe size={16} />
                {t("website")}
              </a>
            ) : null}
          </div>
        </section>
      ) : null}

      <footer className={styles.footer}>
        <Link href="/login" className={styles.memberLink}>
          {t("memberLogin")}
        </Link>
        <span className={styles.brand}>AikiBoard</span>
      </footer>
    </div>
  );
}
