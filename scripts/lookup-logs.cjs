const path = require('node:path');
require('../packages/nextjs/node_modules/@next/env').loadEnvConfig(path.resolve(__dirname, '../packages/nextjs'));
const { neon } = require('../packages/nextjs/node_modules/@neondatabase/serverless');
(async () => {
  const sql = neon(process.env.DATABASE_URL);
  const limit = Math.min(100, Math.max(1, Number(process.argv[2]) || 25));
  const rows = await sql`SELECT lookup_id, tool, created_at, viewed_fid::text, position, viewer_fid::text, viewer_ip::text, user_id, identity_source, metadata FROM lookup_log ORDER BY created_at DESC, lookup_id, position LIMIT ${limit}`;
  console.table(rows);
})().catch(() => { console.error('Could not read private lookup logs. Check database configuration.'); process.exit(1); });
