import { NumberText } from "./NumberText";
import { useState } from "react";
import {
  accountName,
  activityDate,
  BLUES,
  comparisonPeak,
  comparisonStats,
  periodLabel,
  PURPLES,
  type Activity,
  type Day,
} from "~~/lib/activity";
import { AvatarImage } from "./AvatarImage";
import { Heatmap } from "./Heatmap";

export function ComparisonChart({
  first,
  second,
  onActivate,
}: {
  first: Activity;
  second: Activity;
  onActivate: () => void;
}) {
  const [selected, setSelected] = useState<{ day: Day; name: string }>();
  const peak = comparisonPeak(first, second);
  return (
    <div className="comparison-chart" data-testid="comparison-chart">
      <div className="comparison-identities">
        {[first, second].map((data, index) => (
          <div className={`comparison-identity account-${index + 1}`} key={index}>
            <div className="avatar" aria-hidden="true">
              {(data.profile.username || "fc").slice(0, 2)}
              <AvatarImage source={data.profile.pfp_url} size={44} />
            </div>
            <span data-testid={`compare-name-${index + 1}`}>{accountName(data)}</span>
          </div>
        ))}
        <span className="comparison-vs">VS</span>
      </div>
      <div className="comparison-totals">
        <strong className="account-1" data-testid="activity-total">
          {first.total.toLocaleString("en-US")}
        </strong>
        <span>
          Actions in <NumberText>{periodLabel(first.period)}</NumberText>
        </span>
        <strong className="account-2" data-testid="comparison-total">
          {second.total.toLocaleString("en-US")}
        </strong>
      </div>
      <div className="chart-scroll comparison-scroll" data-testid="activity-graph">
        <div className="comparison-grids">
          {[first, second].map((data, index) => (
            <div
              key={index}
              className={`comparison-grid account-${index + 1}`}
              data-testid={`comparison-grid-${index + 1}`}
            >
              <div className="comparison-grid-label">{accountName(data)}</div>
              <Heatmap
                days={data.days}
                peak={peak}
                palette={index ? BLUES : PURPLES}
                label={accountName(data)}
                onSelect={(day) => setSelected({ day, name: accountName(data) })}
                onActivate={onActivate}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="chart-caption comparison-caption">
        <span role="status" className="day-detail">
          {selected ? (
            <>
              {selected.name} ·{" "}
              <NumberText>{`${selected.day.actions.toLocaleString("en-US")} actions · ${activityDate(selected.day.date)}`}</NumberText>
            </>
          ) : (
            "Same dates. Same intensity scale. UTC."
          )}
        </span>
        <div className="comparison-legends">
          {[PURPLES, BLUES].map((palette, index) => (
            <div
              className="legend"
              key={index}
              aria-label={`${accountName(index ? second : first)} intensity from less to more`}
            >
              <span>Less</span>
              {palette.map((color) => (
                <i key={color} style={{ background: color }} />
              ))}
              <span>More</span>
            </div>
          ))}
        </div>
      </div>
      <div className="stats comparison-stats">
        {comparisonStats(first, second).map((stat) => (
          <div
            key={stat.key}
            className={stat.key === "peak" ? "comparison-peak-stat" : undefined}
            data-testid={`comparison-stat-${stat.key}`}
          >
            {[first, second].map((data, index) => {
              const winner = stat.winner === (index ? "second" : "first");
              return (
                <div key={index} className={`comparison-stat-value account-${index + 1}`}>
                  <strong
                    aria-label={`${accountName(data)}: ${index ? stat.second : stat.first} ${stat.unit}${winner ? ", higher value" : ""}`}
                  >
                    {(index ? stat.second : stat.first).toLocaleString("en-US")}
                    {stat.key !== "peak" && <small>{stat.unit}</small>}
                    {winner && (
                      <span className="winner" aria-label="Higher value">
                        ✓
                      </span>
                    )}
                  </strong>
                  {stat.key === "peak" && (
                    <time dateTime={(index ? stat.secondDate : stat.firstDate) || undefined}>
                      <NumberText>{activityDate((index ? stat.secondDate : stat.firstDate) || null)}</NumberText>
                    </time>
                  )}
                </div>
              );
            })}
            <span className="comparison-stat-label">{stat.key === "peak" ? "actions on busiest day" : stat.label}</span>
            {stat.winner === "tie" && <span className="comparison-tie">Tie</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
