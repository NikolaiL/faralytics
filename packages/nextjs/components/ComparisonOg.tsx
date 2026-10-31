import { OgStats, OverallOgHeading } from "./OgStats";
import { NumberText } from "./NumberText";
import {
  accountName,
  BLUES,
  colorLevel,
  comparisonPeak,
  grid,
  periodLabel,
  PURPLES,
  utcDate,
  type Activity,
} from "~~/lib/activity";
import { ogChartLayout } from "~~/lib/og-layout";
import { OgLogo } from "./OgLogo";

export function ComparisonOg({
  first,
  second,
  avatars,
  generatedAt,
  height,
}: {
  first: Activity;
  second: Activity;
  avatars: (string | null)[];
  generatedAt: string;
  height: number;
}) {
  const compact = height === 600;
  const peak = comparisonPeak(first, second);
  const layout = ogChartLayout(grid(first.days).columns);
  const tops = compact ? [160, 312] : [215, 375];
  const colors = [PURPLES[4], BLUES[4]];
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#0d0b12",
        color: "#f3eff9",
        padding: compact ? "20px 64px" : "38px 64px",
        fontFamily: "FaralyticsSans",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <OgLogo />
        <span style={{ fontSize: 15, color: "#a99aba" }}>A YEAR, SIDE BY SIDE</span>
      </div>
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 64,
          right: 64,
          top: compact ? 54 : 96,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {[first, second].map((data, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              flexDirection: index ? "row-reverse" : "row",
              alignItems: "center",
              gap: 12,
              width: 480,
              color: colors[index],
              fontSize: Math.max(18, Math.min(30, 620 / accountName(data).length)),
              fontWeight: 700,
            }}
          >
            <div
              style={{
                display: "flex",
                width: compact ? 34 : 42,
                height: compact ? 34 : 42,
                flexShrink: 0,
                borderRadius: "50%",
                background: index ? BLUES[1] : PURPLES[1],
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                fontSize: 18,
              }}
            >
              {avatars[index] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatars[index]!}
                  width={compact ? 34 : 42}
                  height={compact ? 34 : 42}
                  alt=""
                  style={{ borderRadius: "50%" }}
                />
              ) : (
                (data.profile.username || "fc").slice(0, 2)
              )}
            </div>
            <span>{accountName(data)}</span>
          </div>
        ))}
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 512,
            width: 48,
            justifyContent: "center",
            color: "#a99aba",
            fontSize: 18,
          }}
        >
          VS
        </div>
      </div>
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: compact ? 98 : 151,
          left: 69,
          right: 69,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <strong style={{ color: colors[0], fontSize: compact ? 32 : 40, fontWeight: 900, lineHeight: 1 }}>
          {first.total.toLocaleString("en-US")}
        </strong>
        <span style={{ color: "#a99aba", fontSize: 20, lineHeight: 1 }}>
          <NumberText preserveSpaces>{`Actions in ${periodLabel(first.period)}`}</NumberText>
        </span>
        <strong style={{ color: colors[1], fontSize: compact ? 32 : 40, fontWeight: 900, lineHeight: 1 }}>
          {second.total.toLocaleString("en-US")}
        </strong>
      </div>
      {[first, second].map((data, index) => {
        const { cells } = grid(data.days);
        return (
          <div
            key={index}
            style={{
              display: "flex",
              position: "absolute",
              left: layout.left,
              top: tops[index],
              width: layout.width,
              height: layout.height,
            }}
          >
            {cells
              .filter(
                (day, i) => utcDate(day.date).getUTCDate() === 1 || (i === 0 && utcDate(day.date).getUTCDate() <= 21),
              )
              .map((day) => (
                <span
                  key={day.date}
                  style={{
                    position: "absolute",
                    left: day.column * layout.step,
                    top: -19,
                    fontSize: 12,
                    color: "#a99aba",
                  }}
                >
                  {utcDate(day.date).toLocaleDateString("en", { month: "short", timeZone: "UTC" })}
                </span>
              ))}
            <svg
              width={layout.width}
              height={layout.height}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              style={{ position: "absolute", left: 0, top: 0 }}
            >
              {cells.map((day) => (
                <rect
                  key={day.date}
                  x={day.column * layout.step}
                  y={day.row * layout.step}
                  width={layout.cellSize}
                  height={layout.cellSize}
                  rx="3"
                  fill={day.future ? "#14111c" : (index ? BLUES : PURPLES)[colorLevel(day.actions, peak)]}
                />
              ))}
            </svg>
          </div>
        );
      })}
      <OgStats first={first} second={second} top={compact ? 454 : 530} height={compact ? 43 : 78} compact={compact} />
      {first.overall && second.overall && (
        <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: 1200, height }}>
          <OverallOgHeading first={first} second={second} top={compact ? 502 : 623} compact={compact} />
          <OgStats
            first={first.overall}
            second={second.overall}
            top={compact ? 540 : 682}
            height={compact ? 44 : 73}
            compact={compact}
          />
        </div>
      )}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 64,
          right: 64,
          bottom: compact ? 3 : 17,
          justifyContent: "space-between",
          fontSize: compact ? 10 : 12,
          color: "#857594",
        }}
      >
        <span>Captured activity · shared intensity scale · UTC</span>
        <span>
          <NumberText preserveSpaces>{`created with viniapp · ${generatedAt} UTC`}</NumberText>
        </span>
      </div>
    </div>
  );
}
