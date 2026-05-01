/**
 * AikiBoard — Claude Design Prototype (consolidated single-file TSX)
 *
 * Source: Claude Design session 9l9jPoIgRdAU1xPUptUzNA
 *         (handoff bundle "AikiBoard Prototype")
 *
 * 6 フレーム(PC × 3 + SP × 3)のハイファイ・プロトタイプを 1 ファイルに統合した
 * 視覚リファレンス。`docs/design/02_tokens.css` がデザイントークンの正であり、
 * 本ファイル冒頭にも同内容を埋め込んで自己完結させている(両者を同期維持すること)。
 *
 * デザイン方針は `docs/requirements.md` 9 章 / `docs/design/01_design-brief.md` を参照。
 *
 * 開き方: Vite または Next.js の React playground にコピーすればそのまま動作する。
 *   - Vite:    `pnpm create vite my-prototype --template react-ts` → src/App.tsx に貼り替え
 *   - Next.js: app/page.tsx として配置(本ファイルは "use client" を必要としない純粋 client コンポーネント)
 *
 * 元バンドルにあった Claude Design 固有の足場(pan/zoom キャンバス、リネーム UI、
 * フォーカスオーバーレイ、サイドカー永続化)は省略し、6 フレーム本体のみに絞った。
 */

import React, { useEffect, useState } from "react";

// ──────────────────────────────────────────────────────────────────────────────
// 1. Tokens (synced from docs/design/02_tokens.css — keep them identical)
// ──────────────────────────────────────────────────────────────────────────────

const TOKENS_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Zen+Old+Mincho:wght@500;600;700&family=Noto+Sans+JP:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');

:root {
  /* ── ブランド基調色(3 色基調) ─────────────────────────── */
  --ab-sumi: #2C2C2C;
  --ab-sumi-light: #3E3E3C;
  --ab-dou: #C4956A;
  --ab-dou-light: #D4AD87;
  --ab-dou-soft: #F3E7D8;
  --ab-washi: #F5F3EF;
  --ab-washi-dark: #EBE8E2;

  /* ── 面(Surface) ────────────────────────────────────── */
  --ab-surface-canvas: var(--ab-washi);
  --ab-surface-card: #FFFFFF;
  --ab-surface-card-alt: #FAF8F4;
  --ab-surface-nav: var(--ab-sumi);
  --ab-surface-inverse: var(--ab-sumi);
  --ab-overlay: rgba(44, 44, 44, 0.45);

  /* ── テキスト ────────────────────────────────────────── */
  --ab-text-primary: #2C2C2C;
  --ab-text-secondary: #5F5E5C;
  --ab-text-tertiary: #8A8A8A;
  --ab-text-disabled: #B8B5AF;
  --ab-text-inverse: #FFFFFF;
  --ab-text-link: #2E4F6E;
  --ab-text-on-brand: #FFFFFF;

  /* ── ボーダー ────────────────────────────────────────── */
  --ab-border-default: #E8E4DF;
  --ab-border-strong: #D6D1C9;
  --ab-border-subtle: #F0EDE7;
  --ab-border-focus: var(--ab-dou);

  /* ── セマンティック ──────────────────────────────────── */
  --ab-success: #5B8C5A;
  --ab-success-soft: #E4EEE2;
  --ab-danger: #C25550;
  --ab-danger-soft: #F5E1DF;
  --ab-warning: #DAA83E;
  --ab-warning-soft: #FAEFD6;
  --ab-info: #2E4F6E;
  --ab-info-soft: #E0E7EE;

  /* ── ロール識別色 ──────────────────────────────────── */
  --ab-role-owner: #8E3E3A;
  --ab-role-admin: #2E4F6E;
  --ab-role-member: #5F5E5C;

  /* ── 出欠色 ──────────────────────────────────────────── */
  --ab-attend-yes: var(--ab-success);
  --ab-attend-no: var(--ab-danger);
  --ab-attend-undecided: var(--ab-text-tertiary);

  /* ── タイポグラフィ ──────────────────────────────────── */
  --ab-font-brand: "Zen Old Mincho", "Times New Roman", "Noto Serif JP", serif;
  --ab-font-ui: "Inter", "Noto Sans JP", "Hiragino Sans",
                 "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif;
  --ab-font-num: "Inter", "SF Mono", ui-monospace, monospace;

  --ab-fs-xs: 11px;
  --ab-fs-sm: 12px;
  --ab-fs-base: 14px;
  --ab-fs-md: 15px;
  --ab-fs-lg: 16px;
  --ab-fs-xl: 18px;
  --ab-fs-2xl: 22px;
  --ab-fs-3xl: 28px;
  --ab-fs-4xl: 36px;

  --ab-fw-regular: 400;
  --ab-fw-medium: 500;
  --ab-fw-semibold: 600;
  --ab-fw-bold: 700;

  --ab-lh-tight: 1.3;
  --ab-lh-normal: 1.55;
  --ab-lh-loose: 1.75;

  /* ── 余白(4px グリッド) ────────────────────────────── */
  --ab-space-0: 0;
  --ab-space-1: 4px;
  --ab-space-2: 8px;
  --ab-space-3: 12px;
  --ab-space-4: 16px;
  --ab-space-5: 20px;
  --ab-space-6: 24px;
  --ab-space-8: 32px;
  --ab-space-10: 40px;
  --ab-space-12: 48px;
  --ab-space-16: 64px;
  --ab-space-20: 80px;

  /* ── 角丸(管理ツール寄りに小さめ) ────────────────────── */
  --ab-radius-none: 0;
  --ab-radius-sm: 3px;
  --ab-radius-md: 6px;
  --ab-radius-lg: 8px;
  --ab-radius-xl: 12px;
  --ab-radius-pill: 9999px;

  /* ── 影(控えめ) ────────────────────────────────────── */
  --ab-shadow-xs: 0 1px 2px rgba(44, 44, 44, 0.04);
  --ab-shadow-sm: 0 1px 3px rgba(44, 44, 44, 0.06);
  --ab-shadow-md: 0 2px 10px rgba(44, 44, 44, 0.08);
  --ab-shadow-lg: 0 8px 28px rgba(44, 44, 44, 0.12);
  --ab-shadow-inner: inset 0 0 0 1px var(--ab-border-default);

  /* ── レイアウト(PC 1440px 基準) ────────────────────── */
  --ab-layout-sidebar-w: 228px;
  --ab-layout-sidebar-w-collapsed: 58px;
  --ab-layout-header-h: 56px;
  --ab-layout-container-max: 1280px;
  --ab-layout-content-pad: 32px;
  --ab-layout-gutter: 24px;

  /* ── z-index ──────────────────────────────────────── */
  --ab-z-sticky: 10;
  --ab-z-header: 20;
  --ab-z-dropdown: 30;
  --ab-z-drawer: 30;
  --ab-z-modal: 40;
  --ab-z-toast: 50;

  /* ── モーション ──────────────────────────────────── */
  --ab-duration-fast: 120ms;
  --ab-duration-base: 180ms;
  --ab-duration-slow: 280ms;
  --ab-ease-standard: cubic-bezier(0.2, 0, 0.2, 1);
  --ab-ease-emphasized: cubic-bezier(0.2, 0, 0, 1);

  /* ── フォーカスリング ──────────────────────────────── */
  --ab-focus-ring: 0 0 0 2px var(--ab-surface-card),
                   0 0 0 4px var(--ab-dou);
}

