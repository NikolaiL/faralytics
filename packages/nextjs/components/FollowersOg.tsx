import {
  FOLLOWER_COLORS,
  compactNumber,
  followerDate,
  followerDomain,
  followerName,
  followerTimeTicks,
  followerTick,
  type FollowerChartData,
} from "~~/lib/followers";
import { OgLogo } from "./OgLogo";

export function FollowersOg({
  data,
  avatars = [],
  height,
  generatedAt,
}: {
  data: FollowerChartData;
  avatars?: (string | null)[];
  height: number;
  generatedAt: string;
}) {
  const domain = followerDomain(data);
  const many = data.series.length > 4;
  const plot = { left: 125, right: 1131, top: many ? 245 : 212, bottom: height - 93 };
  const x = (ts: number) => plot.left + ((ts - domain.start) / (domain.end - domain.start)) * (plot.right - plot.left);
  const y = (value: number) =>
    plot.bottom - ((value - domain.min) / (domain.max - domain.min)) * (plot.bottom - plot.top);
  const legendCols = data.series.length > 5 ? 2 : 1;
  const legendRows = Math.ceil(data.series.length / legendCols);
  const legendRowHeight = many ? 30 : 39;
  const legendWidth = 710 / legendCols;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#0d0b12",
        color: "#f3eff9",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", position: "absolute", left: 64, top: 48 }}>
        <OgLogo />
      </div>
      <div style={{ display: "flex", position: "absolute", top: 104, left: 64, fontSize: 32, fontWeight: 700 }}>
        Followers
      </div>
      <div style={{ display: "flex", position: "absolute", top: 149, left: 64, color: "#a99aba", fontSize: 14 }}>
        {data.series.length} {data.series.length === 1 ? "account" : "accounts"} · shared scale
      </div>
      <div style={{ display: "flex", position: "absolute", left: 426, top: 25, color: "#857594", fontSize: 12 }}>
        CURRENT CAPTURED FOLLOWERS
      </div>
      {data.series.map((series, index) => {
        const column = Math.floor(index / legendRows),
          row = index % legendRows;
        const name = followerName(series),
          nameSize = many
            ? Math.max(13, Math.min(17, 240 / name.length))
            : Math.max(17, Math.min(23, 500 / name.length));
        return (
          <div
            key={series.profile.fid}
            style={{
              display: "flex",
              position: "absolute",
              left: 426 + column * legendWidth,
              top: 48 + row * legendRowHeight,
              width: legendWidth - 18,
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                width: 18,
                height: 4,
                background: FOLLOWER_COLORS[index],
                flexShrink: 0,
                borderRadius: 2,
              }}
            />
            <div
              style={{
                display: "flex",
                width: many ? 22 : 28,
                height: many ? 22 : 28,
                flexShrink: 0,
                borderRadius: "50%",
                background: "#30243d",
                overflow: "hidden",
                justifyContent: "center",
                alignItems: "center",
                color: FOLLOWER_COLORS[index],
                fontSize: 10,
              }}
            >
              {avatars[index] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatars[index]!}
                  width={many ? 22 : 28}
                  height={many ? 22 : 28}
                  alt=""
                  style={{ borderRadius: "50%" }}
                />
              ) : (
                name.replace(/^@/, "").slice(0, 2)
              )}
            </div>
            <div
              style={{
                display: "flex",
                flex: 1,
                fontSize: nameSize,
                color: FOLLOWER_COLORS[index],
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              {name}
            </div>
            <div style={{ display: "flex", fontSize: many ? 15 : 21, color: "#d4c9e1" }}>
              {series.followers === null ? "—" : compactNumber(series.followers)}
            </div>
          </div>
        );
      })}
      <div
        style={{ display: "flex", position: "absolute", left: 69, top: plot.top - 33, fontSize: 14, color: "#a99aba" }}
      >
        Captured follows minus unfollows
      </div>
      {data.from ? (
        <svg
          width={1200}
          height={height}
          viewBox={`0 0 1200 ${height}`}
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          {domain.yTicks.map((value) => (
            <path key={value} d={`M${plot.left} ${y(value)}H${plot.right}`} fill="none" stroke="#30263d" />
          ))}
          {data.series.map((series, index) => (
            <path
              key={series.profile.fid}
              d={series.points
                .map((point, i) => `${i ? "L" : "M"}${x(point.ts).toFixed(2)},${y(point.value).toFixed(2)}`)
                .join(" ")}
              fill="none"
              stroke={FOLLOWER_COLORS[index]}
              strokeWidth={4}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </svg>
      ) : (
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 125,
            top: plot.top + 80,
            color: "#a99aba",
            fontSize: 25,
          }}
        >
          No captured follow history yet
        </div>
      )}
      {data.from &&
        domain.yTicks.map((value) => (
          <div
            key={`y-${value}`}
            style={{
              display: "flex",
              position: "absolute",
              left: 64,
              top: y(value) - 8,
              width: 46,
              justifyContent: "flex-end",
              color: "#a99aba",
              fontSize: 15,
            }}
          >
            {compactNumber(value)}
          </div>
        ))}
      {data.from &&
        followerTimeTicks(domain.start, domain.end).map((ts) => (
          <div
            key={`x-${ts}`}
            style={{
              display: "flex",
              position: "absolute",
              left: x(ts) - 34,
              top: plot.bottom + 14,
              width: 68,
              justifyContent: "center",
              color: "#a99aba",
              fontSize: 14,
            }}
          >
            {followerTick(ts, domain.start, domain.end)}
          </div>
        ))}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 64,
          right: 64,
          bottom: 30,
          justifyContent: "space-between",
          color: "#857594",
          fontSize: 12,
        }}
      >
        <span>Partial history · UTC · {data.from ? `from ${followerDate(domain.start)}` : "no history"}</span>
        <span>{`created with viniapp · ${generatedAt} UTC`}</span>
      </div>
    </div>
  );
}
