-- 0009_grant_aikiboard_to_service_role.sql
-- backend(Cloudflare Workers)は SERVICE_ROLE_KEY で aikiboard スキーマを
-- supabase-js(REST/PostgREST)経由で読み書きする。
--
-- ところが 0001 の ALTER DEFAULT PRIVILEGES は authenticated / anon にのみ
-- テーブル権限を付与しており、service_role には schema USAGE しか無い。
-- そのままでは backend(service_role)が aikiboard.* を操作できないため、
-- ここで service_role にテーブル/シーケンス権限を付与する。
--
-- RLS は authenticated / anon にのみ適用され service_role はバイパスするので、
-- ここで付与する権限と RLS は両立する(RLS は防御層として維持)。
-- forward-only(ADR 0004)。既に権限がある場合は no-op。

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA aikiboard TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA aikiboard TO service_role;

-- 以降に追加されるテーブル/シーケンスにも自動付与
ALTER DEFAULT PRIVILEGES IN SCHEMA aikiboard
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA aikiboard
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;
