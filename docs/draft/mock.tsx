/*
 * AikiBoard 仮要件のビジュアル叩き台 (React 単一ファイルモック)
 *
 * ⚠️ このファイルは検討用のアイデア視覚化です。実装要件ではありません。
 * - AikiBoard リポジトリにはまだ TS/React 環境が構築されていないため、IDE で
 *   `react`, `useState`, `useEffect` などの未解決依存が赤波線で表示される場合が
 *   あります。これは想定どおりです。
 * - 単一ファイルとしては動作するため、Vite/Next.js 等の React playground に
 *   コピペすれば手元で確認できます。
 * - 内容は仮の要件定義書 (`./requirements.md`) と対応する叩き台です。
 *   確定仕様は今後の要件定義プロセスを通して FIX していきます。
 */

import { useState, useEffect } from "react";

// ─── Design Tokens ───
const T = {
  sumi: "#2C2C2C",
  sumiLight: "#3E3E3C",
  dou: "#C4956A",
  douLight: "#D4AD87",
  washi: "#F5F3EF",
  washiDark: "#EBE8E2",
  white: "#FFFFFF",
  red: "#C25550",
  green: "#5B8C5A",
  gray: "#8A8A8A",
  grayLight: "#B8B5AF",
  shadow: "0 2px 12px rgba(44,44,44,0.08)",
  shadowLg: "0 8px 32px rgba(44,44,44,0.12)",
};

// ─── Mock Data ───
const DOJOS = [
  { id: 1, name: "蕨合気道会", initial: "蕨", color: T.dou, org: "公益財団法人合気会" },
  { id: 2, name: "合気道養神館", initial: "養", color: "#6B8E7B", org: "公益財団法人合気道養神会" },
];

const MEMBERS = [
  { id: 1, name: "田中 一郎", role: "owner", avatar: "🥋", dan: "五段" },
  { id: 2, name: "佐藤 花子", role: "admin", avatar: "👩", dan: "三段" },
  { id: 3, name: "鈴木 太郎", role: "member", avatar: "👨", dan: "初段" },
  { id: 4, name: "山田 美咲", role: "member", avatar: "👩‍🦰", dan: "二段" },
  { id: 5, name: "高橋 健一", role: "member", avatar: "🧑", dan: "1級" },
  { id: 6, name: "伊藤 さくら", role: "member", avatar: "👧", dan: "3級" },
];

const EVENTS = {
  3: [{ id: 1, time: "19:00〜21:00", place: "第一武道場", instructor: "田中 一郎", note: "基本技中心", attending: [1,2,3,5], declined: [4] }],
  7: [{ id: 2, time: "10:00〜12:00", place: "第一武道場", instructor: "佐藤 花子", note: "自由稽古", attending: [1,3,6], declined: [2] }],
  10: [{ id: 3, time: "19:00〜21:00", place: "第一武道場", instructor: "田中 一郎", note: "", attending: [2,4], declined: [] }],
  14: [{ id: 4, time: "10:00〜12:00", place: "第二武道場", instructor: "田中 一郎", note: "審査稽古", attending: [1,2,3,4,5,6], declined: [] }],
  17: [{ id: 5, time: "19:00〜21:00", place: "第一武道場", instructor: "佐藤 花子", note: "", attending: [1,5], declined: [3] }],
  21: [{ id: 6, time: "10:00〜12:00", place: "第一武道場", instructor: "田中 一郎", note: "", attending: [], declined: [] }],
  24: [{ id: 7, time: "19:00〜21:00", place: "第一武道場", instructor: "田中 一郎", note: "武器技", attending: [2,3,4], declined: [6] }],
  28: [{ id: 8, time: "10:00〜12:00", place: "第一武道場", instructor: "佐藤 花子", note: "", attending: [1], declined: [] }],
};

const ANNOUNCEMENTS = [
  { id: 1, title: "7月の審査について", body: "7月14日に昇級・昇段審査を実施します。受験希望者は7月7日までに田中師範へお知らせください。", date: "2026-06-20", read: false },
  { id: 2, title: "夏季合宿のご案内", body: "8月10日〜12日に夏季合宿を予定しています。詳細は追ってお知らせします。", date: "2026-06-15", read: true },
  { id: 3, title: "道場清掃のお願い", body: "6月28日の稽古後に大掃除を行います。雑巾等をご持参ください。", date: "2026-06-10", read: true },
];

