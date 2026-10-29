import { colorLevel, grid, PURPLES, utcDate } from "~~/lib/activity";
import type { Day } from "~~/lib/activity";

export function Heatmap({ days, peak, onSelect }: { days: Day[]; peak: number; onSelect?: (day: Day) => void }) {
  const { cells, columns } = grid(days);
  const size = 15,
    gap = 2,
    step = size + gap;
  const width = 32 + columns * step;
  return (
    <svg
      className="heatmap"
      viewBox={`0 0 ${width} 158`}
      role="group"
      aria-label="Daily Farcaster activity, Sunday through Saturday. Select a square for details."
    >
      {["Mon", "Wed", "Fri"].map((label, index) => (
        <text key={label} x="0" y={46 + index * 34} fill="#938aab" fontSize="10">
          {label}
        </text>
      ))}
      {cells
        .filter(
          (day, index) => utcDate(day.date).getUTCDate() === 1 || (index === 0 && utcDate(day.date).getUTCDate() <= 21),
        )
        .map((day) => (
          <text key={day.date} x={32 + day.column * step} y="13" fill="#a69bb9" fontSize="11">
            {utcDate(day.date).toLocaleDateString("en", { month: "short", timeZone: "UTC" })}
          </text>
        ))}
      {cells.map((day) => (
        <rect
          key={day.date}
          x={32 + day.column * step}
          y={26 + day.row * step}
          width={size}
          height={size}
          rx="3"
          fill={day.future ? "#14111c" : PURPLES[colorLevel(day.actions, peak)]}
          opacity={day.future ? 0.5 : 1}
          role={onSelect && !day.future ? "button" : undefined}
          tabIndex={onSelect && !day.future ? 0 : undefined}
          aria-label={`${day.date}: ${day.future ? "future date" : `${day.actions} captured actions`}`}
          onMouseEnter={() => !day.future && onSelect?.(day)}
          onFocus={() => !day.future && onSelect?.(day)}
          onClick={() => !day.future && onSelect?.(day)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              if (!day.future) onSelect?.(day);
            }
          }}
        >
          <title>{`${day.date}: ${day.future ? "Future date" : `${day.actions.toLocaleString("en-US")} captured actions`}`}</title>
        </rect>
      ))}
    </svg>
  );
}
