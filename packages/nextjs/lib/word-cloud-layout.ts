export const cloudWidth = 1080;
export const cloudHeight = 478;
const gap = 10;
const step = 8;

export type WordBox = { left: number; top: number; width: number; height: number };
export type WordPlacement = WordBox & { angle: 0 | 90 };
type WordSize = { width: number; height: number; fontSize: number };

const positions = Array.from({ length: Math.floor(cloudHeight / step) + 1 }, (_, row) =>
  Array.from({ length: Math.floor(cloudWidth / step) + 1 }, (_, column) => ({
    x: (column - Math.floor(cloudWidth / step / 2)) * step,
    y: (row - Math.floor(cloudHeight / step / 2)) * step,
  })),
)
  .flat()
  .sort((a, b) => (a.x / 2) ** 2 + a.y ** 2 - (b.x / 2) ** 2 - b.y ** 2);

export function placeWord(
  width: number,
  height: number,
  taken: WordBox[],
  vertical: boolean,
  canvasHeight = cloudHeight,
): WordPlacement | undefined {
  for (const angle of vertical ? ([90, 0] as const) : ([0, 90] as const)) {
    const [w, h] = angle ? [height, width] : [width, height];
    if (w > cloudWidth - gap * 2 || h > canvasHeight - gap * 2) continue;
    for (const { x, y } of positions) {
      const left = Math.floor((cloudWidth - w) / 2) + x;
      const top = Math.floor((canvasHeight - h) / 2) + y;
      if (left < gap || top < gap || left + w + gap > cloudWidth || top + h + gap > canvasHeight) continue;
      const occupied = taken.some(
        (box) =>
          left < box.left + box.width + gap &&
          left + w + gap > box.left &&
          top < box.top + box.height + gap &&
          top + h + gap > box.top,
      );
      if (!occupied) return { left, top, width: w, height: h, angle };
    }
  }
}

export function packWords(words: WordSize[], canvasHeight: number) {
  let best: (WordPlacement & { index: number })[] = [];
  const target = Math.ceil(words.length * 0.95);
  for (const scale of [1, 0.9, 0.82, 0.74]) {
    const placed: typeof best = [];
    words.forEach(({ width, height, fontSize }, index) => {
      const factor = Math.max(scale, Math.min(1, 18 / fontSize));
      const box = placeWord(
        Math.max(1, Math.round(width * factor)),
        Math.max(1, Math.round(height * factor)),
        placed,
        index % 5 === 4,
        canvasHeight,
      );
      if (box) placed.push({ ...box, index });
    });
    if (placed.length >= target) return placed;
    if (placed.length > best.length) best = placed;
  }
  return best;
}
