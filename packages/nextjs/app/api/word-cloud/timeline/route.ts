import { InputError } from "~~/lib/activity";
import { resolveAccount } from "~~/lib/data";
import { wordCloudSelection } from "~~/lib/word-cloud";
import { readWordCloudTimeline } from "~~/lib/word-cloud-data";
import { reportServerError, withErrorReporting } from "~~/utils/reportServerError";

export const runtime = "nodejs";
export const maxDuration = 30;
export const GET = withErrorReporting("/api/word-cloud/timeline", async (request) => {
  try {
    const params = request.nextUrl.searchParams;
    const fid = await resolveAccount(params.get("user") || "");
    const { at } = wordCloudSelection("all", params.get("at"));
    const page = params.get("page") ?? "0";
    if (!/^\d{1,4}$/.test(page)) throw new InputError("Choose a valid timeline page.");
    const data = await readWordCloudTimeline(fid, at, Number(page));
    return Response.json(data, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (error) {
    if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
    reportServerError(error, "/api/word-cloud/timeline");
    return Response.json({ error: "Could not load the Time Machine. Try again." }, { status: 502 });
  }
});
