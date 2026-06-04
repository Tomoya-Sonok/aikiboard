import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/shared/Icon/Icon";
import styles from "./DashboardCards.module.css";

// ガワ表示用のダミーデータ。実データ(カレンダー/お知らせ/フィード)は各機能 PR で差し替える。
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

const ATTENDEES = ["田", "佐", "鈴", "高", "山"];

// ボードホームのダッシュボード本体。現状はダミー表示(ガワ)。
export async function DashboardCards() {
  const t = await getTranslations("boards.dashboard");

  return (
    <div className={styles.grid}>
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.sectionLabel}>
            {t("nextPractice")}
            <span className={styles.muted}>{t("daysUntil", { days: 4 })}</span>
          </span>
          <span className={styles.ghostLink}>
            {t("viewDetail")}
            <Icon name="chevron-right" size={13} />
          </span>
        </div>
        <div className={styles.practiceBody}>
          <div className={styles.dateBlock}>
            <div className={styles.dateMonth}>JUL · 金</div>
            <div className={styles.dateDay}>3</div>
            <div className={styles.dateTime}>19:00 – 21:00</div>
          </div>
          <div className={styles.practiceInfo}>
            <div>
              <div className={styles.practiceTitle}>基本技中心</div>
              <div className={styles.practiceMeta}>
                <span className={styles.metaItem}>
                  <Icon name="map-pin" size={13} className={styles.metaIcon} />
                  第一武道場
                </span>
                <span className={styles.metaItem}>
                  <Icon name="user" size={13} className={styles.metaIcon} />
                  指導 · 田中 一郎(五段)
                </span>
              </div>
            </div>
            <div className={styles.attendance}>
              <div className={styles.statBlock}>
                <span className={`${styles.statValue} ${styles.statYes}`}>
                  4
                </span>
                <span className={styles.statLabel}>{t("attending")}</span>
              </div>
              <span className={styles.statDivider} />
              <div className={styles.statBlock}>
                <span className={`${styles.statValue} ${styles.statNo}`}>
                  1
                </span>
                <span className={styles.statLabel}>{t("declined")}</span>
              </div>
              <span className={styles.statDivider} />
              <div className={styles.statBlock}>
                <span className={`${styles.statValue} ${styles.statUn}`}>
                  1
                </span>
                <span className={styles.statLabel}>{t("pending")}</span>
              </div>
              <span className={styles.spacer} />
              <div className={styles.avatars}>
                {ATTENDEES.map((a) => (
                  <span key={a} className={styles.avatar}>
                    {a}
                  </span>
                ))}
              </div>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.attendBtn}>
                <Icon name="check" size={14} />
                {t("attend")}
              </button>
              <button type="button" className={styles.declineBtn}>
                {t("decline")}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.sectionLabel}>
            {t("announcements")}
            <span className={styles.countPill}>1</span>
          </span>
          <span className={styles.ghostLink}>
            {t("viewAll")}
            <Icon name="chevron-right" size={13} />
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
            <Icon name="chevron-right" size={13} />
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
                    <Icon name="heart" size={13} />
                    {post.likes}
                  </span>
                  <span className={styles.feedAction}>
                    <Icon name="reply" size={13} />
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
