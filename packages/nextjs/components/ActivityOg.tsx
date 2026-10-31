import { NumberText } from "./NumberText";
import { ogChartLayout } from "~~/lib/og-layout";
import { OgLogo } from "./OgLogo";
import { OgStats, OverallOgHeading } from "./OgStats";
import { colorLevel, grid, periodLabel, PURPLES, utcDate, type Activity } from "~~/lib/activity";
export function ActivityOg({
  data,
  avatar,
  generatedAt,
  height,
}: {
  data: Activity;
  avatar: string | null;
  generatedAt: string;
  height: number;
}) {
  const compact = height === 600;
  const { cells, columns } = grid(data.days);
  const layout = ogChartLayout(columns);
  const chartTop = compact ? 170 : 208;
  const profileLabel = data.profile.username ? `@${data.profile.username}` : `FID ${data.profile.fid}`;
  const statsTop = chartTop + layout.height + 18;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#0d0b12",
        color: "#f3eff9",
        fontFamily: "FaralyticsSans",
      }}
    >
      <div style={{ display: "flex", position: "absolute", top: compact ? 26 : 40, left: 64 }}>
        <OgLogo />
      </div>
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: compact ? 20 : 34,
          left: 360,
          right: 64,
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 12,
          color: "#d6ff3f",
          fontSize: Math.min(32, 650 / Math.max(1, profileLabel.length * 0.6)),
          fontWeight: 700,
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 44,
            height: 44,
            flexShrink: 0,
            borderRadius: "50%",
            overflow: "hidden",
            background: "#3f2a61",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
          }}
        >
          {avatar ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={avatar} width={44} height={44} alt="" style={{ borderRadius: "50%" }} />
          ) : (
            (data.profile.username || "fc").slice(0, 2)
          )}
        </div>
        <span>{profileLabel}</span>
      </div>
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: compact ? 90 : 112,
          left: 64,
          alignItems: "center",
          gap: 14,
        }}
      >
        <strong style={{ fontSize: compact ? 47 : 60, fontWeight: 900, lineHeight: 1 }}>
          {data.total.toLocaleString("en-US")}
        </strong>
        <div style={{ display: "flex", fontSize: 23, lineHeight: 1, color: "#a99aba" }}>
          <NumberText preserveSpaces>{`actions in ${periodLabel(data.period)}`}</NumberText>
        </div>
      </div>
      {cells
        .filter(
          (day, index) => utcDate(day.date).getUTCDate() === 1 || (index === 0 && utcDate(day.date).getUTCDate() <= 21),
        )
        .map((day) => (
          <div
            key={day.date}
            style={{
              display: "flex",
              position: "absolute",
              left: layout.left + day.column * layout.step,
              top: chartTop - 24,
              fontSize: 14,
              color: "#a99aba",
            }}
          >
            {utcDate(day.date).toLocaleDateString("en", { month: "short", timeZone: "UTC" })}
          </div>
        ))}
      <svg
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        style={{ position: "absolute", left: layout.left, top: chartTop }}
      >
        {cells.map((day) => (
          <rect
            key={day.date}
            x={day.column * layout.step}
            y={day.row * layout.step}
            width={layout.cellSize}
            height={layout.cellSize}
            rx="3"
            fill={day.future ? "#14111c" : PURPLES[colorLevel(day.actions, data.peak)]}
          />
        ))}
      </svg>
      <OgStats first={data} top={statsTop} height={compact ? 90 : 150} compact={compact} />
      {data.overall && (
        <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: 1200, height }}>
          <OverallOgHeading first={data} top={compact ? 442 : 540} compact={compact} />
          <OgStats first={data.overall} top={compact ? 477 : 590} height={compact ? 90 : 150} compact={compact} />
        </div>
      )}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 64,
          right: 64,
          bottom: compact ? 13 : 30,
          justifyContent: "space-between",
          color: "#857594",
          fontSize: 12,
        }}
      >
        <span>Captured activity · UTC</span>
        <span>
          <NumberText preserveSpaces>{`created with viniapp · ${generatedAt} UTC`}</NumberText>
        </span>
      </div>
    </div>
  );
}
