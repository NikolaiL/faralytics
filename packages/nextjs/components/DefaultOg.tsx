import { OgLogo } from "~~/components/OgLogo";
import { PURPLES } from "~~/lib/activity";
import { BRAND_GRID } from "~~/lib/brand";

export function DefaultOg({ height, generatedAt }: { height: number; generatedAt: string }) {
  const chartTop = height === 600 ? 260 : 350;
  const step = 17;
  const width = BRAND_GRID[0].length * step;
  return (
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <OgLogo />
        <div style={{ display: "flex", fontSize: 16, color: "#a99aba" }}>FARCASTER, DAY BY DAY</div>
      </div>
      <div
        style={{
          display: "flex",
          marginTop: height === 600 ? 56 : 100,
          fontSize: 42,
          fontWeight: 700,
          color: "#d6ff3f",
        }}
      >
        Your year. One square at a time.
      </div>
      <div style={{ display: "flex", marginTop: 18, fontSize: 22, color: "#a99aba" }}>
        Every cast, like, and little connection.
      </div>
      <svg
        width={width}
        height={7 * step}
        viewBox={`0 0 ${width} ${7 * step}`}
        style={{ position: "absolute", left: (1200 - width) / 2, top: chartTop }}
      >
        {BRAND_GRID.flatMap((row, y) =>
          [...row].map((pixel, x) => (
            <rect
              key={`${x}:${y}`}
              x={x * step}
              y={y * step}
              width={13}
              height={13}
              rx="3"
              fill={pixel === "1" ? PURPLES[4] : PURPLES[(x * 17 + y * 29 + x * y * 7) % 3]}
            />
          )),
        )}
      </svg>
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: chartTop + 152,
          left: 64,
          right: 64,
          justifyContent: "center",
          fontSize: 20,
          color: "#a99aba",
        }}
      >
        Look up a username or FID. Explore a year. Share your chart.
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
        <div style={{ display: "flex" }}>Farcaster activity, visualized</div>
        <div style={{ display: "flex" }}>{`created with viniapp · ${generatedAt} UTC`}</div>
      </div>
    </div>
  );
}
