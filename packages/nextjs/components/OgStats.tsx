import {
  activityDate,
  firstActivityLabel,
  accountName,
  streakRange,
  PURPLES,
  BLUES,
  type ActivitySummary,
  type Activity,
} from "~~/lib/activity";
import { NumberText } from "./NumberText";
export function OgStats({
  first,
  second,
  top,
  height,
  compact = false,
}: {
  first: ActivitySummary;
  second?: ActivitySummary;
  top: number;
  height: number;
  compact?: boolean;
}) {
  const summaries = [first, ...(second ? [second] : [])];
  return (
    <div style={{ display: "flex", position: "absolute", top, left: 64, right: 64, height, gap: 16 }}>
      {(["activeDays", "longestStreak", "peak"] as const).map((key) => (
        <div
          key={key}
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            gap: compact ? 2 : 6,
            border: "1px solid #352a43",
            background: "#18131f",
            borderRadius: 10,
            padding: second && compact ? "2px 8px" : "4px 8px",
          }}
        >
          <div
            style={{
              display: "flex",
              width: "100%",
              justifyContent: "space-around",
              flexDirection: second ? "row" : "column",
              alignItems: "center",
              gap: compact ? 2 : 5,
            }}
          >
            {summaries.map((summary, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: compact ? 2 : 5,
                  color: second ? (index ? BLUES[4] : PURPLES[4]) : "#f3eff9",
                }}
              >
                <div style={{ display: "flex", fontSize: compact ? (second ? 15 : 22) : 29, lineHeight: 1.1 }}>
                  <NumberText
                    preserveSpaces
                  >{`${summary[key].toLocaleString("en-US")}${second ? "" : key === "peak" ? " actions" : " days"}`}</NumberText>
                  {second && summary[key] > (index ? first[key] : second[key]) && (
                    <svg
                      width={compact ? 10 : 16}
                      height={compact ? 10 : 16}
                      viewBox="0 0 24 24"
                      style={{ marginLeft: 4 }}
                    >
                      <path
                        d="m5 12 4 4L19 6"
                        fill="none"
                        stroke={index ? BLUES[4] : PURPLES[4]}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                {key !== "activeDays" && (
                  <div
                    style={{
                      display: "flex",
                      fontSize: compact ? (second ? 8 : 10) : second ? 10 : 13,
                      lineHeight: 1.2,
                    }}
                  >
                    <NumberText preserveSpaces>
                      {key === "peak" ? activityDate(summary.peakDate) : streakRange(summary)}
                    </NumberText>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div
            style={{ display: "flex", color: "#a99aba", fontSize: compact ? (second ? 9 : 10) : 13, lineHeight: 1.2 }}
          >
            {key === "activeDays"
              ? "Active days"
              : key === "longestStreak"
                ? "Longest streak"
                : "actions on busiest day"}
            {second && first[key] === second[key] ? " · Tie" : ""}
          </div>
        </div>
      ))}
    </div>
  );
}
export function OverallOgHeading({
  first,
  second,
  top,
  compact,
}: {
  first: Activity;
  second?: Activity;
  top: number;
  compact: boolean;
}) {
  const details = [first, ...(second ? [second] : [])]
    .filter((data) => data.overall)
    .map((data) => `${second ? accountName(data) + " · " : ""}${firstActivityLabel(data.overall!)}`);
  const titleSize = compact ? (second ? 12 : 14) : 19;
  const detailSize = Math.min(
    compact ? (second ? 8 : 12) : second ? 10 : 13,
    (1072 - titleSize * 8 - 36) / (details.join(" · ").length * 0.57),
  );
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        top,
        left: 64,
        right: 64,
        alignItems: "baseline",
        gap: 12,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      <div style={{ display: "flex", fontSize: titleSize, fontWeight: 700, flexShrink: 0 }}>Overall activity</div>
      {details.map((text, index) => (
        <div
          key={index}
          style={{
            display: "flex",
            fontSize: detailSize,
            color: second ? (index ? BLUES[4] : PURPLES[4]) : "#a99aba",
            whiteSpace: "nowrap",
          }}
        >
          <NumberText preserveSpaces>{text}</NumberText>
        </div>
      ))}
    </div>
  );
}
