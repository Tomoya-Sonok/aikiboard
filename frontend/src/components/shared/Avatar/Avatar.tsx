import styles from "./Avatar.module.css";

type Props = {
  name: string;
  imageUrl?: string | null;
  size?: number;
};

// プロフィール画像があれば画像、無ければ氏名の頭文字を表示する小さなアバター。
export function Avatar({ name, imageUrl, size = 28 }: Props) {
  const dimension = { width: size, height: size };
  if (imageUrl) {
    return (
      // biome-ignore lint/performance/noImgElement: Supabase Storage の任意ドメイン画像。next/image の remotePatterns 設定を避けて <img> を使う
      <img
        src={imageUrl}
        alt={name}
        className={styles.image}
        style={dimension}
      />
    );
  }
  const initial = (name || "?").charAt(0).toUpperCase();
  return (
    <span
      className={styles.initial}
      style={{ ...dimension, fontSize: Math.round(size * 0.42) }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
