import { getDb } from "~~/utils/db";
import { withErrorReporting, reportServerError } from "~~/utils/reportServerError";
export const runtime = "nodejs";
export const GET = withErrorReporting("/api/health/db", async () => {
  try {
    const sql = getDb();
    await sql`SELECT 1 FROM lookup_events LIMIT 0`;
    await sql`SELECT 1 FROM lookup_accounts LIMIT 0`;
    return Response.json({ database: "connected" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    reportServerError(error, "/api/health/db");
    return Response.json({ database: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
});
