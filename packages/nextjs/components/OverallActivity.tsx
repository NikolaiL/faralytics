import {
  activityDate,
  accountName,
  firstActivityLabel,
  streakRange,
  PURPLES,
  BLUES,
  type Activity,
} from "~~/lib/activity";
import { NumberText } from "./NumberText";
export function OverallActivity({ first, second }: { first: Activity; second?: Activity }) {
  if (!first.overall) return null;
  const accounts = [first, ...(second?.overall ? [second] : [])];
  return (
    <section className="overall-activity" data-testid="overall-activity">
      <div className="overall-intro">
        <h3>Overall activity</h3>
        {accounts.map((data, index) => (
          <p key={data.profile.fid} style={second ? { color: index ? BLUES[4] : PURPLES[4] } : undefined}>
            {second && `${accountName(data)} · `}
            <NumberText>{firstActivityLabel(data.overall!)}</NumberText>
          </p>
        ))}
      </div>
      <div className="stats overall-stats">
        {(["activeDays", "longestStreak", "peak"] as const).map((key) => (
          <div key={key} data-testid={`overall-${key}`}>
            {accounts.map((data, index) => {
              const summary = data.overall!;
              const other = accounts[1 - index]?.overall;
              return (
                <div
                  className="overall-stat-value"
                  key={data.profile.fid}
                  style={second ? { color: index ? BLUES[4] : PURPLES[4] } : undefined}
                >
                  <strong>
                    {summary[key].toLocaleString("en-US")}
                    <small>{key === "peak" ? "actions" : "days"}</small>
                    {other && summary[key] > other[key] && (
                      <span aria-label="Higher value" style={{ color: "inherit" }}>
                        {" "}
                        ✓
                      </span>
                    )}
                  </strong>
                  {key !== "activeDays" && (
                    <small className="overall-stat-date">
                      <NumberText>{key === "peak" ? activityDate(summary.peakDate) : streakRange(summary)}</NumberText>
                    </small>
                  )}
                </div>
              );
            })}
            <span>
              {key === "activeDays"
                ? "Active days"
                : key === "longestStreak"
                  ? "Longest streak"
                  : "actions on busiest day"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
