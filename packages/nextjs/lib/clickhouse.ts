import { request } from "node:https";

export async function query<T>(
  sql: string,
  parameters: Record<string, string> = {},
  options: { timeoutMs?: number } = {},
): Promise<T[]> {
  const { CLICKHOUSE_URL, CLICKHOUSE_USER, CLICKHOUSE_PASSWORD, CLICKHOUSE_CA_CERT } = process.env;
  if (!CLICKHOUSE_URL || !CLICKHOUSE_USER || !CLICKHOUSE_PASSWORD || !CLICKHOUSE_CA_CERT)
    throw new Error("The activity database is not configured.");
  const url = new URL(CLICKHOUSE_URL);
  if (url.protocol !== "https:") throw new Error("The activity database requires HTTPS.");
  url.searchParams.set("database", "farcaster");
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(`param_${key}`, value);
  return new Promise((resolve, reject) => {
    const upstream = request(
      url,
      {
        method: "POST",
        ca: CLICKHOUSE_CA_CERT.replace(/\\n/g, "\n"),
        auth: `${CLICKHOUSE_USER}:${CLICKHOUSE_PASSWORD}`,
        headers: { "Content-Type": "text/plain" },
        signal: AbortSignal.timeout(options.timeoutMs ?? 35_000),
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("error", () => reject(new Error("The activity database connection was interrupted.")));
        response.on("data", (chunk) => {
          body += chunk;
          if (body.length > 2_000_000) upstream.destroy(new Error("Activity response was too large."));
        });
        response.on("end", () => {
          if (response.statusCode !== 200) {
            reject(new Error("The activity database could not complete the request. Please try again."));
            return;
          }
          try {
            resolve(JSON.parse(body).data);
          } catch {
            reject(new Error("The activity database returned an unreadable response."));
          }
        });
      },
    );
    upstream.on("error", () => reject(new Error("Could not reach the activity database. Please try again.")));
    upstream.end(`${sql}\nFORMAT JSON`);
  });
}
