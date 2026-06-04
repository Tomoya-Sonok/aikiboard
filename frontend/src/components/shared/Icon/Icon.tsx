import type { CSSProperties } from "react";

// docs/design/claude_design_prototype.tsx の Icon から、当面シェルで使う分だけ移植。
// 色は currentColor 固定で、親要素の color / CSS 変数で着色する。
export type IconName =
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
  | "chevron-double-left"
  | "plus"
  | "globe";

type IconProps = {
  name: IconName;
  size?: number;
  stroke?: number;
  className?: string;
  style?: CSSProperties;
};

export function Icon({
  name,
  size = 16,
  stroke = 1.5,
  className,
  style,
}: IconProps) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    width: size,
    height: size,
    className,
    style,
  };
  switch (name) {
    case "home":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="3" y="4.5" width="18" height="16.5" rx="1" />
          <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
        </svg>
      );
    case "megaphone":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M4 10v4a1 1 0 0 0 1 1h2l8 5V4L7 9H5a1 1 0 0 0-1 1Z" />
          <path d="M18 8a4 4 0 0 1 0 8" />
        </svg>
      );
    case "feed":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-3.2-6.9L21 4v5h-5" />
          <path d="M8 12h8M8 16h5" />
        </svg>
      );
    case "archive":
      return (
        <svg {...common} aria-hidden="true">
          <rect x="3" y="4" width="18" height="4" rx="0.5" />
          <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" />
        </svg>
      );
    case "yen":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M7 4l5 8 5-8M7 14h10M7 18h10M12 12v9" />
        </svg>
      );
    case "users":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20c.5-3.5 3.5-5.5 6.5-5.5S15 16.5 15.5 20" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M22 18c-.3-2.5-2-4-4-4" />
        </svg>
      );
    case "activity":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M3 12h4l3-7 4 14 3-7h4" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
        </svg>
      );
    case "search":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z" />
          <path d="M10 21a2 2 0 0 0 4 0" />
        </svg>
      );
    case "chevron-down":
      return (
        <svg {...common} aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
    case "chevron-double-left":
      return (
        <svg {...common} aria-hidden="true">
          <path d="m14 6-6 6 6 6M20 6l-6 6 6 6" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common} aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "globe":
      return (
        <svg {...common} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 3 4 6 4 9s-1.5 6-4 9c-2.5-3-4-6-4-9s1.5-6 4-9Z" />
        </svg>
      );
    default:
      return null;
  }
}
