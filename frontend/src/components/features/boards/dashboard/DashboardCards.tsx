"use client";

import { ArrowBendUpLeft, CaretRight, Heart } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import styles from "./DashboardCards.module.css";
import { NextPracticeCard } from "./NextPracticeCard";

// ガワ表示用のダミーデータ。お知らせ/フィードは各機能 PR で実データに差し替える。
const ANNOUNCEMENTS = [
  {
    id: 1,
    title: "7月の審査について",
    excerpt:
      "7月14日に昇級・昇段審査を実施します。受験希望者は7月7日までにお知らせください。",
    date: "06/20",
    read: false,
  },
  {
    id: 2,
    title: "夏季合宿のご案内",
    excerpt:
      "8月10日〜12日、箱根にて夏季合宿を予定しています。詳細は追ってお知らせします。",
    date: "06/15",
    read: true,
  },
  {
    id: 3,
    title: "道場清掃のお願い",
    excerpt: "6月28日の稽古後に大掃除を行います。雑巾等をご持参ください。",
    date: "06/10",
    read: true,
  },
];

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

// ボードホームのダッシュボード本体。「次の稽古」は実データ、お知らせ/フィードは各機能 PR で差し替える。
export function DashboardCards({ boardId, slug }: Props) {
  const t = useTranslations("boards.dashboard");

  return (
    <div className={styles.grid}>
      <NextPracticeCard boardId={boardId} slug={slug} />

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.sectionLabel}>
            {t("announcements")}
            <span className={styles.countPill}>1</span>
          </span>
          <span className={styles.ghostLink}>
            {t("viewAll")}
            <CaretRight size={13} />
          </span>
        </div>
        <div>
          {ANNOUNCEMENTS.map((a, i) => (
            <div
              key={a.id}
              className={`${styles.announceRow} ${i === 0 ? "" : styles.borderTop}`}
            >
              <span
                className={`${styles.unreadDot} ${a.read ? styles.readDot : ""}`}
              />
              <div className={styles.announceMain}>
                <div
                  className={`${styles.announceTitle} ${a.read ? styles.announceTitleRead : ""}`}
                >
                  {a.title}
                </div>
                <div className={styles.announceExcerpt}>{a.excerpt}</div>
              </div>
              <div className={styles.announceDate}>{a.date}</div>
            </div>
          ))}
        </div>
      </section>

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
