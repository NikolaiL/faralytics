import { InputError } from "~~/lib/activity";
import { resolveAccount } from "~~/lib/data";
import { globalWordCloudSelection, wordCloudSelection } from "~~/lib/word-cloud";
import { readGlobalWordCloud, readWordCloud } from "~~/lib/word-cloud-data";
import { reportServerError, withErrorReporting } from "~~/utils/reportServerError";

export const runtime = "nodejs";
export const GET = withErrorReporting("/api/word-cloud", async (request) => {
  try {
    const params = request.nextUrl.searchParams;
    const user = params.get("user");
    if (!user) {
      return Response.json(await readGlobalWordCloud(globalWordCloudSelection(params.get("period"))), {
        headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=300" },
      });
    }
    const fid = await resolveAccount(user);
    const selection = wordCloudSelection(params.get("period"), params.get("at"));
    return Response.json(await readWordCloud(fid, selection), { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (error) {
    if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
    reportServerError(error, "/api/word-cloud");
    return Response.json({ error: "Could not load the word cloud. Try again." }, { status: 502 });
  }
});
