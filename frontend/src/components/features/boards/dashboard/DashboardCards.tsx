"use client";

import { ArrowBendUpLeft, CaretRight, Heart } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { AnnouncementsCard } from "./AnnouncementsCard";
import styles from "./DashboardCards.module.css";
import { NextPracticeCard } from "./NextPracticeCard";

// ガワ表示用のダミーデータ。フィードは各機能 PR で実データに差し替える。
const FEED = [
  {
    id: 1,
    author: "鈴木 太郎",
    initial: "鈴",
    role: "メンバー",
    time: "2時間前",
    body: "今日の稽古で四方投げのコツが少し掴めた気がします。入身の角度を意識したら相手の崩しがスムーズに。",
    likes: 4,
    replies: 2,
  },
];

type Props = {
  boardId: string;
  slug: string;
};

// ボードホームのダッシュボード本体。「次の稽古」「お知らせ」は実データ、フィードは
// 各機能 PR で差し替える。
export function DashboardCards({ boardId, slug }: Props) {
  const t = useTranslations("boards.dashboard");

  return (
    <div className={styles.grid}>
      <NextPracticeCard boardId={boardId} slug={slug} />

      <AnnouncementsCard boardId={boardId} slug={slug} />

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.sectionLabel}>{t("recentFeed")}</span>
          <span className={styles.ghostLink}>
            {t("toFeed")}
            <CaretRight size={13} />
          </span>
        </div>
        <div>
          {FEED.map((post) => (
            <div key={post.id} className={styles.feedRow}>
              <span className={styles.feedAvatar}>{post.initial}</span>
              <div className={styles.feedMain}>
                <div className={styles.feedHead}>
                  <span className={styles.feedAuthor}>{post.author}</span>
                  <span className={styles.feedRole}>{post.role}</span>
                  <span className={styles.feedTime}>· {post.time}</span>
                </div>
                <div className={styles.feedBody}>{post.body}</div>
                <div className={styles.feedActions}>
                  <span className={styles.feedAction}>
                    <Heart size={13} />
                    {post.likes}
                  </span>
                  <span className={styles.feedAction}>
                    <ArrowBendUpLeft size={13} />
                    {post.replies}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
