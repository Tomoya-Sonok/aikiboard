import { Avatar } from "@/components/shared/Avatar/Avatar";
import type { RsvpMember } from "@/lib/types/event";
import styles from "./AttendeeList.module.css";

type Props = {
  label: string;
  members: RsvpMember[];
  emptyText?: string;
};

// 参加者・不参加者・未回答者の名簿(アバター + 氏名)。
export function AttendeeList({ label, members, emptyText }: Props) {
  return (
    <div className={styles.group}>
      <span className={styles.label}>
        {label}（{members.length}）
      </span>
      {members.length === 0 ? (
        <p className={styles.empty}>{emptyText ?? "—"}</p>
      ) : (
        <ul className={styles.list}>
          {members.map((m) => (
            <li key={m.userId} className={styles.item}>
              <Avatar
                name={m.username}
                imageUrl={m.profileImageUrl}
                size={24}
              />
              <span className={styles.name}>{m.username}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
