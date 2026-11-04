import { InputError } from "~~/lib/activity";
import { resolveAccount, searchAccounts } from "~~/lib/data";
import { loadProfiles } from "~~/lib/profile-data";
import { reportServerError, withErrorReporting } from "~~/utils/reportServerError";
export const runtime = "nodejs";
export const GET = withErrorReporting("/api/search", async (request) => {
  try {
    const params = request.nextUrl.searchParams;
    const input = params.get("q") || "";
    const profiles =
      params.get("exact") === "1"
        ? await loadProfiles([await resolveAccount(input)], 4000)
        : await searchAccounts(input);
    return Response.json(profiles, {
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
