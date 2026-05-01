// Cloudflare Workers エントリーポイント。
// wrangler は本ファイルをバンドルして Workers ランタイムにデプロイする。

import app from "./app.js";

export default {
  fetch: app.fetch,
};
