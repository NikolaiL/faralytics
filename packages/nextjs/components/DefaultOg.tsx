import { NumberText } from "./NumberText";
import { ogChartLayout } from "~~/lib/og-layout";
import { OgLogo } from "~~/components/OgLogo";
import { PURPLES } from "~~/lib/activity";
import { BRAND_GRID, brandCellLevel } from "~~/lib/brand";

export function DefaultOg({ height, generatedAt }: { height: number; generatedAt: string }) {
  const chartTop = height === 600 ? 260 : 350;
  const { left, width, height: chartHeight, step, cellSize } = ogChartLayout(BRAND_GRID[0].length);
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
        fontFamily: "FaralyticsSans",
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
        height={chartHeight}
        viewBox={`0 0 ${width} ${chartHeight}`}
        style={{ position: "absolute", left, top: chartTop }}
      >
        {BRAND_GRID.flatMap((row, y) =>
          [...row].map((pixel, x) => (
            <rect
              key={`${x}:${y}`}
              x={x * step}
              y={y * step}
              width={cellSize}
              height={cellSize}
              rx="3"
              fill={PURPLES[brandCellLevel(pixel, x, y)]}
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
        <div style={{ display: "flex" }}>
          <NumberText preserveSpaces>{`created with viniapp · ${generatedAt} UTC`}</NumberText>
        </div>
      </div>
    </div>
  );
}
