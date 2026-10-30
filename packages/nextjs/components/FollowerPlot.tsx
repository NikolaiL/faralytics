"use client";
import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  compactNumber,
  FOLLOWER_COLORS,
  followerDate,
  followerDomain,
  followerName,
  followerTimeTicks,
  followerTick,
  nearestFollowerPoint,
  type FollowerChartData,
} from "~~/lib/followers";

export default function FollowerPlot({ data, hidden }: { data: FollowerChartData; hidden: string[] }) {
  const domain = followerDomain(data);
  const rows = useMemo(() => {
    const times = new Map<number, Record<string, number>>();
    data.series.forEach((series) =>
      series.points.forEach((point) => {
        const row = times.get(point.ts) || { ts: point.ts };
        row[series.profile.fid] = point.value;
        times.set(point.ts, row);
      }),
    );
    return [...times.values()].sort((a, b) => a.ts - b.ts);
  }, [data]);
  if (!data.from)
    return (
      <div className="followers-no-history" data-testid="followers-no-history">
        No captured follow history for these accounts yet.
      </div>
    );
  return (
    <div
      className="follower-plot"
      data-testid="follower-plot"
      aria-label="Captured net follower actions over time. Use arrow keys to explore sampled points."
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={rows} margin={{ top: 18, right: 18, bottom: 8, left: 0 }} accessibilityLayer>
          <CartesianGrid stroke="#30263d" vertical={false} />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={[domain.start, domain.end]}
            ticks={followerTimeTicks(domain.start, domain.end, 4)}
            tickFormatter={(ts) => followerTick(Number(ts), domain.start, domain.end)}
            stroke="#857594"
            tick={{ fill: "#a99aba", fontSize: 11 }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            type="number"
            domain={[domain.min, domain.max]}
            ticks={domain.yTicks}
            tickFormatter={compactNumber}
            width={56}
            stroke="#857594"
            tick={{ fill: "#a99aba", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            isAnimationActive={false}
            content={({ active, label }) =>
              active && typeof label === "number" ? (
                <div className="follower-tooltip">
                  <strong>{followerDate(label)}</strong>
                  <span>Nearest sampled points</span>
                  {data.series.map((series, index) => {
                    if (hidden.includes(series.profile.fid)) return null;
                    const point = nearestFollowerPoint(series.points, label);
                    return (
                      <div key={series.profile.fid} style={{ color: FOLLOWER_COLORS[index] }}>
                        <b>{followerName(series)}</b>
                        <span>{point ? point.value.toLocaleString("en-US") : "No history"}</span>
                      </div>
                    );
                  })}
                </div>
              ) : null
            }
          />
          {data.series.map((series, index) => (
            <Line
              key={series.profile.fid}
              dataKey={series.profile.fid}
              name={followerName(series)}
              type="linear"
              stroke={FOLLOWER_COLORS[index]}
              strokeWidth={3.5}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
              hide={hidden.includes(series.profile.fid)}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
