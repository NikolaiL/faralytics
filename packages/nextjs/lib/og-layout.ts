// Fit square cells between the OG card's 64px side margins, without a trailing gap.
export function ogChartLayout(columns: number) {
  const width = 1200 - 2 * 64;
  const gap = 2;
  const step = (width + gap) / columns;
  return { left: 64, width, height: 7 * step - gap, step, cellSize: step - gap };
}