const FEED_POSTS = [
  { id: 1, author: MEMBERS[2], text: "今日の稽古で四方投げのコツが少し掴めた気がします。先生のアドバイス通り、入身の角度を意識したら相手の崩しがスムーズに。", time: "2時間前", likes: 4, replies: 2, hasAikiNote: true },
  { id: 2, author: MEMBERS[3], text: "来週の審査稽古、参加します！一緒に頑張りましょう💪", time: "5時間前", likes: 6, replies: 3, hasAikiNote: false },
  { id: 3, author: MEMBERS[0], text: "本日の稽古お疲れ様でした。暑い中、皆さんよく頑張りました。水分補給をしっかりしてください。", time: "1日前", likes: 8, replies: 1, hasAikiNote: false },
  { id: 4, author: MEMBERS[4], text: "審査に向けて自主稽古の相手を探しています。土曜の午前中に都合がつく方、ぜひお声がけください。", time: "2日前", likes: 3, replies: 5, hasAikiNote: true },
];

const ACTIVITY = [
  { text: "田中 一郎が7月21日の稽古を追加", time: "3時間前", icon: "📅" },
  { text: "佐藤 花子がお知らせ「7月の審査について」を投稿", time: "5時間前", icon: "📢" },
  { text: "鈴木 太郎が7月3日の稽古に参加表明", time: "6時間前", icon: "✋" },
  { text: "山田 美咲が7月3日の稽古を不参加に変更", time: "8時間前", icon: "✕" },
  { text: "高橋 健一がフィードに投稿", time: "1日前", icon: "💬" },
];

function useViewport() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return { isSP: w < 768 };
}

