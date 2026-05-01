// Node.js ローカル開発用エントリーポイント(tsx watch で起動)。
// 本番は src/index.worker.ts が wrangler 経由でデプロイされる。

import { serve } from "@hono/node-server";
import app from "./app.js";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);

serve({
  fetch: app.fetch,
  port,
});

console.log(`AikiBoard API server running on http://localhost:${port}`);
