import { neon } from "@neondatabase/serverless";

let sql: ReturnType<typeof neon> | undefined;
export function getDb() {
  if (!sql) {
    const value = process.env.DATABASE_URL;
    if (!value) throw new Error("DATABASE_URL_MISSING");
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error("DATABASE_URL_INVALID");
    }
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.hostname ||
      !url.username ||
      !url.password ||
      ["localhost", "127.0.0.1", "[::1]", "0.0.0.0"].includes(url.hostname)
    )
      throw new Error("DATABASE_URL_INVALID");
    sql = neon(value);
  }
  return sql;
}
