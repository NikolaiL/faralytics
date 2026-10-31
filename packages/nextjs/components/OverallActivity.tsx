import { activityStatItems, accountName, firstActivityLabel, PURPLES, BLUES, type Activity } from "~~/lib/activity";
import { NumberText } from "./NumberText";
export function OverallActivity({ first, second }: { first: Activity; second?: Activity }) {
  if (!first.overall) return null;
  const accounts = [first, ...(second?.overall ? [second] : [])];
  const items = accounts.map((data) => activityStatItems(data.overall!));
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
        {items[0].map((stat) => (
          <div key={stat.key} data-testid={`overall-${stat.key}`}>
            {accounts.map((data, index) => {
              const value = items[index].find((item) => item.key === stat.key)!;
              const other = items[1 - index]?.find((item) => item.key === stat.key);
              return (
                <div
                  className="overall-stat-value"
                  key={data.profile.fid}
                  style={second ? { color: index ? BLUES[4] : PURPLES[4] } : undefined}
                >
                  <strong>
                    {value.value.toLocaleString("en-US")}
                    <small>{value.unit}</small>
                    {other && value.value > other.value && (
                      <span aria-label="Higher value" style={{ color: "inherit" }}>
                        {" "}
                        ✓
                      </span>
                    )}
                  </strong>
                  <small className={stat.key === "activeDays" ? "active-percentage" : "overall-stat-date"}>
                    <NumberText>{value.detail}</NumberText>
                  </small>
                </div>
              );
            })}
            <span>{stat.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
