// Hono アプリ本体。Workers / Node 両方から共通利用される。
// Phase 0 では /health のみ。Phase 1 で /api/* ルートを追加していく。

import { type SupabaseClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { resolveSupabaseClient } from "./lib/supabase.js";

export type AppBindings = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_ANON_KEY?: string;
  JWT_SECRET?: string;
  NEXT_PUBLIC_APP_URL?: string;
  APP_URL?: string;
};

export type AppVariables = {
  supabase: SupabaseClient | null;
  userId?: string;
};

const app = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

const defaultAllowedOrigins = [
  "http://localhost:3000",
  "https://aiki-board.com",
  "https://www.aiki-board.com",
];

const normalizeOrigin = (origin: string): string => origin.replace(/\/+$/, "");

const getProcessEnv = (key: string): string | undefined => {
  return typeof process !== "undefined" ? process.env?.[key] : undefined;
};

app.use(logger());

app.use(
  cors({
    origin: (origin, c) => {
      const allowedOrigins = new Set(
        defaultAllowedOrigins.map(normalizeOrigin),
      );

      const envAppUrl =
        c.env?.NEXT_PUBLIC_APP_URL ?? getProcessEnv("NEXT_PUBLIC_APP_URL");
      if (envAppUrl) {
        allowedOrigins.add(normalizeOrigin(envAppUrl));
      }

      if (!origin) {
        return defaultAllowedOrigins[0];
      }

      const normalized = normalizeOrigin(origin);
      return allowedOrigins.has(normalized) ? origin : null;
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
);

// Supabase クライアントを Context に注入(env からは Cloudflare bindings, 開発時は process.env)
app.use(async (c, next) => {
  const env = {
    SUPABASE_URL: c.env?.SUPABASE_URL ?? getProcessEnv("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY:
      c.env?.SUPABASE_SERVICE_ROLE_KEY ??
      getProcessEnv("SUPABASE_SERVICE_ROLE_KEY"),
    SUPABASE_ANON_KEY:
      c.env?.SUPABASE_ANON_KEY ?? getProcessEnv("SUPABASE_ANON_KEY"),
  };

  const supabase = resolveSupabaseClient(env);
  c.set("supabase", supabase);

  return next();
});

// ヘルスチェック(/health)
// Cloudflare Workers のカスタムドメイン疎通確認 + BetterStack Uptime 等の監視に使う想定。
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "aikiboard-api",
    timestamp: new Date().toISOString(),
  });
});

// Phase 1 以降で /api/* ルートを追加していく(boards, board_members, events, ...)。

export type AppType = typeof app;

export default app;
