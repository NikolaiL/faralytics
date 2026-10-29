import { OgLogo } from "~~/components/OgLogo";
import { ImageResponse } from "next/og";
import { DefaultOg } from "~~/components/DefaultOg";
import { activityDate, colorLevel, grid, InputError, periodLabel, PURPLES, utcDate } from "~~/lib/activity";
import { loadAvatar } from "~~/lib/avatar";
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
      if (!params.has("fid")) {
        const height = format === "x.png" ? 600 : 800;
        const generatedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
        return new ImageResponse(<DefaultOg height={height} generatedAt={generatedAt} />, {
          width: 1200,
          height,
          headers: { "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600" },
        });
      }
      const data = await loadActivity(
        params.get("fid") || "",
        params.get("period") || "365",
        params.get("end") || undefined,
      );
      const avatarBytes = await loadAvatar(data.profile.pfp_url);
      const avatar = avatarBytes ? `data:image/png;base64,${avatarBytes.toString("base64")}` : null;
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
            <OgLogo />
            <div style={{ display: "flex", fontSize: 16, color: "#a99aba" }}>FARCASTER, DAY BY DAY</div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 40,
              fontWeight: 700,
              alignItems: "center",
              gap: 18,
              color: "#d6ff3f",
              marginTop: height === 600 ? 32 : 62,
              maxWidth: 1000,
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            <div
              style={{
                display: "flex",
                width: 56,
                height: 56,
                flexShrink: 0,
                borderRadius: "50%",
                overflow: "hidden",
                background: "#3f2a61",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
              }}
            >
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} width={56} height={56} alt="" style={{ borderRadius: "50%" }} />
              ) : (
                (data.profile.username || "fc").slice(0, 2)
              )}
            </div>
            <div style={{ display: "flex" }}>
              {data.profile.username ? `@${data.profile.username}` : `FID ${data.profile.fid}`}
            </div>
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
          <div
            style={{
              display: "flex",
              position: "absolute",
              left: 64,
              right: 64,
              top: chartTop + 160,
              bottom: 90,
              gap: 16,
            }}
          >
            {[
              { label: "Active days", value: `${data.activeDays.toLocaleString("en-US")} days` },
              { label: "Longest streak", value: `${data.longestStreak.toLocaleString("en-US")} days` },
              { label: "Busiest day:", value: activityDate(data.peakDate) },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  display: "flex",
                  flex: 1,
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 10,
                  padding: "14px 22px",
                  background: "#18131f",
                  border: "1px solid #352a43",
                  borderRadius: 12,
                }}
              >
                <div style={{ display: "flex", fontSize: 15, color: "#a99aba" }}>{stat.label}</div>
                <div style={{ display: "flex", fontSize: height === 600 ? 26 : 32, fontWeight: 700 }}>{stat.value}</div>
              </div>
            ))}
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
