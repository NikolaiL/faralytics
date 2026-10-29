import { ImageResponse } from "next/og";
import { colorLevel, grid, InputError, periodLabel, PURPLES, utcDate } from "~~/lib/activity";
import { loadActivity } from "~~/lib/data";
import { reportServerError, withErrorReporting } from "~~/utils/reportServerError";
export const runtime = "nodejs";
export const GET = withErrorReporting<{ params: Promise<{ format: string }> }>(
  "/api/og/[format]",
  async (request, context) => {
    const { format } = await context.params;
    if (format !== "farcaster.png" && format !== "x.png")
      return new Response("Image format not found", { status: 404 });
    const params = request.nextUrl.searchParams;
    try {
      const data = await loadActivity(
        params.get("fid") || "366713",
        params.get("period") || "365",
        params.get("end") || undefined,
      );
      const generatedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
      const height = format === "x.png" ? 600 : 800;
      const { cells, columns } = grid(data.days);
      const step = 19,
        cellSize = 15;
      const left = 70,
        chartTop = height === 600 ? 280 : 360;
      const months = cells.filter(
        (day, index) => utcDate(day.date).getUTCDate() === 1 || (index === 0 && utcDate(day.date).getUTCDate() <= 21),
      );
      return new ImageResponse(
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            background: "#0d0b12",
            color: "#f3eff9",
            padding: "48px 64px",
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", fontSize: 27, fontWeight: 700, color: "#b596f2" }}>cast year.</div>
            <div style={{ display: "flex", fontSize: 16, color: "#a99aba" }}>FARCASTER, DAY BY DAY</div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 40,
              fontWeight: 700,
              marginTop: height === 600 ? 32 : 62,
              maxWidth: 1000,
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            {data.profile.username ? `@${data.profile.username}` : `FID ${data.profile.fid}`}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", marginTop: 14, gap: 12 }}>
            <div style={{ display: "flex", fontSize: height === 600 ? 54 : 66, fontWeight: 700 }}>
              {data.total.toLocaleString("en-US")}
            </div>
            <div style={{ display: "flex", fontSize: 25, color: "#aa9bbd" }}>actions in {periodLabel(data.period)}</div>
          </div>
          {months.map((day) => (
            <div
              key={day.date}
              style={{
                display: "flex",
                position: "absolute",
                left: left + day.column * step,
                top: chartTop - 28,
                fontSize: 15,
                color: "#a99aba",
              }}
            >
              {utcDate(day.date).toLocaleDateString("en", { month: "short", timeZone: "UTC" })}
            </div>
          ))}
          <svg
            width={columns * step}
            height={7 * step}
            viewBox={`0 0 ${columns * step} ${7 * step}`}
            style={{ position: "absolute", left, top: chartTop }}
          >
            {cells.map((day) => (
              <rect
                key={day.date}
                x={day.column * step}
                y={day.row * step}
                width={cellSize}
                height={cellSize}
                rx="3"
                fill={day.future ? "#14111c" : PURPLES[colorLevel(day.actions, data.peak)]}
              />
            ))}
          </svg>
          <div style={{ display: "flex", position: "absolute", left, top: chartTop + 163, gap: 54 }}>
            <div style={{ display: "flex", fontSize: 19, color: "#bdafce" }}>{data.activeDays} active days</div>
            <div style={{ display: "flex", fontSize: 19, color: "#bdafce" }}>
              {data.longestStreak}-day longest streak
            </div>
            <div style={{ display: "flex", fontSize: 19, color: "#bdafce" }}>
              {data.peak} actions on the busiest day
            </div>
          </div>
          <div
            style={{
              display: "flex",
              position: "absolute",
              left: 64,
              right: 64,
              bottom: 35,
              justifyContent: "space-between",
              fontSize: 14,
              color: "#857594",
            }}
          >
            <div style={{ display: "flex" }}>Captured activity · incomplete history · UTC</div>
            <div style={{ display: "flex" }}>{`created with viniapp · ${generatedAt} UTC`}</div>
          </div>
        </div>,
        {
          width: 1200,
          height,
          headers: { "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600" },
        },
      );
    } catch (error) {
      if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
      reportServerError(error, "/api/og/[format]");
      return Response.json({ error: "Could not generate the chart image. Please try again." }, { status: 502 });
    }
  },
);
