import { InputError } from "~~/lib/activity";
import { searchAccounts } from "~~/lib/data";
import { reportServerError, withErrorReporting } from "~~/utils/reportServerError";
export const runtime = "nodejs";
export const GET = withErrorReporting("/api/search", async (request) => {
  try {
    return Response.json(await searchAccounts(request.nextUrl.searchParams.get("q") || ""), {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
    });
  } catch (error) {
    if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
    reportServerError(error, "/api/search");
    return Response.json(
      { error: "Search is temporarily unavailable. You can still look up an exact username or FID." },
      { status: 502 },
    );
  }
});
