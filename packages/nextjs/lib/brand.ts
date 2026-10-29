const letters: Record<string, string[]> = {
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
};

export const BRAND_GRID = Array.from({ length: 7 }, (_, row) =>
  [..."FARALYTICS"].map((letter) => letters[letter][row]).join("0"),
);

// A full 5×5 activity grid, with brighter cells forming a northeast arrow.
export const LOGO_GRID = ["00111", "00011", "00101", "01000", "10000"] as const;
export const LOGO_PIXELS = LOGO_GRID.flatMap((row, y) =>
  [...row].map((pixel, x) => [x, y, pixel === "1" ? ((x + y) % 3 === 0 ? 4 : 3) : (x + y) % 2] as const),
);

export function brandCellLevel(pixel: string, x: number, y: number) {
  const variation = x * 17 + y * 29 + x * y * 7;
  return pixel === "1" ? (variation % 5 === 0 ? 3 : 4) : variation % 3;
}