// ─── PC Sidebar ───
function Sidebar({ dojos, active, onSwitch, collapsed, onToggle }) {
  const w = collapsed ? 58 : 220;
  return (
    <div style={{
      position: "fixed", left: 0, top: 0, bottom: 0, width: w,
      background: T.sumi, display: "flex", flexDirection: "column",
      zIndex: 100, borderRight: `1px solid ${T.sumiLight}`,
      transition: "width 0.2s ease",
    }}>
      <div style={{
        padding: collapsed ? "14px 0 12px" : "14px 14px 12px",
        display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between",
        borderBottom: `1px solid ${T.sumiLight}`, minHeight: 46,
      }}>
        {!collapsed && <span style={{ fontFamily: "'Zen Old Mincho', serif", fontSize: 15, fontWeight: 700, color: T.dou, letterSpacing: 1 }}>AikiBoard</span>}
        <button onClick={onToggle} style={{
          background: "none", border: "none", cursor: "pointer",
          color: T.grayLight, fontSize: 24, padding: 4,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 0.2s",
          transform: collapsed ? "rotate(180deg)" : "none",
        }}>«</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {dojos.map(d => (
          <div key={d.id} onClick={() => onSwitch(d.id)} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: collapsed ? "10px 0" : "10px 14px",
            justifyContent: collapsed ? "center" : "flex-start",
            cursor: "pointer",
            background: active === d.id ? `${T.dou}20` : "transparent",
            borderLeft: active === d.id ? `3px solid ${T.dou}` : "3px solid transparent",
            transition: "all 0.15s",
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, flexShrink: 0,
              background: d.color, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 14, fontWeight: 700, color: T.white,
            }}>{d.initial}</div>
            {!collapsed && <span style={{ fontSize: 13, color: T.white, fontWeight: active === d.id ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</span>}
          </div>
        ))}
      </div>
      <div style={{
        padding: collapsed ? "10px 0" : "10px 14px",
        borderTop: `1px solid ${T.sumiLight}`,
        display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
        justifyContent: collapsed ? "center" : "flex-start",
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10, border: `2px dashed ${T.grayLight}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, color: T.grayLight, flexShrink: 0,
        }}>＋</div>
        {!collapsed && <span style={{ fontSize: 12, color: T.grayLight }}>道場を追加</span>}
      </div>
    </div>
  );
}

// ─── SP Top Bar ───
function SPTopBar({ dojos, active, onSwitch }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "8px 10px", background: T.sumi,
      position: "sticky", top: 0, zIndex: 100,
    }}>
      <span style={{ fontFamily: "'Zen Old Mincho', serif", fontSize: 12, color: T.dou, fontWeight: 700 }}>AikiBoard</span>
      <div style={{ flex: 1 }} />
      {dojos.map(d => (
        <div key={d.id} onClick={() => onSwitch(d.id)} style={{
          width: 32, height: 32, borderRadius: d.id === active ? 10 : 16,
          background: d.color, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 13, fontWeight: 700, color: T.white,
          cursor: "pointer", border: d.id === active ? `2px solid ${T.dou}` : "2px solid transparent",
          transition: "all 0.2s",
        }}>{d.initial}</div>
      ))}
      <div style={{
        width: 32, height: 32, borderRadius: 16,
        border: `1.5px dashed ${T.grayLight}`, display: "flex",
        alignItems: "center", justifyContent: "center",
        fontSize: 15, color: T.grayLight, cursor: "pointer",
      }}>＋</div>
    </div>
  );
}

// ─── Calendar ───
function CalendarView({ onDayClick, isSP }) {
  const [month, setMonth] = useState(6);
  const year = 2026;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];
  const months = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
  const today = 9;

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const hasEvent = EVENTS[d];
    const isToday = d === today;
    const evCount = hasEvent ? hasEvent[0].attending.length : 0;
    cells.push(
      <div key={d} onClick={() => hasEvent && onDayClick(d)} style={{
        textAlign: "center", padding: isSP ? "7px 0" : "10px 0",
        cursor: hasEvent ? "pointer" : "default", position: "relative",
        borderRadius: 8, background: isToday ? T.washiDark : "transparent",
        transition: "background 0.15s",
      }}>
        <span style={{ fontSize: isSP ? 13 : 14, fontWeight: isToday ? 700 : 400, color: isToday ? T.dou : T.sumi }}>{d}</span>
        {hasEvent && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 2, marginTop: 2 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: T.dou }} />
            {!isSP && evCount > 0 && <span style={{ fontSize: 9, color: T.gray }}>{evCount}</span>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isSP ? "10px 10px" : "12px 14px" }}>
        <button onClick={() => setMonth(m => Math.max(0, m - 1))} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: T.sumi, padding: "4px 6px" }}>‹</button>
        <span style={{ fontFamily: "'Zen Old Mincho', serif", fontSize: 15, fontWeight: 600 }}>{year}年 {months[month]}</span>
        <button onClick={() => setMonth(m => Math.min(11, m + 1))} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: T.sumi, padding: "4px 6px" }}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: isSP ? "0 4px" : "0 10px" }}>
        {dayLabels.map(l => <div key={l} style={{ textAlign: "center", fontSize: 11, color: T.gray, padding: "6px 0 4px", fontWeight: 500 }}>{l}</div>)}
        {cells}
      </div>
    </div>
  );
}

// ─── Event Modal ───
function EventModal({ day, onClose, isSP }) {
  const events = EVENTS[day] || [];
  const [rsvp, setRsvp] = useState(null);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(44,44,44,0.4)",
      zIndex: 200, display: "flex",
      alignItems: isSP ? "flex-end" : "center", justifyContent: "center",
    }}>
      <div onClick={e => e.stopPropagation()} style={isSP
        ? { background: T.white, borderRadius: "18px 18px 0 0", width: "100%", maxHeight: "80vh", overflow: "auto", padding: "18px 14px 28px" }
        : { background: T.white, borderRadius: 14, width: "100%", maxWidth: 440, maxHeight: "80vh", overflow: "auto", padding: "22px 20px 24px", boxShadow: T.shadowLg }
      }>
        {isSP && <div style={{ width: 36, height: 4, borderRadius: 2, background: T.washiDark, margin: "0 auto 12px" }} />}
        <div style={{ fontFamily: "'Zen Old Mincho', serif", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>7月{day}日の稽古</div>
        {events.map(ev => (
          <div key={ev.id}>
            {[["時間", ev.time], ["場所", ev.place], ["指導", ev.instructor], ...(ev.note ? [["備考", ev.note]] : [])].map(([label, val]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 14 }}>
                <span style={{ color: T.gray, fontSize: 12, minWidth: 44 }}>{label}</span>
                <span>{val}</span>
              </div>
            ))}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>参加（{ev.attending.length}名）</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {ev.attending.map(id => {
                  const m = MEMBERS.find(x => x.id === id);
                  return (
                    <div key={id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px 3px 3px", borderRadius: 16, background: "#E8F0E8", fontSize: 12 }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: T.washiDark, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>{m.avatar}</div>
                      {m.name.split(" ")[0]}
                    </div>
                  );
                })}
              </div>
            </div>
            {ev.declined.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.gray, marginBottom: 6 }}>不参加（{ev.declined.length}名）</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {ev.declined.map(id => {
                    const m = MEMBERS.find(x => x.id === id);
                    return (
                      <div key={id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px 3px 3px", borderRadius: 16, background: "#F0E8E8", fontSize: 12 }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", background: T.washiDark, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>{m.avatar}</div>
                        {m.name.split(" ")[0]}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{ marginTop: 14, borderTop: `1px solid ${T.washiDark}`, paddingTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>出欠を表明する</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[["attend", "○ 参加", T.green], ["decline", "✕ 不参加", T.red]].map(([key, label, color]) => (
                  <button key={key} onClick={() => setRsvp(key)} style={{
                    padding: "8px 16px", borderRadius: 10, border: "none",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                    background: rsvp === key ? color : T.washiDark,
                    color: rsvp === key ? T.white : T.sumi, transition: "all 0.15s",
                  }}>{label}</button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Content Views ───
function AnnouncementsView({ p }) {
  return (
    <div>
      {ANNOUNCEMENTS.map(a => (
        <div key={a.id} style={{ padding: p, background: T.white, borderBottom: `1px solid ${T.washiDark}`, borderLeft: a.read ? "none" : `3px solid ${T.dou}` }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>
            {a.title}
            {!a.read && <span style={{ display: "inline-block", fontSize: 10, background: T.dou, color: T.white, padding: "1px 7px", borderRadius: 8, marginLeft: 6, verticalAlign: "middle" }}>NEW</span>}
          </div>
          <div style={{ fontSize: 13, color: T.sumiLight, lineHeight: 1.6 }}>{a.body}</div>
          <div style={{ fontSize: 11, color: T.gray, marginTop: 4 }}>{a.date}</div>
        </div>
      ))}
    </div>
  );
}

function FeedView({ p }) {
  return (
    <div>
      {FEED_POSTS.map(post => (
        <div key={post.id} style={{ padding: p, background: T.white, borderBottom: `1px solid ${T.washiDark}`, position: "relative" }}>
          {post.hasAikiNote && (
            <div style={{ position: "absolute", top: 10, right: 10, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: T.dou, background: `${T.dou}15`, padding: "2px 8px", borderRadius: 6 }}>
              📓 AikiNote の投稿から連携表示
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: T.washiDark, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>{post.author.avatar}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{post.author.name}</div>
              <div style={{ fontSize: 11, color: T.gray }}>{post.time}</div>
            </div>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 8 }}>{post.text}</div>
          <div style={{ display: "flex", gap: 16, fontSize: 12, color: T.gray }}>
            <span style={{ cursor: "pointer" }}>♡ {post.likes}</span>
            <span style={{ cursor: "pointer" }}>💬 {post.replies}</span>
            <span style={{ cursor: "pointer" }}>↗ 共有</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function MembersView({ p }) {
  const roleLabel = { owner: "オーナー", admin: "アドミン", member: "メンバー" };
  return (
    <div>
      {MEMBERS.map(m => (
        <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: p, borderBottom: `1px solid ${T.washiDark}`, background: T.white }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: T.washiDark, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>{m.avatar}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{m.name}</div>
            <div style={{ fontSize: 12, color: T.gray }}>{m.dan}</div>
          </div>
          <span style={{
            fontSize: 10, padding: "2px 8px", borderRadius: 8, fontWeight: 600,
            background: m.role === "owner" ? T.dou : m.role === "admin" ? T.sumiLight : T.washiDark,
            color: m.role === "member" ? T.sumi : T.white,
          }}>{roleLabel[m.role]}</span>
        </div>
      ))}
    </div>
  );
}

// ─── PC Right Panels ───
function UpcomingPanel() {
  const upcoming = Object.entries(EVENTS).slice(0, 3);
  return (
    <div style={{ background: T.white, borderRadius: 12, padding: "12px 12px", boxShadow: T.shadow }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, fontFamily: "'Zen Old Mincho', serif" }}>直近の稽古</div>
      {upcoming.map(([day, evs], i) => (
        <div key={day} style={{ padding: "7px 0", borderBottom: i < upcoming.length - 1 ? `1px solid ${T.washiDark}` : "none" }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>7月{day}日（{evs[0].time}）</div>
          <div style={{ fontSize: 12, color: T.gray }}>{evs[0].place} · {evs[0].instructor}</div>
          <div style={{ display: "flex", marginTop: 4 }}>
            {evs[0].attending.slice(0, 5).map(id => {
              const m = MEMBERS.find(x => x.id === id);
              return <div key={id} style={{ width: 20, height: 20, borderRadius: "50%", background: T.washiDark, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, marginRight: -3, border: `1.5px solid ${T.white}`, position: "relative", zIndex: 5 - id }}>{m.avatar}</div>;
            })}
            {evs[0].attending.length > 5 && <span style={{ fontSize: 10, color: T.gray, marginLeft: 8, alignSelf: "center" }}>+{evs[0].attending.length - 5}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityPanel() {
  return (
    <div style={{ background: T.white, borderRadius: 12, padding: "12px 12px", boxShadow: T.shadow }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, fontFamily: "'Zen Old Mincho', serif" }}>アクティビティ</div>
      {ACTIVITY.map((a, i) => (
        <div key={i} style={{ display: "flex", gap: 7, padding: "6px 0", borderBottom: i < ACTIVITY.length - 1 ? `1px solid ${T.washiDark}` : "none", fontSize: 12, lineHeight: 1.5 }}>
          <span style={{ fontSize: 13, flexShrink: 0 }}>{a.icon}</span>
          <div>
            <div style={{ color: T.sumi }}>{a.text}</div>
            <div style={{ color: T.gray, fontSize: 11 }}>{a.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main ───
export default function AikiBoardMock() {
  const { isSP } = useViewport();
  const [activeDojo, setActiveDojo] = useState(1);
  const [activeTab, setActiveTab] = useState("calendar");
  const [modalDay, setModalDay] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarW = sidebarCollapsed ? 58 : 220;

  const tabs = [
    { id: "calendar", label: "カレンダー", icon: "📅" },
    { id: "announce", label: "お知らせ", icon: "📢", badge: 1 },
    { id: "feed", label: "フィード", icon: "💬" },
    { id: "members", label: "メンバー", icon: "👥" },
  ];

  const dojo = DOJOS.find(d => d.id === activeDojo);
  const contentPad = isSP ? "10px 10px" : "12px 14px";
  const [settingsOpen, setSettingsOpen] = useState(false);

  const SETTINGS_MENU = [
    { section: "道場設定", items: [
      { icon: "🏷", label: "道場名・基本情報" },
      { icon: "🎨", label: "ロゴ・テーマカラー" },
      { icon: "🌐", label: "公開設定" },
    ]},
    { section: "公開ページ", items: [
      { icon: "🏠", label: "公開ページ管理" },
      { icon: "📅", label: "カレンダー公開設定" },
      { icon: "🔗", label: "共有リンク・QRコード" },
    ]},
    { section: "メンバー管理", items: [
      { icon: "👥", label: "メンバー招待" },
      { icon: "🔑", label: "ロール・権限管理" },
    ]},
    { section: "アカウント", items: [
      { icon: "💳", label: "プラン・お支払い" },
      { icon: "🔔", label: "通知設定" },
      { icon: "📊", label: "出欠集計ダッシュボード" },
    ]},
  ];

  return (
    <div style={{ fontFamily: "'Noto Sans JP', sans-serif", background: T.washi, minHeight: "100vh", color: T.sumi }}>
      <link href="https://fonts.googleapis.com/css2?family=Zen+Old+Mincho:wght@400;700&family=Noto+Sans+JP:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      {!isSP && <Sidebar dojos={DOJOS} active={activeDojo} onSwitch={setActiveDojo} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />}
      {isSP && <SPTopBar dojos={DOJOS} active={activeDojo} onSwitch={setActiveDojo} />}

      <div style={{ marginLeft: isSP ? 0 : sidebarW, transition: "margin-left 0.2s ease" }}>
        {/* Header */}
        <div style={{
          padding: isSP ? "8px 10px 6px" : "12px 14px 8px",
          background: T.white, borderBottom: `1px solid ${T.washiDark}`,
          position: "sticky", top: isSP ? 48 : 0, zIndex: 50,
          display: "flex", alignItems: "center",
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Zen Old Mincho', serif", fontSize: isSP ? 15 : 17, fontWeight: 700, letterSpacing: 0.5 }}>{dojo.name}</div>
            <div style={{ fontSize: 11, color: T.gray, marginTop: 1 }}>メンバー {MEMBERS.length}名 · {dojo.org}</div>
          </div>
          <button onClick={() => setSettingsOpen(true)} style={{
            background: "none", border: "none", cursor: "pointer",
            width: 36, height: 36, borderRadius: 8, display: "flex",
            alignItems: "center", justifyContent: "center", fontSize: 26,
            color: T.gray, transition: "background 0.15s",
          }} onMouseEnter={e => e.currentTarget.style.background = T.washiDark}
             onMouseLeave={e => e.currentTarget.style.background = "none"}>
            ⚙
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", background: T.white, borderBottom: `1px solid ${T.washiDark}`,
          position: "sticky", top: isSP ? 86 : 48, zIndex: 49,
        }}>
          {tabs.map(t => (
            <div key={t.id} onClick={() => setActiveTab(t.id)} style={{
              flex: 1, textAlign: "center", padding: isSP ? "9px 0 7px" : "10px 0 8px",
              fontSize: 13, fontWeight: activeTab === t.id ? 600 : 400,
              color: activeTab === t.id ? T.sumi : T.gray,
              borderBottom: activeTab === t.id ? `2px solid ${T.sumi}` : "2px solid transparent",
              cursor: "pointer", transition: "all 0.15s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
            }}>
              {isSP && <span style={{ fontSize: 13 }}>{t.icon}</span>}
              {(!isSP || activeTab === t.id) && t.label}
              {t.badge && <span style={{ fontSize: 9, background: T.dou, color: T.white, padding: "1px 5px", borderRadius: 6, fontWeight: 700 }}>{t.badge}</span>}
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{
          display: isSP ? "block" : "flex", gap: 14,
          padding: isSP ? 0 : "14px 14px 14px 14px",
          maxWidth: 1060,
        }}>
          <div style={isSP ? { paddingBottom: 56, margin: "10px 8px", background: T.white, borderRadius: 12, overflow: "hidden", boxShadow: T.shadow } : { flex: 1, minWidth: 0, background: T.white, borderRadius: 12, overflow: "hidden", boxShadow: T.shadow, minHeight: 480 }}>
            {activeTab === "calendar" && <CalendarView onDayClick={setModalDay} isSP={isSP} />}
            {activeTab === "announce" && <AnnouncementsView p={contentPad} />}
            {activeTab === "feed" && <FeedView p={contentPad} />}
            {activeTab === "members" && <MembersView p={contentPad} />}
          </div>

          {!isSP && (
            <div style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              <UpcomingPanel />
              <ActivityPanel />
            </div>
          )}
        </div>
      </div>

      {isSP && activeTab === "feed" && (
        <button style={{
          position: "fixed", bottom: 18, right: 14,
          width: 46, height: 46, borderRadius: 14,
          background: `linear-gradient(180deg, ${T.sumiLight}, ${T.sumi})`,
          color: T.white, border: "none", fontSize: 18,
          cursor: "pointer", boxShadow: T.shadowLg,
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80,
        }}>✏</button>
      )}

      {/* Settings Drawer */}
      {settingsOpen && (
        <div onClick={() => setSettingsOpen(false)} style={{
          position: "fixed", inset: 0, background: "rgba(44,44,44,0.35)",
          zIndex: 300, display: "flex", justifyContent: "flex-end",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: isSP ? "85%" : 320, maxWidth: 360, height: "100%",
            background: T.white, boxShadow: "-4px 0 24px rgba(44,44,44,0.12)",
            overflowY: "auto",
            animation: "slideIn 0.25s ease-out",
          }}>
            <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 14px 12px", borderBottom: `1px solid ${T.washiDark}`,
            }}>
              <span style={{ fontFamily: "'Zen Old Mincho', serif", fontSize: 15, fontWeight: 700 }}>設定</span>
              <button onClick={() => setSettingsOpen(false)} style={{
                background: "none", border: "none", cursor: "pointer",
                width: 34, height: 34, borderRadius: 8, display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: 18,
                color: T.gray,
              }}>✕</button>
            </div>
            {SETTINGS_MENU.map((sec, si) => (
              <div key={si}>
                <div style={{ padding: "12px 14px 4px", fontSize: 11, fontWeight: 600, color: T.gray, letterSpacing: 0.5 }}>{sec.section}</div>
                {sec.items.map((item, ii) => (
                  <div key={ii} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px", cursor: "pointer",
                    borderBottom: `1px solid ${T.washiDark}`,
                    transition: "background 0.1s",
                  }} onMouseEnter={e => e.currentTarget.style.background = T.washi}
                     onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <span style={{ fontSize: 16 }}>{item.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</span>
                    <span style={{ marginLeft: "auto", fontSize: 14, color: T.grayLight }}>›</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {modalDay && <EventModal day={modalDay} onClose={() => setModalDay(null)} isSP={isSP} />}
    </div>
  );
}
