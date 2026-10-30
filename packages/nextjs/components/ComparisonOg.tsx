import { NumberText } from "./NumberText";
import {
  accountName,
  activityDate,
  BLUES,
  colorLevel,
  comparisonPeak,
  comparisonStats,
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
  const tops = compact ? [180, 345] : [255, 440];
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
          top: compact ? 68 : 112,
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
                width: 42,
                height: 42,
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
                <img src={avatars[index]!} width={42} height={42} alt="" style={{ borderRadius: "50%" }} />
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
          top: compact ? 119 : 174,
          left: 69,
          right: 69,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <strong style={{ color: colors[0], fontSize: compact ? 36 : 46, fontWeight: 900 }}>
          {first.total.toLocaleString("en-US")}
        </strong>
        <span style={{ color: "#a99aba", fontSize: 20 }}>
          <NumberText preserveSpaces>{`Actions in ${periodLabel(first.period)}`}</NumberText>
        </span>
        <strong style={{ color: colors[1], fontSize: compact ? 36 : 46, fontWeight: 900 }}>
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
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: compact ? 498 : 610,
          left: 64,
          right: 64,
          height: compact ? 74 : 119,
          gap: 16,
        }}
      >
        {comparisonStats(first, second).map((stat) => (
          <div
            key={stat.key}
            style={{
              display: "flex",
              flex: 1,
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              gap: stat.key === "peak" ? 3 : compact ? 5 : 12,
              border: "1px solid #352a43",
              background: "#18131f",
              borderRadius: 12,
              padding: compact ? "5px 10px" : "14px 20px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: stat.key === "peak" ? "column" : "row",
                alignItems: "center",
                gap: stat.key === "peak" ? 3 : 0,
                width: "100%",
                justifyContent: "space-around",
              }}
            >
              {[stat.first, stat.second].flatMap((value, index) => [
                <div
                  key={`value-${index}`}
                  style={{
                    display: "flex",
                    flexDirection: stat.key === "peak" ? "row" : "column",
                    alignItems: "center",
                    color: colors[index],
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      fontSize: compact ? (stat.key === "peak" ? 18 : 20) : 27,
                      fontWeight: 900,
                      gap: 5,
                    }}
                  >
                    {value.toLocaleString("en-US")}
                    {stat.winner === (index ? "second" : "first") && (
                      <svg
                        width={compact ? 15 : 20}
                        height={compact ? 15 : 20}
                        viewBox="0 0 24 24"
                        style={{ marginTop: compact ? 3 : 5 }}
                      >
                        <path
                          d="m5 12 4 4L19 6"
                          fill="none"
                          stroke={colors[index]}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  {stat.key === "peak" && (
                    <div style={{ display: "flex", fontSize: compact ? 9 : 12 }}>
                      <NumberText preserveSpaces>
                        {activityDate((index ? stat.secondDate : stat.firstDate) || null)}
                      </NumberText>
                    </div>
                  )}
                </div>,
                ...(stat.key === "peak" && index === 0
                  ? [
                      <div key="peak-label" style={{ display: "flex", fontSize: compact ? 10 : 14, color: "#a99aba" }}>
                        actions on busiest day{stat.winner === "tie" ? " · Tie" : ""}
                      </div>,
                    ]
                  : []),
              ])}
            </div>
            {stat.key !== "peak" && (
              <div style={{ display: "flex", fontSize: compact ? 11 : 15, color: "#a99aba" }}>
                {stat.label}
                {stat.winner === "tie" ? " · Tie" : ""}
              </div>
            )}
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 64,
          right: 64,
          bottom: compact ? 13 : 30,
          justifyContent: "space-between",
          fontSize: 12,
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
