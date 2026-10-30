const fs = require('node:fs');
const path = require('node:path');
const { loadEnvConfig } = require('../packages/nextjs/node_modules/@next/env');
const { neon } = require('../packages/nextjs/node_modules/@neondatabase/serverless');
loadEnvConfig(path.resolve(__dirname, '../packages/nextjs'));
(async () => {
  const sql = neon(process.env.DATABASE_URL);
  await sql`SELECT 1`;
  for (const filename of fs.readdirSync(path.join(__dirname, '../db/migrations')).filter(f => f.endsWith('.sql')).sort()) {
    const statements = fs.readFileSync(path.join(__dirname, '../db/migrations', filename), 'utf8').split(';').map(s => s.trim()).filter(Boolean);
    await sql.transaction(statements.map(statement => sql.query(statement)));
    console.log('Applied ' + filename);
  }
  const rows = await sql`SELECT count(*)::int AS tables FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('lookup_events', 'lookup_accounts')`;
  if (rows[0].tables !== 2) throw Error('Lookup tables missing');
  console.log('Database connection and lookup tables verified.');
})().catch(() => { console.error('Database migration failed; check server configuration.'); process.exit(1); });