/* 道場別テーマプリセット(10 色) */
:root {
  --ab-theme-primary: var(--ab-sumi);
  --ab-theme-primary-soft: #E3E0DB;
  --ab-theme-on-primary: #FFFFFF;
}
[data-dojo-theme="sumi"]      { --ab-theme-primary: #2C2C2C; --ab-theme-primary-soft: #E3E0DB; --ab-theme-on-primary: #FFFFFF; }
[data-dojo-theme="dou"]       { --ab-theme-primary: #C4956A; --ab-theme-primary-soft: #F3E7D8; --ab-theme-on-primary: #FFFFFF; }
[data-dojo-theme="fukamidori"]{ --ab-theme-primary: #3B5F4A; --ab-theme-primary-soft: #E0E9E3; --ab-theme-on-primary: #FFFFFF; }
[data-dojo-theme="ai"]        { --ab-theme-primary: #2E4F6E; --ab-theme-primary-soft: #E0E7EE; --ab-theme-on-primary: #FFFFFF; }
[data-dojo-theme="enji"]      { --ab-theme-primary: #8E3E3A; --ab-theme-primary-soft: #F0DEDC; --ab-theme-on-primary: #FFFFFF; }
[data-dojo-theme="yamabuki"]  { --ab-theme-primary: #DAA83E; --ab-theme-primary-soft: #FAEFD6; --ab-theme-on-primary: #2C2C2C; }
[data-dojo-theme="shikon"]    { --ab-theme-primary: #3C2F6B; --ab-theme-primary-soft: #E1DEEC; --ab-theme-on-primary: #FFFFFF; }
[data-dojo-theme="toki"]      { --ab-theme-primary: #E99387; --ab-theme-primary-soft: #FAE1DE; --ab-theme-on-primary: #2C2C2C; }
[data-dojo-theme="usuzumi"]   { --ab-theme-primary: #7A7673; --ab-theme-primary-soft: #E8E6E3; --ab-theme-on-primary: #FFFFFF; }
[data-dojo-theme="nezumi"]    { --ab-theme-primary: #5F5E5C; --ab-theme-primary-soft: #E4E3E1; --ab-theme-on-primary: #FFFFFF; }

/* プロトタイプ全体のリセット
   - Vite/CRA テンプレート同梱の App.css には #root { text-align: center } が
     含まれることが多く、何もしないとサイドバーや本文の左寄せがすべて中央寄せに
     見えてしまう。ルートに text-align: left を立てて、継承で配下に流す。
   - 子孫要素には明示的に text-align を再設定しない。そうすることで、
     日付ブロック等が style={{ textAlign: "center" }} を立てたときに
     その配下が継承で正しく中央揃えになる。 */
.ab-prototype-root,
.ab-prototype-root * { box-sizing: border-box; }
.ab-prototype-root { text-align: left; }
.ab-prototype-root button { font-family: inherit; }
.ab-prototype-root :focus-visible { outline: 2px solid var(--ab-dou); outline-offset: 1px; }
`;

function useTokensCSS(): void {
  useEffect(() => {
    const id = "ab-prototype-tokens";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = TOKENS_CSS;
    document.head.appendChild(style);
  }, []);
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. Types
// ──────────────────────────────────────────────────────────────────────────────

type Role = "owner" | "admin" | "member";

type DojoTheme =
  | "sumi"
  | "dou"
  | "fukamidori"
  | "ai"
  | "enji"
  | "yamabuki"
  | "shikon"
  | "toki"
  | "usuzumi"
  | "nezumi";

interface Member {
  id: number;
  name: string;
  first: string;
  role: Role;
  dan: string;
  initial: string;
}

interface Dojo {
  id: number;
  name: string;
  short: string;
  theme: DojoTheme;
  org: string;
}

interface DojoEvent {
  id: string;
  time: string;
  place: string;
  instructor: number;
  note: string;
  attending: number[];
  declined: number[];
}

interface Announcement {
  id: number;
  title: string;
  date: string;
  read: boolean;
  excerpt: string;
}

interface FeedPost {
  id: number;
  authorId: number;
  time: string;
  text: string;
  likes: number;
  replies: number;
  aikinote: boolean;
}

interface ActivityEntry {
  id: number;
  who: string;
  verb: string;
  time: string;
  kind: "calendar" | "announce" | "rsvp-yes" | "rsvp-no" | "feed" | "invite" | "money";
}

interface AttendanceWeek {
  w: string;
  rate: number;
}

type Screen = "home" | "calendar" | "announce" | "feed" | "archive" | "money" | "members" | "activity" | "settings" | "more";

interface NavItem {
  id: Screen;
  label: string;
  icon: IconName;
  badge?: number;
  pro?: boolean;
}

type IconName =
  | "home"
  | "calendar"
  | "megaphone"
  | "feed"
  | "archive"
  | "yen"
  | "users"
  | "activity"
  | "settings"
  | "search"
  | "bell"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "chevron-double-left"
  | "plus"
  | "close"
  | "check"
  | "heart"
  | "reply"
  | "share"
  | "link"
  | "menu"
  | "edit"
  | "map-pin"
  | "clock"
  | "user"
  | "aikinote"
  | "globe"
  | "lock";

// ──────────────────────────────────────────────────────────────────────────────
// 3. Mock data (source: 01_design-brief.md §7)
// ──────────────────────────────────────────────────────────────────────────────

const DOJOS: Dojo[] = [
  { id: 1, name: "蕨合気道会",   short: "蕨", theme: "sumi",       org: "公益財団法人合気会" },
  { id: 2, name: "合気道養神館", short: "養", theme: "fukamidori", org: "公益財団法人合気道養神会" },
];

const MEMBERS: Member[] = [
  { id: 1, name: "田中 一郎",   first: "一郎",   role: "owner",  dan: "五段", initial: "田" },
  { id: 2, name: "佐藤 花子",   first: "花子",   role: "admin",  dan: "三段", initial: "佐" },
  { id: 3, name: "鈴木 太郎",   first: "太郎",   role: "member", dan: "初段", initial: "鈴" },
  { id: 4, name: "山田 美咲",   first: "美咲",   role: "member", dan: "二段", initial: "山" },
  { id: 5, name: "高橋 健一",   first: "健一",   role: "member", dan: "1級",  initial: "高" },
  { id: 6, name: "伊藤 さくら", first: "さくら", role: "member", dan: "3級",  initial: "伊" },
];

const MEMBER_BY_ID: Record<number, Member> = Object.fromEntries(
  MEMBERS.map((m) => [m.id, m]),
);

// 2026年7月。キーは「日」。
const EVENTS: Record<number, DojoEvent[]> = {
  3:  [{ id: "e3",  time: "19:00–21:00", place: "第一武道場", instructor: 1, note: "基本技中心", attending: [1, 2, 3, 5],          declined: [4] }],
  5:  [{ id: "e5",  time: "10:00–13:00", place: "第一武道場", instructor: 2, note: "自由稽古",   attending: [1, 3, 6],             declined: [2] }],
  7:  [{ id: "e7",  time: "19:00–21:00", place: "第一武道場", instructor: 2, note: "",           attending: [1, 5],                declined: [] }],
  10: [{ id: "e10", time: "19:00–21:00", place: "第一武道場", instructor: 1, note: "",           attending: [2, 4],                declined: [] }],
  12: [{ id: "e12", time: "10:00–13:00", place: "第一武道場", instructor: 1, note: "体験会",     attending: [1, 2, 6],             declined: [] }],
  14: [{ id: "e14", time: "19:00–21:00", place: "第二武道場", instructor: 1, note: "審査稽古",   attending: [1, 2, 3, 4, 5, 6],    declined: [] }],
  17: [{ id: "e17", time: "19:00–21:00", place: "第一武道場", instructor: 2, note: "",           attending: [1, 5],                declined: [3] }],
  21: [{ id: "e21", time: "19:00–21:00", place: "第一武道場", instructor: 1, note: "",           attending: [],                    declined: [] }],
  24: [{ id: "e24", time: "19:00–21:00", place: "第一武道場", instructor: 1, note: "武器技",     attending: [2, 3, 4],             declined: [6] }],
  28: [{ id: "e28", time: "19:00–21:00", place: "第一武道場", instructor: 2, note: "",           attending: [1],                   declined: [] }],
};

const ANNOUNCEMENTS: Announcement[] = [
  { id: 1, title: "7月の審査について", date: "2026.06.20", read: false, excerpt: "7月14日に昇級・昇段審査を実施します。受験希望者は7月7日までに田中師範までお知らせください。" },
  { id: 2, title: "夏季合宿のご案内",   date: "2026.06.15", read: true,  excerpt: "8月10日〜12日、箱根にて夏季合宿を予定しています。詳細は追ってお知らせします。" },
  { id: 3, title: "道場清掃のお願い",   date: "2026.06.10", read: true,  excerpt: "6月28日の稽古後に大掃除を行います。雑巾等をご持参ください。" },
];

const FEED_POSTS: FeedPost[] = [
  { id: 1, authorId: 3, time: "2時間前", text: "今日の稽古で四方投げのコツが少し掴めた気がします。入身の角度を意識したら相手の崩しがスムーズに。", likes: 4, replies: 2, aikinote: true  },
  { id: 2, authorId: 4, time: "5時間前", text: "来週の審査稽古、参加します!一緒に頑張りましょう。",                                                  likes: 6, replies: 3, aikinote: false },
  { id: 3, authorId: 1, time: "1日前",   text: "本日の稽古お疲れ様でした。暑い中、皆さんよく頑張りました。水分補給をしっかりしてください。",         likes: 8, replies: 1, aikinote: false },
];

const ACTIVITY: ActivityEntry[] = [
  { id: 1, who: "田中 一郎", verb: "が7月21日の稽古を追加しました",     time: "3時間前",     kind: "calendar" },
  { id: 2, who: "佐藤 花子", verb: "がお知らせ「7月の審査について」を投稿", time: "5時間前", kind: "announce" },
  { id: 3, who: "鈴木 太郎", verb: "が7月3日の稽古に参加表明",          time: "6時間前",     kind: "rsvp-yes" },
  { id: 4, who: "山田 美咲", verb: "が7月3日の稽古を不参加に変更",       time: "8時間前",     kind: "rsvp-no" },
  { id: 5, who: "高橋 健一", verb: "がフィードに投稿",                    time: "昨日 20:14", kind: "feed" },
  { id: 6, who: "田中 一郎", verb: "が伊藤 さくらをメンバーに招待",        time: "昨日 09:02", kind: "invite" },
  { id: 7, who: "佐藤 花子", verb: "が会計「6月月謝」を更新",              time: "2日前",     kind: "money" },
];

const ATTENDANCE_WEEKS: AttendanceWeek[] = [
  { w: "W1", rate: 68 },
  { w: "W2", rate: 82 },
  { w: "W3", rate: 100 },
  { w: "W4", rate: 56 },
  { w: "W5", rate: 33 },
];

// ──────────────────────────────────────────────────────────────────────────────
// 4. Primitives — Avatar / Icon / RoleTag
// ──────────────────────────────────────────────────────────────────────────────

interface AvatarProps {
  member: Pick<Member, "initial" | "role">;
  size?: number;
  ring?: boolean;
}
function Avatar({ member, size = 28, ring = false }: AvatarProps): JSX.Element {
  const roleColor = {
    owner:  "var(--ab-role-owner)",
    admin:  "var(--ab-role-admin)",
    member: "var(--ab-role-member)",
  }[member.role || "member"];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: "var(--ab-washi-dark)",
        color: roleColor,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--ab-font-brand)",
        fontWeight: 600,
        fontSize: Math.round(size * 0.42),
        letterSpacing: 0,
        boxShadow: ring
          ? "inset 0 0 0 1.5px var(--ab-border-strong)"
          : "inset 0 0 0 1px var(--ab-border-default)",
        userSelect: "none",
      }}
    >
      {member.initial}
    </div>
  );
}

interface IconProps {
  name: IconName;
  size?: number;
  stroke?: number;
  style?: React.CSSProperties;
}
function Icon({ name, size = 16, stroke = 1.5, style }: IconProps): JSX.Element | null {
  const s: React.CSSProperties = { width: size, height: size, display: "inline-block", flexShrink: 0, ...style };
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "home":     return <svg {...common} style={s}><path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/></svg>;
    case "calendar": return <svg {...common} style={s}><rect x="3" y="4.5" width="18" height="16.5" rx="1"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>;
    case "megaphone":return <svg {...common} style={s}><path d="M4 10v4a1 1 0 0 0 1 1h2l8 5V4L7 9H5a1 1 0 0 0-1 1Z"/><path d="M18 8a4 4 0 0 1 0 8"/></svg>;
    case "feed":     return <svg {...common} style={s}><path d="M21 12a9 9 0 1 1-3.2-6.9L21 4v5h-5"/><path d="M8 12h8M8 16h5"/></svg>;
    case "archive":  return <svg {...common} style={s}><rect x="3" y="4" width="18" height="4" rx="0.5"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/></svg>;
    case "yen":      return <svg {...common} style={s}><path d="M7 4l5 8 5-8M7 14h10M7 18h10M12 12v9"/></svg>;
    case "users":    return <svg {...common} style={s}><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3.5-5.5 6.5-5.5S15 16.5 15.5 20"/><circle cx="17" cy="9" r="2.5"/><path d="M22 18c-.3-2.5-2-4-4-4"/></svg>;
    case "activity": return <svg {...common} style={s}><path d="M3 12h4l3-7 4 14 3-7h4"/></svg>;
    case "settings": return <svg {...common} style={s}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>;
    case "search":   return <svg {...common} style={s}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
    case "bell":     return <svg {...common} style={s}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>;
    case "chevron-down":         return <svg {...common} style={s}><path d="m6 9 6 6 6-6"/></svg>;
    case "chevron-left":         return <svg {...common} style={s}><path d="m14 6-6 6 6 6"/></svg>;
    case "chevron-right":        return <svg {...common} style={s}><path d="m10 6 6 6-6 6"/></svg>;
    case "chevron-double-left":  return <svg {...common} style={s}><path d="m14 6-6 6 6 6M20 6l-6 6 6 6"/></svg>;
    case "plus":     return <svg {...common} style={s}><path d="M12 5v14M5 12h14"/></svg>;
    case "close":    return <svg {...common} style={s}><path d="M6 6l12 12M18 6 6 18"/></svg>;
    case "check":    return <svg {...common} style={s}><path d="m4 12 5 5L20 6"/></svg>;
    case "heart":    return <svg {...common} style={s}><path d="M12 20s-7-4.5-9-9a4.5 4.5 0 0 1 9-2 4.5 4.5 0 0 1 9 2c-2 4.5-9 9-9 9Z"/></svg>;
    case "reply":    return <svg {...common} style={s}><path d="M21 20v-4a4 4 0 0 0-4-4H4"/><path d="m9 7-5 5 5 5"/></svg>;
    case "share":    return <svg {...common} style={s}><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14"/></svg>;
    case "link":     return <svg {...common} style={s}><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>;
    case "menu":     return <svg {...common} style={s}><path d="M3 7h18M3 12h18M3 17h18"/></svg>;
    case "edit":     return <svg {...common} style={s}><path d="M12 20H4v-8l10-10 8 8-4 4"/><path d="m14 6 4 4"/></svg>;
    case "map-pin":  return <svg {...common} style={s}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
    case "clock":    return <svg {...common} style={s}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case "user":     return <svg {...common} style={s}><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.5-7 8-7s7 2.5 8 7"/></svg>;
    case "aikinote": return <svg {...common} style={s}><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 3v18M9 8h8M9 13h8M9 17h5"/></svg>;
    case "globe":    return <svg {...common} style={s}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 4 6 4 9s-1.5 6-4 9c-2.5-3-4-6-4-9s1.5-6 4-9Z"/></svg>;
    case "lock":     return <svg {...common} style={s}><rect x="4" y="10" width="16" height="11" rx="1"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/></svg>;
    default:         return null;
  }
}

function RoleTag({ role }: { role: Role }): JSX.Element {
  const map: Record<Role, { label: string; fg: string; bg: string }> = {
    owner:  { label: "オーナー",   fg: "var(--ab-role-owner)",  bg: "rgba(142,62,58,0.08)"  },
    admin:  { label: "アドミン",   fg: "var(--ab-role-admin)",  bg: "rgba(46,79,110,0.08)"  },
    member: { label: "メンバー",   fg: "var(--ab-role-member)", bg: "rgba(95,94,92,0.08)"   },
  };
  const m = map[role] || map.member;
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 0.3,
        color: m.fg,
        background: m.bg,
        padding: "2px 7px",
        borderRadius: 3,
        fontFamily: "var(--ab-font-ui)",
      }}
    >
      {m.label}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// 5. App chrome — Sidebar, Header, SP bars
// ──────────────────────────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { id: "home",     label: "ホーム",         icon: "home" },
  { id: "calendar", label: "カレンダー",     icon: "calendar" },
  { id: "announce", label: "お知らせ",       icon: "megaphone", badge: 1 },
  { id: "feed",     label: "フィード",       icon: "feed" },
  { id: "archive",  label: "アーカイブ",     icon: "archive", pro: true },
  { id: "money",    label: "会計",           icon: "yen", pro: true },
  { id: "members",  label: "メンバー",       icon: "users" },
  { id: "activity", label: "アクティビティ", icon: "activity", pro: true },
  { id: "settings", label: "ボード設定",     icon: "settings" },
];

const SP_TABS: NavItem[] = [
  { id: "home",     label: "ホーム",     icon: "home" },
  { id: "calendar", label: "カレンダー", icon: "calendar" },
  { id: "announce", label: "お知らせ",   icon: "megaphone", badge: 1 },
  { id: "feed",     label: "フィード",   icon: "feed" },
  { id: "more",     label: "その他",     icon: "menu" },
];

interface SidebarProps {
  active?: Screen;
  onNav?: (id: Screen) => void;
  onGoScreen?: (id: Screen) => void;
}
function Sidebar({ active, onNav, onGoScreen }: SidebarProps): JSX.Element {
  return (
    <aside
      style={{
        width: 228,
        flexShrink: 0,
        background: "var(--ab-surface-nav)",
        color: "var(--ab-text-inverse)",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid #1b1b1b",
        fontFamily: "var(--ab-font-ui)",
      }}
    >
      {/* Logo row */}
      <div
        style={{
          height: 56,
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--ab-sumi-light)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--ab-font-brand)",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 1,
            color: "var(--ab-dou)",
          }}
        >
          AikiBoard
        </div>
        <Icon name="chevron-double-left" size={14} style={{ color: "#8a8782", cursor: "pointer" }} />
      </div>

      {/* Workspace switcher */}
      <div
        style={{
          display: "flex",
          padding: "10px 10px 10px 12px",
          gap: 10,
          borderBottom: "1px solid var(--ab-sumi-light)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {DOJOS.map((d, i) => {
            const isActive = i === 0;
            return (
              <div
                key={d.id}
                title={d.name}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: isActive ? "var(--ab-dou)" : "#4a4a48",
                  color: isActive ? "#fff" : "#d8d4cd",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--ab-font-brand)",
                  fontSize: 15,
                  fontWeight: 700,
                  boxShadow: isActive ? "0 0 0 2px #1d1d1d, 0 0 0 3.5px var(--ab-dou)" : "none",
                  cursor: "pointer",
                }}
              >
                {d.short}
              </div>
            );
          })}
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: "1px dashed #6a6763",
              color: "#8a8782",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            ＋
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6, paddingTop: 1 }}>
          {DOJOS.map((d, i) => {
            const isActive = i === 0;
            return (
              <div
                key={d.id}
                style={{
                  minWidth: 0,
                  height: 32,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 1,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? "#fff" : "#c8c4be",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    lineHeight: 1.2,
                  }}
                >
                  {d.name}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#8a8782",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    lineHeight: 1.2,
                  }}
                >
                  {isActive ? "Standard · 6 メンバー" : "Free · 4 メンバー"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Primary nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "10px 8px" }}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === active;
          return (
            <div
              key={item.id}
              onClick={() => {
                onNav?.(item.id);
                if (item.id === "calendar") onGoScreen?.("calendar");
                if (item.id === "home") onGoScreen?.("home");
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "7px 10px",
                borderRadius: 5,
                cursor: "pointer",
                color: isActive ? "#fff" : "#c8c4be",
                background: isActive ? "rgba(196,149,106,0.16)" : "transparent",
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                lineHeight: 1.3,
                marginBottom: 1,
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: 6,
                  bottom: 6,
                  width: 2,
                  borderRadius: 1,
                  background: isActive ? "var(--ab-dou)" : "transparent",
                }}
              />
              <Icon
                name={item.icon}
                size={15}
                stroke={1.6}
                style={{ color: isActive ? "var(--ab-dou)" : "#8a8782", marginLeft: 4 }}
              />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    background: "var(--ab-dou)",
                    color: "#fff",
                    padding: "1px 6px",
                    borderRadius: 8,
                    letterSpacing: 0,
                    fontFamily: "var(--ab-font-num)",
                  }}
                >
                  {item.badge}
                </span>
              )}
              {item.pro && (
                <span
                  title="有料プラン"
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: "#8a8782",
                    border: "1px solid #4a4a48",
                    padding: "0 4px",
                    borderRadius: 2,
                    letterSpacing: 0.5,
                  }}
                >
                  PRO
                </span>
              )}
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div
        style={{
          padding: "10px 12px",
          borderTop: "1px solid var(--ab-sumi-light)",
          display: "flex",
          alignItems: "center",
          gap: 9,
        }}
      >
        <Avatar member={{ initial: "田", role: "owner" }} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>田中 一郎</div>
          <div style={{ fontSize: 10, color: "#8a8782" }}>owner@warabi.aikido</div>
        </div>
        <Icon name="chevron-down" size={13} style={{ color: "#8a8782" }} />
      </div>
    </aside>
  );
}

function iconBtn(): React.CSSProperties {
  return {
    position: "relative",
    width: 30,
    height: 30,
    borderRadius: 5,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "var(--ab-text-secondary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

interface HeaderProps {
  title: string;
  crumbs?: string[];
  right?: React.ReactNode;
}
function Header({ title, crumbs = [], right = null }: HeaderProps): JSX.Element {
  const dojo = DOJOS[0];
  return (
    <header
      style={{
        height: 56,
        flexShrink: 0,
        background: "var(--ab-surface-card)",
        borderBottom: "1px solid var(--ab-border-default)",
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        gap: 16,
        fontFamily: "var(--ab-font-ui)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            <span style={{ fontSize: 12, color: "var(--ab-text-tertiary)" }}>{c}</span>
            <span style={{ fontSize: 11, color: "var(--ab-border-strong)" }}>/</span>
          </React.Fragment>
        ))}
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--ab-font-brand)",
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: 0.5,
            color: "var(--ab-text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </h1>
        <span style={{ fontSize: 11, color: "var(--ab-text-tertiary)", whiteSpace: "nowrap" }}>
          {dojo.name} · {dojo.org}
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {right}

      {/* search */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          width: 240,
          background: "var(--ab-surface-canvas)",
          border: "1px solid var(--ab-border-default)",
          borderRadius: 6,
          fontSize: 12,
          color: "var(--ab-text-tertiary)",
        }}
      >
        <Icon name="search" size={13} style={{ color: "var(--ab-text-tertiary)" }} />
        <span style={{ flex: 1 }}>道場ボード内を検索</span>
        <span
          style={{
            fontFamily: "var(--ab-font-num)",
            fontSize: 10,
            color: "var(--ab-text-tertiary)",
            border: "1px solid var(--ab-border-default)",
            padding: "0 4px",
            borderRadius: 3,
          }}
        >
          ⌘K
        </span>
      </div>

      <button style={iconBtn()}>
        <Icon name="globe" size={15} />
      </button>
      <button style={iconBtn()}>
        <Icon name="bell" size={15} />
        <span
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--ab-dou)",
            boxShadow: "0 0 0 2px var(--ab-surface-card)",
          }}
        />
      </button>
      <div style={{ width: 1, height: 22, background: "var(--ab-border-default)" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
        <Avatar member={{ initial: "田", role: "owner" }} size={26} />
        <Icon name="chevron-down" size={12} style={{ color: "var(--ab-text-tertiary)" }} />
      </div>
    </header>
  );
}

function SPTopBar({ title }: { title: string }): JSX.Element {
  return (
    <div
      style={{
        height: 48,
        flexShrink: 0,
        background: "var(--ab-surface-card)",
        borderBottom: "1px solid var(--ab-border-default)",
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        gap: 10,
        fontFamily: "var(--ab-font-ui)",
      }}
    >
      <button style={{ ...iconBtn(), width: 32, height: 32 }}>
        <Icon name="menu" size={18} />
      </button>
      <h1
        style={{
          margin: 0,
          flex: 1,
          minWidth: 0,
          fontFamily: "var(--ab-font-brand)",
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: 0.3,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {title}
      </h1>
      <button style={{ ...iconBtn(), width: 32, height: 32 }}>
        <Icon name="bell" size={16} />
        <span
          style={{
            position: "absolute",
            top: 6,
            right: 7,
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "var(--ab-dou)",
          }}
        />
      </button>
      <Avatar member={{ initial: "田", role: "owner" }} size={26} />
    </div>
  );
}

interface SPTabBarProps {
  active?: Screen;
  onNav?: (id: Screen) => void;
}
function SPTabBar({ active, onNav }: SPTabBarProps): JSX.Element {
  return (
    <div
      style={{
        height: 56,
        flexShrink: 0,
        background: "var(--ab-surface-card)",
        borderTop: "1px solid var(--ab-border-default)",
        display: "flex",
        fontFamily: "var(--ab-font-ui)",
      }}
    >
      {SP_TABS.map((t) => {
        const isActive = t.id === active;
        return (
          <div
            key={t.id}
            onClick={() => onNav?.(t.id)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              cursor: "pointer",
              position: "relative",
              color: isActive ? "var(--ab-theme-primary)" : "var(--ab-text-tertiary)",
            }}
          >
            <Icon name={t.icon} size={18} stroke={isActive ? 1.9 : 1.5} />
            <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400 }}>{t.label}</span>
            {t.badge && (
              <span
                style={{
                  position: "absolute",
                  top: 6,
                  right: "28%",
                  minWidth: 14,
                  height: 14,
                  padding: "0 3px",
                  background: "var(--ab-dou)",
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: 700,
                  borderRadius: 7,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {t.badge}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// 6. Shared screen helpers
// ──────────────────────────────────────────────────────────────────────────────

function cardStyle(): React.CSSProperties {
  return {
    background: "var(--ab-surface-card)",
    border: "1px solid var(--ab-border-default)",
    borderRadius: 8,
    boxShadow: "var(--ab-shadow-xs)",
    overflow: "hidden",
  };
}
function cardStyleSP(): React.CSSProperties {
  return {
    background: "var(--ab-surface-card)",
    border: "1px solid var(--ab-border-default)",
    borderRadius: 8,
    overflow: "hidden",
  };
}
function cardHeader(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    borderBottom: "1px solid var(--ab-border-subtle)",
  };
}
function sectionLabel(): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.5,
    color: "var(--ab-text-secondary)",
    textTransform: "uppercase",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  };
}
function countPill(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 16,
    height: 16,
    padding: "0 4px",
    background: "var(--ab-dou)",
    color: "#fff",
    fontFamily: "var(--ab-font-num)",
    fontSize: 10,
    fontWeight: 700,
    borderRadius: 3,
    marginLeft: 4,
    letterSpacing: 0,
  };
}
function ghostBtn(): React.CSSProperties {
  return {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 11,
    color: "var(--ab-text-secondary)",
    fontFamily: "var(--ab-font-ui)",
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    padding: "4px 6px",
    borderRadius: 4,
  };
}
function primaryBtn(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "var(--ab-sumi)",
    color: "#fff",
    border: "1px solid var(--ab-sumi)",
    padding: "7px 14px",
    borderRadius: 6,
    fontFamily: "var(--ab-font-ui)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  };
}
function secondaryBtn(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "var(--ab-surface-card)",
    color: "var(--ab-text-primary)",
    border: "1px solid var(--ab-border-strong)",
    padding: "7px 12px",
    borderRadius: 6,
    fontFamily: "var(--ab-font-ui)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  };
}
function divider(): React.CSSProperties {
  return { width: 1, height: 24, background: "var(--ab-border-default)" };
}
function kindColor(kind: ActivityEntry["kind"]): string {
  switch (kind) {
    case "calendar": return "var(--ab-info)";
    case "announce": return "var(--ab-dou)";
    case "rsvp-yes": return "var(--ab-success)";
    case "rsvp-no":  return "var(--ab-danger)";
    case "money":    return "var(--ab-warning)";
    default:         return "var(--ab-text-tertiary)";
  }
}

interface StatBlockProps {
  label: string;
  value: number;
  tone: "yes" | "no" | "un";
}
function StatBlock({ label, value, tone }: StatBlockProps): JSX.Element {
  const toneColor = tone === "yes" ? "var(--ab-success)" : tone === "no" ? "var(--ab-danger)" : "var(--ab-text-tertiary)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ fontSize: 10, color: "var(--ab-text-tertiary)", letterSpacing: 0.3 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
        <span
          style={{
            fontFamily: "var(--ab-font-num)",
            fontSize: 18,
            fontWeight: 600,
            color: toneColor,
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        <span style={{ fontSize: 10, color: "var(--ab-text-tertiary)" }}>名</span>
      </div>
    </div>
  );
}

function MiniBarChart({ weeks }: { weeks: AttendanceWeek[] }): JSX.Element {
  const max = 100;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 90 }}>
      {weeks.map((w) => (
        <div key={w.w} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ fontSize: 9, color: "var(--ab-text-tertiary)", fontFamily: "var(--ab-font-num)" }}>{w.rate}</div>
          <div
            style={{
              width: "100%",
              height: 60,
              background: "var(--ab-surface-card-alt)",
              borderRadius: 2,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: `${(w.rate / max) * 100}%`,
                background:
                  w.rate >= 70
                    ? "var(--ab-sumi)"
                    : w.rate >= 50
                    ? "var(--ab-dou)"
                    : "var(--ab-border-strong)",
              }}
            />
          </div>
          <div style={{ fontSize: 10, color: "var(--ab-text-tertiary)", fontFamily: "var(--ab-font-num)" }}>{w.w}</div>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// 7. HomeScreen — admin dashboard (PC)
// ──────────────────────────────────────────────────────────────────────────────

interface HomeScreenProps {
  onOpenEvent?: (day: number) => void;
  onGoScreen?: (id: Screen) => void;
}
function HomeScreen({ onOpenEvent, onGoScreen }: HomeScreenProps): JSX.Element {
  const nextDay = 3;
  const next = EVENTS[nextDay][0];
  const nextInstructor = MEMBER_BY_ID[next.instructor];

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        background: "var(--ab-surface-canvas)",
        padding: "24px 32px 48px",
        fontFamily: "var(--ab-font-ui)",
        color: "var(--ab-text-primary)",
        fontSize: 13,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 24, alignItems: "start" }}>
        {/* ══════════ LEFT 70% ══════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
          {/* ── Next class card (hero) ── */}
          <section style={cardStyle()}>
            <div style={cardHeader()}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={sectionLabel()}>次の稽古</span>
                <span style={{ fontSize: 11, color: "var(--ab-text-tertiary)" }}>あと 4 日</span>
              </div>
              <button style={ghostBtn()} onClick={() => onOpenEvent?.(3)}>
                詳細を見る <Icon name="chevron-right" size={13} />
              </button>
            </div>
            <div style={{ padding: "16px 20px 20px", display: "grid", gridTemplateColumns: "152px 1fr", gap: 24 }}>
              {/* date block */}
              <div
                style={{
                  border: "1px solid var(--ab-border-default)",
                  borderRadius: 8,
                  overflow: "hidden",
                  fontFamily: "var(--ab-font-brand)",
                  textAlign: "center",
                  background: "var(--ab-surface-card-alt)",
                }}
              >
                <div
                  style={{
                    background: "var(--ab-sumi)",
                    color: "#fff",
                    padding: "4px 0",
                    fontSize: 11,
                    letterSpacing: 2,
                    fontWeight: 500,
                  }}
                >
                  JUL · 金
                </div>
                <div
                  style={{
                    fontFamily: "var(--ab-font-num)",
                    fontSize: 56,
                    fontWeight: 600,
                    lineHeight: 1,
                    padding: "14px 0 8px",
                    letterSpacing: -2,
                    color: "var(--ab-text-primary)",
                  }}
                >
                  3
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--ab-text-secondary)",
                    padding: "0 0 12px",
                    letterSpacing: 1,
                  }}
                >
                  19:00 – 21:00
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6, letterSpacing: 0.3 }}>基本技中心</div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 20,
                      fontSize: 12,
                      color: "var(--ab-text-secondary)",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <Icon name="map-pin" size={13} style={{ color: "var(--ab-text-tertiary)" }} />
                      第一武道場
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <Icon name="user" size={13} style={{ color: "var(--ab-text-tertiary)" }} />
                      指導 · {nextInstructor.name}({nextInstructor.dan})
                    </span>
                  </div>
                </div>

                {/* attendance summary */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 20,
                    padding: "12px 14px",
                    background: "var(--ab-surface-card-alt)",
                    border: "1px solid var(--ab-border-subtle)",
                    borderRadius: 6,
                  }}
                >
                  <StatBlock label="参加予定" value={next.attending.length} tone="yes" />
                  <div style={divider()} />
                  <StatBlock label="不参加" value={next.declined.length} tone="no" />
                  <div style={divider()} />
                  <StatBlock label="未回答" value={MEMBERS.length - next.attending.length - next.declined.length} tone="un" />
                  <div style={{ flex: 1 }} />
                  <div style={{ display: "flex", alignItems: "center" }}>
                    {next.attending.slice(0, 5).map((id, i) => (
                      <div
                        key={id}
                        style={{
                          marginLeft: i === 0 ? 0 : -8,
                          boxShadow: "0 0 0 2px var(--ab-surface-card-alt)",
                          borderRadius: "50%",
                        }}
                      >
                        <Avatar member={MEMBER_BY_ID[id]} size={26} />
                      </div>
                    ))}
                    {next.attending.length > 5 && (
                      <div
                        style={{
                          marginLeft: -8,
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          background: "var(--ab-surface-card)",
                          border: "1px solid var(--ab-border-default)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          fontFamily: "var(--ab-font-num)",
                          color: "var(--ab-text-secondary)",
                          boxShadow: "0 0 0 2px var(--ab-surface-card-alt)",
                        }}
                      >
                        +{next.attending.length - 5}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                  <button style={primaryBtn()}>
                    <Icon name="check" size={14} /> 参加を表明
                  </button>
                  <button style={secondaryBtn()}>不参加</button>
                  <div style={{ flex: 1 }} />
                  <button style={secondaryBtn()}>
                    <Icon name="edit" size={13} /> 編集
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* ── Unread announcements ── */}
          <section style={cardStyle()}>
            <div style={cardHeader()}>
              <span style={sectionLabel()}>
                お知らせ <span style={countPill()}>1</span>
              </span>
              <button style={ghostBtn()} onClick={() => onGoScreen?.("calendar")}>
                すべて見る <Icon name="chevron-right" size={13} />
              </button>
            </div>
            <div>
              {ANNOUNCEMENTS.map((a, i) => (
                <div
                  key={a.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "14px 1fr auto",
                    gap: 12,
                    alignItems: "start",
                    padding: "14px 20px",
                    borderTop: i === 0 ? "none" : "1px solid var(--ab-border-subtle)",
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      marginTop: 7,
                      borderRadius: "50%",
                      background: a.read ? "transparent" : "var(--ab-dou)",
                      border: a.read ? "1px solid var(--ab-border-default)" : "none",
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: a.read ? 400 : 600,
                        color: a.read ? "var(--ab-text-secondary)" : "var(--ab-text-primary)",
                        marginBottom: 2,
                      }}
                    >
                      {a.title}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--ab-text-tertiary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {a.excerpt}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--ab-text-tertiary)",
                      fontFamily: "var(--ab-font-num)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.date}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Recent feed ── */}
          <section style={cardStyle()}>
            <div style={cardHeader()}>
              <span style={sectionLabel()}>最近のフィード</span>
              <button style={ghostBtn()}>
                フィードへ <Icon name="chevron-right" size={13} />
              </button>
            </div>
            <div>
              {FEED_POSTS.map((p, i) => {
                const author = MEMBER_BY_ID[p.authorId];
                return (
                  <div
                    key={p.id}
                    style={{
                      padding: "14px 20px",
                      borderTop: i === 0 ? "none" : "1px solid var(--ab-border-subtle)",
                      display: "grid",
                      gridTemplateColumns: "32px 1fr",
                      gap: 12,
                    }}
                  >
                    <Avatar member={author} size={32} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{author.name}</span>
                        <RoleTag role={author.role} />
                        <span style={{ fontSize: 11, color: "var(--ab-text-tertiary)" }}>· {p.time}</span>
                        {p.aikinote && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: 10,
                              color: "var(--ab-dou)",
                              background: "var(--ab-dou-soft)",
                              padding: "1px 6px",
                              borderRadius: 3,
                              fontWeight: 500,
                            }}
                          >
                            <Icon name="aikinote" size={10} /> AikiNote 連携
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          lineHeight: 1.6,
                          color: "var(--ab-text-primary)",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          marginBottom: 6,
                          textWrap: "pretty",
                        } as React.CSSProperties}
                      >
                        {p.text}
                      </div>
                      <div style={{ display: "flex", gap: 18, fontSize: 11, color: "var(--ab-text-tertiary)" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Icon name="heart" size={12} /> {p.likes}
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Icon name="reply" size={12} /> {p.replies}
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Icon name="share" size={12} /> 共有
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* ══════════ RIGHT 30% ══════════ */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
          {/* Attendance mini-chart */}
          <section style={cardStyle()}>
            <div style={cardHeader()}>
              <span style={sectionLabel()}>今月の出欠</span>
              <span style={{ fontSize: 11, color: "var(--ab-text-tertiary)" }}>2026年7月</span>
            </div>
            <div style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 24, lineHeight: 1.2 }}>
                <div
                  style={{
                    fontFamily: "var(--ab-font-num)",
                    fontSize: 28,
                    fontWeight: 600,
                    letterSpacing: -0.5,
                  }}
                >
                  68
                  <span style={{ fontSize: 14, color: "var(--ab-text-tertiary)", marginLeft: 2 }}>%</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--ab-text-secondary)" }}>平均参加率</div>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: "var(--ab-success)", fontFamily: "var(--ab-font-num)" }}>
                  ▲ 4%
                </span>
              </div>
              <MiniBarChart weeks={ATTENDANCE_WEEKS} />
            </div>
          </section>

          {/* Activity log */}
          <section style={cardStyle()}>
            <div style={cardHeader()}>
              <span style={sectionLabel()}>
                アクティビティ{" "}
                <span
                  style={{
                    fontSize: 9,
                    color: "var(--ab-text-tertiary)",
                    border: "1px solid var(--ab-border-default)",
                    padding: "0 4px",
                    borderRadius: 2,
                    marginLeft: 4,
                    letterSpacing: 0.5,
                  }}
                >
                  PRO
                </span>
              </span>
              <button style={ghostBtn()}>すべて</button>
            </div>
            <div style={{ padding: "4px 0 8px" }}>
              {ACTIVITY.map((a) => (
                <div
                  key={a.id}
                  style={{
                    position: "relative",
                    padding: "8px 20px 8px 34px",
                    fontSize: 12,
                    lineHeight: 1.5,
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: 20,
                      top: 14,
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: kindColor(a.kind),
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      left: 22.5,
                      top: 22,
                      bottom: -4,
                      width: 1,
                      background: "var(--ab-border-subtle)",
                    }}
                  />
                  <div style={{ color: "var(--ab-text-primary)" }}>
                    <span style={{ fontWeight: 600 }}>{a.who}</span>
                    <span style={{ color: "var(--ab-text-secondary)" }}>{a.verb}</span>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--ab-text-tertiary)",
                      fontFamily: "var(--ab-font-num)",
                    }}
                  >
                    {a.time}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// 8. CalendarScreen — 2026年7月、month view (PC and SP)
// ──────────────────────────────────────────────────────────────────────────────

interface CalendarScreenProps {
  onOpenEvent?: (day: number) => void;
  isSP?: boolean;
}
function CalendarScreen({ onOpenEvent, isSP = false }: CalendarScreenProps): JSX.Element {
  // 2026年7月1日 = 水曜 (0=日, 1=月, ...)
  const firstDow = 3;
  const daysInMonth = 31;
  const markedToday = 3;

  const dow = ["日", "月", "火", "水", "木", "金", "土"];
  type Cell = { key: string | number; blank?: boolean; day?: number; events?: DojoEvent[] };
  const cells: Cell[] = [];
  for (let i = 0; i < firstDow; i++) cells.push({ key: `b${i}`, blank: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ key: d, day: d, events: EVENTS[d] });
  while (cells.length % 7 !== 0) cells.push({ key: `a${cells.length}`, blank: true });
  const rows = cells.length / 7;

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        background: "var(--ab-surface-canvas)",
        padding: isSP ? "12px 12px 24px" : "20px 32px 40px",
        fontFamily: "var(--ab-font-ui)",
        color: "var(--ab-text-primary)",
      }}
    >
      {/* ── Toolbar ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: isSP ? 8 : 16,
          marginBottom: isSP ? 10 : 16,
          flexWrap: isSP ? "wrap" : "nowrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button style={chevBtn()}><Icon name="chevron-left" size={15} /></button>
          <button style={chevBtn()}><Icon name="chevron-right" size={15} /></button>
        </div>
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--ab-font-brand)",
            fontSize: isSP ? 18 : 22,
            fontWeight: 600,
            letterSpacing: 0.5,
          }}
        >
          2026
          <span
            style={{
              fontSize: isSP ? 13 : 14,
              fontWeight: 500,
              color: "var(--ab-text-secondary)",
              margin: "0 4px",
            }}
          >
            年
          </span>
          7
          <span
            style={{
              fontSize: isSP ? 13 : 14,
              fontWeight: 500,
              color: "var(--ab-text-secondary)",
              marginLeft: 4,
            }}
          >
            月
          </span>
        </h2>
        <button
          style={{
            fontSize: 11,
            border: "1px solid var(--ab-border-strong)",
            background: "var(--ab-surface-card)",
            padding: "4px 10px",
            borderRadius: 6,
            fontFamily: "var(--ab-font-ui)",
            cursor: "pointer",
            color: "var(--ab-text-secondary)",
          }}
        >
          今日
        </button>

        {!isSP && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              border: "1px solid var(--ab-border-default)",
              borderRadius: 6,
              background: "var(--ab-surface-card)",
              padding: 2,
              fontSize: 12,
            }}
          >
            {["月", "週", "リスト"].map((l, i) => (
              <div
                key={l}
                style={{
                  padding: "3px 12px",
                  borderRadius: 4,
                  background: i === 0 ? "var(--ab-surface-card-alt)" : "transparent",
                  fontWeight: i === 0 ? 600 : 400,
                  color: i === 0 ? "var(--ab-text-primary)" : "var(--ab-text-tertiary)",
                  cursor: "pointer",
                }}
              >
                {l}
              </div>
            ))}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {!isSP && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 11,
              color: "var(--ab-text-tertiary)",
            }}
          >
            <Legend color="var(--ab-dou)" label="稽古あり" />
            <Legend color="var(--ab-success)" label="全員参加" dotOutline />
          </div>
        )}

        <button style={primaryBtnSm()}>
          <Icon name="plus" size={14} /> 稽古を追加
        </button>
      </div>

      {/* ── Month grid ── */}
      <div
        style={{
          background: "var(--ab-surface-card)",
          border: "1px solid var(--ab-border-default)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {/* header row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            borderBottom: "1px solid var(--ab-border-default)",
          }}
        >
          {dow.map((d, i) => (
            <div
              key={d}
              style={{
                padding: "8px 10px",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 1,
                color: i === 0 ? "var(--ab-danger)" : i === 6 ? "var(--ab-info)" : "var(--ab-text-secondary)",
                background: "var(--ab-surface-card-alt)",
                borderRight: i < 6 ? "1px solid var(--ab-border-default)" : "none",
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* week rows */}
        {Array.from({ length: rows }).map((_, ri) => (
          <div
            key={ri}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              borderBottom: ri < rows - 1 ? "1px solid var(--ab-border-default)" : "none",
              minHeight: isSP ? 72 : 108,
            }}
          >
            {cells.slice(ri * 7, ri * 7 + 7).map((c, ci) => (
              <DayCell
                key={c.key}
                cell={c}
                col={ci}
                isSP={isSP}
                isMarkedToday={c.day === markedToday}
                onClick={c.events && c.day ? () => onOpenEvent?.(c.day as number) : null}
              />
            ))}
          </div>
        ))}
      </div>

      {!isSP && (
        <div
          style={{
            marginTop: 14,
            display: "flex",
            alignItems: "center",
            fontSize: 11,
            color: "var(--ab-text-tertiary)",
            gap: 16,
          }}
        >
          <span>この月の稽古 10 件 · 総参加述べ 32 名</span>
        </div>
      )}
    </div>
  );
}

interface DayCellProps {
  cell: { key: string | number; blank?: boolean; day?: number; events?: DojoEvent[] };
  col: number;
  isSP: boolean;
  isMarkedToday: boolean;
  onClick: (() => void) | null;
}
function DayCell({ cell, col, isSP, isMarkedToday, onClick }: DayCellProps): JSX.Element {
  if (cell.blank) {
    return (
      <div
        style={{
          background: "var(--ab-surface-card-alt)",
          borderRight: col < 6 ? "1px solid var(--ab-border-default)" : "none",
        }}
      />
    );
  }
  const hasEvent = !!cell.events;
  const ev = hasEvent ? cell.events![0] : null;

  const dayColor = col === 0 ? "var(--ab-danger)" : col === 6 ? "var(--ab-info)" : "var(--ab-text-primary)";

  return (
    <div
      onClick={onClick ?? undefined}
      onMouseEnter={
        hasEvent
          ? (e) => {
              (e.currentTarget as HTMLDivElement).style.background = "var(--ab-washi)";
            }
          : undefined
      }
      onMouseLeave={
        hasEvent
          ? (e) => {
              (e.currentTarget as HTMLDivElement).style.background = "var(--ab-surface-card)";
            }
          : undefined
      }
      style={{
        borderRight: col < 6 ? "1px solid var(--ab-border-default)" : "none",
        padding: isSP ? "6px 6px 8px" : "8px 10px 10px",
        cursor: hasEvent ? "pointer" : "default",
        minHeight: isSP ? 72 : 108,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        background: "var(--ab-surface-card)",
        transition: "background 120ms",
        position: "relative",
      }}
    >
      {/* day number */}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span
          style={{
            fontFamily: "var(--ab-font-num)",
            fontSize: isSP ? 12 : 13,
            fontWeight: isMarkedToday ? 700 : 500,
            color: isMarkedToday ? "#fff" : dayColor,
            width: isMarkedToday ? 20 : "auto",
            height: isMarkedToday ? 20 : "auto",
            background: isMarkedToday ? "var(--ab-sumi)" : "transparent",
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {cell.day}
        </span>
      </div>

      {/* event chip (PC) */}
      {hasEvent && !isSP && ev && (
        <div
          style={{
            marginTop: 2,
            padding: "3px 6px 4px 8px",
            background: "var(--ab-dou-soft)",
            borderLeft: "2px solid var(--ab-dou)",
            borderRadius: 3,
            fontSize: 10.5,
            lineHeight: 1.3,
            color: "var(--ab-text-primary)",
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontFamily: "var(--ab-font-num)", fontWeight: 600 }}>{ev.time.split("–")[0]}</span>
            <span style={{ color: "var(--ab-text-tertiary)", fontSize: 9 }}>{ev.place}</span>
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--ab-text-secondary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {ev.note || "通常稽古"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
            <span
              style={{
                fontFamily: "var(--ab-font-num)",
                fontSize: 9,
                fontWeight: 600,
                color: ev.attending.length === 6 ? "var(--ab-success)" : "var(--ab-text-secondary)",
              }}
            >
              {ev.attending.length}/6
            </span>
            <div style={{ display: "flex" }}>
              {ev.attending.slice(0, 3).map((id, i) => (
                <div
                  key={id}
                  style={{
                    marginLeft: i === 0 ? 0 : -6,
                    boxShadow: "0 0 0 1.5px var(--ab-dou-soft)",
                    borderRadius: "50%",
                  }}
                >
                  <Avatar member={MEMBER_BY_ID[id]} size={14} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SP: dot only */}
      {hasEvent && isSP && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--ab-dou)" }} />
        </div>
      )}
    </div>
  );
}

function chevBtn(): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    borderRadius: 5,
    border: "1px solid var(--ab-border-default)",
    background: "var(--ab-surface-card)",
    color: "var(--ab-text-secondary)",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}
function primaryBtnSm(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    background: "var(--ab-sumi)",
    color: "#fff",
    border: "1px solid var(--ab-sumi)",
    padding: "5px 12px",
    borderRadius: 6,
    fontFamily: "var(--ab-font-ui)",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
  };
}
interface LegendProps {
  color: string;
  label: string;
  dotOutline?: boolean;
}
function Legend({ color, label, dotOutline = false }: LegendProps): JSX.Element {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: dotOutline ? "transparent" : color,
          border: dotOutline ? `1.5px solid ${color}` : "none",
        }}
      />
      {label}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// 9. EventModal — PC centered / SP fullscreen sheet
// ──────────────────────────────────────────────────────────────────────────────

interface EventModalProps {
  day: number;
  onClose: () => void;
  isSP?: boolean;
}
function EventModal({ day, onClose, isSP = false }: EventModalProps): JSX.Element | null {
  const events = EVENTS[day] || [];
  const ev = events[0];
  const [rsvp, setRsvp] = useState<"yes" | "no" | null>(null);
  if (!ev) return null;
  const instructor = MEMBER_BY_ID[ev.instructor];
  const undecided = MEMBERS.filter(
    (m) => !ev.attending.includes(m.id) && !ev.declined.includes(m.id),
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--ab-overlay)",
        zIndex: 40,
        display: "flex",
        alignItems: isSP ? "stretch" : "center",
        justifyContent: "center",
        padding: isSP ? 0 : 40,
        fontFamily: "var(--ab-font-ui)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--ab-surface-card)",
          borderRadius: isSP ? 0 : 12,
          width: isSP ? "100%" : 520,
          maxHeight: isSP ? "100%" : "calc(100% - 32px)",
          display: "flex",
          flexDirection: "column",
          boxShadow: isSP ? "none" : "var(--ab-shadow-lg)",
          overflow: "hidden",
          color: "var(--ab-text-primary)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: isSP ? "14px 16px 12px" : "18px 24px 14px",
            borderBottom: "1px solid var(--ab-border-default)",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 1,
                color: "var(--ab-text-tertiary)",
                marginBottom: 4,
                textTransform: "uppercase",
              }}
            >
              稽古詳細
            </div>
            <h3
              style={{
                margin: 0,
                fontFamily: "var(--ab-font-brand)",
                fontSize: isSP ? 18 : 20,
                fontWeight: 600,
                letterSpacing: 0.5,
              }}
            >
              7月{day}日(金)の稽古
            </h3>
            <div style={{ fontSize: 12, color: "var(--ab-text-secondary)", marginTop: 4 }}>
              {ev.note || "通常稽古"}
            </div>
          </div>
          <button
            style={{
              width: 30,
              height: 30,
              borderRadius: 5,
              background: "transparent",
              border: "1px solid var(--ab-border-default)",
              color: "var(--ab-text-secondary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="edit" size={13} />
          </button>
          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: 5,
              background: "transparent",
              border: "none",
              color: "var(--ab-text-secondary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: isSP ? "14px 16px 80px" : "18px 24px 20px" }}>
          {/* meta */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isSP ? "1fr" : "1fr 1fr",
              gap: isSP ? 8 : 12,
              marginBottom: 18,
            }}
          >
            <MetaRow icon="clock" label="日時" value={<span style={{ fontFamily: "var(--ab-font-num)" }}>{ev.time}</span>} />
            <MetaRow icon="map-pin" label="場所" value={ev.place} />
            <MetaRow
              icon="user"
              label="指導"
              value={
                <span>
                  {instructor.name}{" "}
                  <span style={{ color: "var(--ab-text-tertiary)", fontSize: 11 }}>({instructor.dan})</span>
                </span>
              }
            />
            <MetaRow icon="lock" label="公開" value={<span style={{ color: "var(--ab-text-secondary)" }}>メンバー限定</span>} />
          </div>

          {/* RSVP CTA */}
          <div
            style={{
              padding: "14px 16px",
              background: "var(--ab-surface-card-alt)",
              border: "1px solid var(--ab-border-subtle)",
              borderRadius: 8,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ab-text-secondary)",
                letterSpacing: 0.5,
                marginBottom: 10,
                textTransform: "uppercase",
              }}
            >
              出欠を表明する
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setRsvp("yes")} style={rsvpBtn(rsvp === "yes", "yes")}>
                <Icon name="check" size={16} /> 参加する
              </button>
              <button onClick={() => setRsvp("no")} style={rsvpBtn(rsvp === "no", "no")}>
                <Icon name="close" size={16} /> 不参加
              </button>
            </div>
            {rsvp && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  color: "var(--ab-text-tertiary)",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Icon name="check" size={11} style={{ color: "var(--ab-success)" }} />
                出欠を保存しました。
              </div>
            )}
          </div>

          {/* Attending list */}
          <div style={{ marginBottom: 18 }}>
            <div style={listHeader()}>
              <span>参加</span>
              <span
                style={{
                  fontFamily: "var(--ab-font-num)",
                  color: "var(--ab-success)",
                  fontWeight: 600,
                }}
              >
                {ev.attending.length} 名
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isSP ? "1fr 1fr" : "1fr 1fr 1fr",
                gap: 6,
                marginTop: 10,
              }}
            >
              {ev.attending.map((id) => {
                const m = MEMBER_BY_ID[id];
                return (
                  <div key={id} style={memberChip()}>
                    <Avatar member={m} size={22} />
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{m.name}</span>
                    <span style={{ fontSize: 10, color: "var(--ab-text-tertiary)", marginLeft: "auto" }}>{m.dan}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Declined list */}
          {ev.declined.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={listHeader()}>
                <span>不参加</span>
                <span
                  style={{
                    fontFamily: "var(--ab-font-num)",
                    color: "var(--ab-danger)",
                    fontWeight: 600,
                  }}
                >
                  {ev.declined.length} 名
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {ev.declined.map((id) => {
                  const m = MEMBER_BY_ID[id];
                  return (
                    <div
                      key={id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "3px 10px 3px 4px",
                        border: "1px solid var(--ab-border-default)",
                        background: "var(--ab-surface-card)",
                        borderRadius: 999,
                        fontSize: 11,
                        color: "var(--ab-text-secondary)",
                      }}
                    >
                      <Avatar member={m} size={18} />
                      {m.name}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Undecided */}
          {undecided.length > 0 && (
            <div>
              <div style={listHeader()}>
                <span>未回答</span>
                <span
                  style={{
                    fontFamily: "var(--ab-font-num)",
                    color: "var(--ab-text-tertiary)",
                    fontWeight: 600,
                  }}
                >
                  {undecided.length} 名
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {undecided.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "3px 10px 3px 4px",
                      border: "1px dashed var(--ab-border-strong)",
                      borderRadius: 999,
                      fontSize: 11,
                      color: "var(--ab-text-tertiary)",
                    }}
                  >
                    <Avatar member={m} size={18} />
                    {m.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface MetaRowProps {
  icon: IconName;
  label: string;
  value: React.ReactNode;
}
function MetaRow({ icon, label, value }: MetaRowProps): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        border: "1px solid var(--ab-border-subtle)",
        borderRadius: 6,
        background: "var(--ab-surface-card)",
      }}
    >
      <Icon name={icon} size={13} style={{ color: "var(--ab-text-tertiary)" }} />
      <span
        style={{
          fontSize: 10,
          color: "var(--ab-text-tertiary)",
          letterSpacing: 0.5,
          minWidth: 28,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 13, color: "var(--ab-text-primary)" }}>{value}</span>
    </div>
  );
}
function listHeader(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.5,
    color: "var(--ab-text-secondary)",
    textTransform: "uppercase",
    paddingBottom: 6,
    borderBottom: "1px solid var(--ab-border-subtle)",
  };
}
function memberChip(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 10px",
    border: "1px solid var(--ab-success-soft)",
    background: "var(--ab-success-soft)",
    borderRadius: 6,
    fontFamily: "var(--ab-font-ui)",
  };
}
function rsvpBtn(isActive: boolean, kind: "yes" | "no"): React.CSSProperties {
  const color = kind === "yes" ? "var(--ab-success)" : "var(--ab-danger)";
  return {
    flex: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "12px 16px",
    background: isActive ? color : "var(--ab-surface-card)",
    color: isActive ? "#fff" : color,
    border: `1px solid ${isActive ? color : "var(--ab-border-strong)"}`,
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "var(--ab-font-ui)",
    cursor: "pointer",
    minHeight: 44,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// 10. SPHomeScreen — smartphone home (375px wide)
// ──────────────────────────────────────────────────────────────────────────────

interface SPHomeScreenProps {
  onOpenEvent?: (day: number) => void;
}
function SPHomeScreen({ onOpenEvent }: SPHomeScreenProps): JSX.Element {
  const next = EVENTS[3][0];
  const nextInstructor = MEMBER_BY_ID[next.instructor];

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        background: "var(--ab-surface-canvas)",
        padding: "12px 12px 24px",
        fontFamily: "var(--ab-font-ui)",
        color: "var(--ab-text-primary)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          fontFamily: "var(--ab-font-brand)",
          fontSize: 15,
          letterSpacing: 0.3,
          color: "var(--ab-text-secondary)",
        }}
      >
        おはようございます、田中さん
      </div>

      {/* Next class card */}
      <section style={cardStyleSP()}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderBottom: "1px solid var(--ab-border-subtle)",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.5,
              color: "var(--ab-text-secondary)",
              textTransform: "uppercase",
            }}
          >
            次の稽古
          </span>
          <span style={{ fontSize: 10, color: "var(--ab-text-tertiary)" }}>あと 4 日</span>
        </div>
        <div
          onClick={() => onOpenEvent?.(3)}
          style={{ padding: "14px", display: "flex", gap: 14, cursor: "pointer" }}
        >
          <div
            style={{
              width: 56,
              flexShrink: 0,
              border: "1px solid var(--ab-border-default)",
              borderRadius: 6,
              overflow: "hidden",
              textAlign: "center",
              fontFamily: "var(--ab-font-brand)",
            }}
          >
            <div
              style={{
                background: "var(--ab-sumi)",
                color: "#fff",
                fontSize: 9,
                padding: "2px 0",
                letterSpacing: 1.5,
              }}
            >
              JUL 金
            </div>
            <div
              style={{
                fontFamily: "var(--ab-font-num)",
                fontSize: 26,
                fontWeight: 600,
                lineHeight: 1,
                padding: "8px 0 4px",
              }}
            >
              3
            </div>
            <div style={{ fontSize: 9, color: "var(--ab-text-secondary)", padding: "0 0 6px" }}>19:00</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>基本技中心</div>
            <div
              style={{
                fontSize: 11,
                color: "var(--ab-text-secondary)",
                marginBottom: 3,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Icon name="map-pin" size={11} /> 第一武道場
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--ab-text-secondary)",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Icon name="user" size={11} /> {nextInstructor.name}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ display: "flex" }}>
                {next.attending.slice(0, 4).map((id, i) => (
                  <div
                    key={id}
                    style={{
                      marginLeft: i === 0 ? 0 : -6,
                      boxShadow: "0 0 0 1.5px var(--ab-surface-card)",
                      borderRadius: "50%",
                    }}
                  >
                    <Avatar member={MEMBER_BY_ID[id]} size={20} />
                  </div>
                ))}
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "var(--ab-font-num)",
                  color: "var(--ab-success)",
                  fontWeight: 600,
                }}
              >
                {next.attending.length}
              </span>
              <span style={{ fontSize: 10, color: "var(--ab-text-tertiary)" }}>/ 6 名参加</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, padding: "0 14px 14px" }}>
          <button
            style={{
              flex: 1,
              minHeight: 40,
              background: "var(--ab-sumi)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "var(--ab-font-ui)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Icon name="check" size={14} /> 参加
          </button>
          <button
            style={{
              flex: 1,
              minHeight: 40,
              background: "var(--ab-surface-card)",
              color: "var(--ab-text-primary)",
              border: "1px solid var(--ab-border-strong)",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "var(--ab-font-ui)",
            }}
          >
            不参加
          </button>
        </div>
      </section>

      {/* Announcements */}
      <section style={cardStyleSP()}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderBottom: "1px solid var(--ab-border-subtle)",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.5,
              color: "var(--ab-text-secondary)",
              textTransform: "uppercase",
            }}
          >
            お知らせ{" "}
            <span
              style={{
                background: "var(--ab-dou)",
                color: "#fff",
                fontSize: 9,
                padding: "1px 5px",
                borderRadius: 3,
                marginLeft: 3,
              }}
            >
              1
            </span>
          </span>
          <span style={{ fontSize: 10, color: "var(--ab-text-tertiary)" }}>3 件</span>
        </div>
        {ANNOUNCEMENTS.slice(0, 2).map((a, i) => (
          <div
            key={a.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "10px 14px",
              borderTop: i === 0 ? "none" : "1px solid var(--ab-border-subtle)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                marginTop: 6,
                borderRadius: "50%",
                flexShrink: 0,
                background: a.read ? "transparent" : "var(--ab-dou)",
                border: a.read ? "1px solid var(--ab-border-default)" : "none",
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: a.read ? 400 : 600, marginBottom: 2 }}>{a.title}</div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--ab-text-tertiary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {a.excerpt}
              </div>
            </div>
            <span
              style={{
                fontFamily: "var(--ab-font-num)",
                fontSize: 10,
                color: "var(--ab-text-tertiary)",
              }}
            >
              {a.date.slice(5).replace(".", "/")}
            </span>
          </div>
        ))}
      </section>

      {/* Feed */}
      <section style={cardStyleSP()}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderBottom: "1px solid var(--ab-border-subtle)",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.5,
              color: "var(--ab-text-secondary)",
              textTransform: "uppercase",
            }}
          >
            最近のフィード
          </span>
        </div>
        {FEED_POSTS.slice(0, 2).map((p, i) => {
          const a = MEMBER_BY_ID[p.authorId];
          return (
            <div
              key={p.id}
              style={{
                display: "flex",
                gap: 10,
                padding: "12px 14px",
                borderTop: i === 0 ? "none" : "1px solid var(--ab-border-subtle)",
              }}
            >
              <Avatar member={a} size={26} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{a.name}</span>
                  <span style={{ fontSize: 10, color: "var(--ab-text-tertiary)" }}>· {p.time}</span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    lineHeight: 1.5,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    marginBottom: 6,
                    textWrap: "pretty",
                  } as React.CSSProperties}
                >
                  {p.text}
                </div>
                <div style={{ display: "flex", gap: 14, fontSize: 10, color: "var(--ab-text-tertiary)" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <Icon name="heart" size={11} /> {p.likes}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <Icon name="reply" size={11} /> {p.replies}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// 11. Frame wrappers — fixed-size artboards with state machines
// ──────────────────────────────────────────────────────────────────────────────

const PC_W = 1440;
const PC_H = 900;
const SP_W = 375;
const SP_H = 812;

interface PCFrameProps {
  initialScreen?: Screen;
}
function PCFrame({ initialScreen = "home" }: PCFrameProps): JSX.Element {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [modalDay, setModalDay] = useState<number | null>(null);
  const openDay = (d: number) => setModalDay(d);
  const close = () => setModalDay(null);

  const titles: Partial<Record<Screen, string>> = {
    home: "ホーム",
    calendar: "稽古カレンダー",
  };
  const crumbs: Partial<Record<Screen, string[]>> = {
    home: [],
    calendar: [],
  };

  return (
    <div
      data-dojo-theme="sumi"
      style={{
        width: PC_W,
        height: PC_H,
        display: "flex",
        background: "var(--ab-surface-canvas)",
        color: "var(--ab-text-primary)",
        fontFamily: "var(--ab-font-ui)",
        fontSize: 13,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Sidebar active={screen} onNav={setScreen} onGoScreen={setScreen} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Header title={titles[screen] ?? "ホーム"} crumbs={crumbs[screen] ?? []} />
        {screen === "home" && <HomeScreen onOpenEvent={openDay} onGoScreen={setScreen} />}
        {screen === "calendar" && <CalendarScreen onOpenEvent={openDay} />}
      </div>

      {modalDay && <EventModal day={modalDay} onClose={close} isSP={false} />}
    </div>
  );
}

interface SPFrameProps {
  initialScreen?: Screen;
}
function SPFrame({ initialScreen = "home" }: SPFrameProps): JSX.Element {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [modalDay, setModalDay] = useState<number | null>(null);

  const titles: Partial<Record<Screen, string>> = {
    home: "蕨合気道会",
    calendar: "稽古カレンダー",
  };

  return (
    <div
      data-dojo-theme="sumi"
      style={{
        width: SP_W,
        height: SP_H,
        display: "flex",
        flexDirection: "column",
        background: "var(--ab-surface-canvas)",
        color: "var(--ab-text-primary)",
        fontFamily: "var(--ab-font-ui)",
        fontSize: 12,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <SPTopBar title={titles[screen] ?? "ホーム"} />
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {screen === "home" && <SPHomeScreen onOpenEvent={setModalDay} />}
        {screen === "calendar" && <CalendarScreen onOpenEvent={setModalDay} isSP={true} />}
      </div>
      <SPTabBar
        active={screen}
        onNav={(id) => {
          if (id === "home" || id === "calendar") setScreen(id);
        }}
      />

      {modalDay && <EventModal day={modalDay} onClose={() => setModalDay(null)} isSP={true} />}
    </div>
  );
}

function PCFrameWithModal(): JSX.Element {
  const [modalDay, setModalDay] = useState<number | null>(3);
  return (
    <div
      data-dojo-theme="sumi"
      style={{
        width: PC_W,
        height: PC_H,
        display: "flex",
        background: "var(--ab-surface-canvas)",
        color: "var(--ab-text-primary)",
        fontFamily: "var(--ab-font-ui)",
        fontSize: 13,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Sidebar active="calendar" />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Header title="稽古カレンダー" />
        <CalendarScreen onOpenEvent={setModalDay} />
      </div>
      {modalDay && <EventModal day={modalDay} onClose={() => setModalDay(null)} isSP={false} />}
    </div>
  );
}

function SPFrameWithModal(): JSX.Element {
  const [modalDay, setModalDay] = useState<number | null>(3);
  return (
    <div
      data-dojo-theme="sumi"
      style={{
        width: SP_W,
        height: SP_H,
        display: "flex",
        flexDirection: "column",
        background: "var(--ab-surface-canvas)",
        color: "var(--ab-text-primary)",
        fontFamily: "var(--ab-font-ui)",
        fontSize: 12,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <SPTopBar title="稽古カレンダー" />
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <CalendarScreen onOpenEvent={setModalDay} isSP={true} />
      </div>
      <SPTabBar active="calendar" />
      {modalDay && <EventModal day={modalDay} onClose={() => setModalDay(null)} isSP={true} />}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// 12. Reference layout — replaces Claude Design's pan/zoom canvas
// ──────────────────────────────────────────────────────────────────────────────

interface SectionProps {
  id: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}
function Section({ id, title, subtitle, children }: SectionProps): JSX.Element {
  return (
    <section data-section={id} style={{ marginBottom: 80 }}>
      <div style={{ padding: "0 60px 40px" }}>
        <div
          style={{
            fontSize: 28,
            fontWeight: 600,
            color: "rgba(40,30,20,0.85)",
            letterSpacing: -0.4,
            marginBottom: 6,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: 16,
              color: "rgba(60,50,40,0.6)",
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          gap: 48,
          padding: "0 60px",
          alignItems: "flex-start",
          width: "max-content",
        }}
      >
        {children}
      </div>
    </section>
  );
}

interface FrameProps {
  label: string;
  width: number;
  height: number;
  children: React.ReactNode;
}
function Frame({ label, width, height, children }: FrameProps): JSX.Element {
  return (
    <div style={{ flexShrink: 0 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "rgba(60,50,40,0.7)",
          marginBottom: 6,
          paddingLeft: 4,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        }}
      >
        {label}
      </div>
      <div
        style={{
          width,
          height,
          background: "#fff",
          borderRadius: 2,
          boxShadow: "0 1px 3px rgba(0,0,0,.08), 0 4px 16px rgba(0,0,0,.06)",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function DesignReference({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div
      className="ab-prototype-root"
      style={{
        background: "#f0eee9",
        minHeight: "100vh",
        padding: "60px 0 80px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        color: "rgba(40,30,20,0.85)",
      }}
    >
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// 13. Default export — six-frame reference (PC × 3 + SP × 3)
// ──────────────────────────────────────────────────────────────────────────────

export default function App(): JSX.Element {
  useTokensCSS();
  return (
    <DesignReference>
      <Section
        id="pc"
        title="PC · 1440 × 900"
        subtitle="左サイドバー＋ヘッダー＋メインキャンバス — クリックで画面遷移、カレンダーの 7 月 3 日をクリックでモーダル起動"
      >
        <Frame label="1 · 管理者ホーム" width={PC_W} height={PC_H}>
          <PCFrame initialScreen="home" />
        </Frame>
        <Frame label="2 · 稽古カレンダー(2026年7月)" width={PC_W} height={PC_H}>
          <PCFrame initialScreen="calendar" />
        </Frame>
        <Frame label="3 · 稽古詳細モーダル(7月3日)" width={PC_W} height={PC_H}>
          <PCFrameWithModal />
        </Frame>
      </Section>

      <Section
        id="sp"
        title="SP · 375 × 812"
        subtitle="同じ情報アーキテクチャをモバイルに転写。下タブで行き来、モーダルはフルスクリーン・シート化。"
      >
        <Frame label="1 · ホーム" width={SP_W} height={SP_H}>
          <SPFrame initialScreen="home" />
        </Frame>
        <Frame label="2 · カレンダー" width={SP_W} height={SP_H}>
          <SPFrame initialScreen="calendar" />
        </Frame>
        <Frame label="3 · 稽古詳細シート" width={SP_W} height={SP_H}>
          <SPFrameWithModal />
        </Frame>
      </Section>
    </DesignReference>
  );
}
