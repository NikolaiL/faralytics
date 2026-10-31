import {
  firstActivityLabel,
  accountName,
  PURPLES,
  BLUES,
  activityStatItems,
  type OverallActivity,
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
  first: ActivitySummary & { currentStreak?: OverallActivity["currentStreak"] };
  second?: ActivitySummary & { currentStreak?: OverallActivity["currentStreak"] };
  top: number;
  height: number;
  compact?: boolean;
}) {
  const items = [first, ...(second ? [second] : [])].map(activityStatItems);
  const stacked = !!second && items[0].length === 4;
  const boxWidth = (1072 - (items[0].length - 1) * 16) / items[0].length;
  const detailWidth = second ? (boxWidth - 16) / 2 - 6 : boxWidth - 16;
  return (
    <div style={{ display: "flex", position: "absolute", top, left: 64, right: 64, height, gap: 16 }}>
      {items[0].map((stat) => (
        <div
          key={stat.key}
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            gap: stacked ? (compact ? 1 : 3) : compact ? 2 : 6,
            border: "1px solid #352a43",
            background: "#18131f",
            borderRadius: 10,
            padding: stacked ? (compact ? "1px 8px" : "2px 8px") : second && compact ? "2px 8px" : "4px 8px",
          }}
        >
          <div
            style={{
              display: "flex",
              width: "100%",
              justifyContent: "space-around",
              flexDirection: second && !stacked ? "row" : "column",
              alignItems: "center",
              gap: stacked ? (compact ? 1 : 3) : compact ? 2 : 5,
            }}
          >
            {items.map((values, index) => {
              const value = values.find((item) => item.key === stat.key)!;
              const other = items[1 - index]?.find((item) => item.key === stat.key);
              const valueText = `${value.value.toLocaleString("en-US")}${second ? "" : " " + value.unit}`;
              const markerWidth = other && value.value > other.value ? (compact ? 14 : 20) : 0;
              const valueSize = Math.min(
                stacked ? (compact ? 13 : 20) : compact ? (second ? 15 : 22) : 29,
                ((stacked ? (boxWidth - 16) * 0.4 : detailWidth) - markerWidth) / Math.max(1, valueText.length * 0.68),
              );
              const availableDetailWidth = stacked
                ? boxWidth - 20 - markerWidth - valueSize * valueText.length * 0.68
                : detailWidth;
              return (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    flexDirection: stacked ? "row" : "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: stacked ? 4 : compact ? 2 : 5,
                    color: second ? (index ? BLUES[4] : PURPLES[4]) : "#f3eff9",
                  }}
                >
                  <div style={{ display: "flex", fontSize: valueSize, lineHeight: 1.1 }}>
                    <NumberText preserveSpaces>{valueText}</NumberText>
                    {other && value.value > other.value && (
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
                  <div
                    style={{
                      display: "flex",
                      fontSize: Math.min(
                        compact ? (second ? 8 : 10) : second ? 10 : 13,
                        availableDetailWidth / Math.max(1, value.detail.length * 0.58),
                      ),
                      lineHeight: 1.2,
                    }}
                  >
                    <NumberText preserveSpaces>{value.detail}</NumberText>
                  </div>
                </div>
              );
            })}
          </div>
          <div
            style={{ display: "flex", color: "#a99aba", fontSize: compact ? (second ? 9 : 10) : 13, lineHeight: 1.2 }}
          >
            {stat.label}
            {items[1]?.find((item) => item.key === stat.key)?.value === stat.value ? " · Tie" : ""}
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
