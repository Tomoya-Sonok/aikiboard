-- 0014_create_board_media_bucket.sql
-- 道場内フィード(4.3)・アーカイブ(4.4)の画像/動画添付を保存する Supabase Storage バケット。
--
-- 方針:
--   - 非公開バケット(public = false)。メディアはボードのメンバーのみが見られるべきため、
--     公開 URL は発行しない。
--   - アップロードは backend(service_role)が `createSignedUploadUrl` で発行する署名付き URL
--     経由で行う(フロントは署名トークンで直接 Storage に PUT する)。
--   - 表示は backend(service_role)が `createSignedUrl` で都度発行する署名付き DL URL(短命)
--     経由で行う。これにより storage.objects への RLS ポリシーは不要(全アクセスが
--     service_role 署名トークン経由になるため)。
--   - パス規約: フィードは `feed/<board_id>/<uuid>.<ext>`、アーカイブは
--     `archive/<board_id>/<uuid>.<ext>`。backend がパスを生成し、ボード越境を防ぐ。
--
-- 本番(Supabase Dashboard SQL Editor)でもこのファイルを実行すればバケットが作られる。
-- 代替として Dashboard → Storage → New bucket で同名・非公開・同上限で作成しても良い。

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'board-media',
  'board-media',
  false,
  -- 100MB(動画も想定。MVP の暫定上限。確定後に UPDATE で調整する)
  104857600,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
ON CONFLICT (id) DO NOTHING;
