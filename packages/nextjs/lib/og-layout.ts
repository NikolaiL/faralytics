// Fit square cells between the OG card's 64px card margins plus a 5px chart inset, without a trailing gap.
export function ogChartLayout(columns: number) {
  const width = 1200 - 2 * 69;
  const gap = 2;
  const step = (width + gap) / columns;
  return { left: 69, width, height: 7 * step - gap, step, cellSize: step - gap };
}
