import type { CSSProperties } from "react";
import { PURPLES } from "~~/lib/activity";
import { BRAND_GRID, brandCellLevel } from "~~/lib/brand";

export function BrandChart() {
  const step = 17;
  return (
    <section className="chart-card brand-chart" data-testid="lookup-empty">
      <svg
        viewBox={`0 0 ${BRAND_GRID[0].length * step} ${7 * step}`}
        role="img"
        aria-labelledby="brand-chart-title"
        data-testid="brand-chart"
      >
        <title id="brand-chart-title">Faralytics spelled in purple activity squares. Decorative illustration.</title>
        {BRAND_GRID.flatMap((row, y) =>
          [...row].map((pixel, x) => {
            const level = brandCellLevel(pixel, x, y);
            return (
              <rect
                key={`${x}:${y}`}
                x={x * step}
                y={y * step}
                width={13}
                height={13}
                rx={3}
                fill={PURPLES[level]}
                style={
                  {
                    "--cell-color": PURPLES[level],
                    "--cell-glow":
                      pixel === "1" ? (level === 3 ? "#aa86e3" : "#cbb1fa") : PURPLES[Math.min(2, level + 1)],
                    animationDelay: `${-((x * 13 + y * 7) % 140) / 10}s`,
                    animationDuration: `${10 + ((x + y * 3) % 5)}s`,
                  } as CSSProperties
                }
              />
            );
          }),
        )}
      </svg>
      <p>Look up a username or FID to see their year in squares.</p>
    </section>
  );
}
