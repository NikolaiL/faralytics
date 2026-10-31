import { readFileSync } from "node:fs";
import { join } from "node:path";
export const OG_FONTS = [
  {
    name: "FaralyticsSans",
    data: readFileSync(join(process.cwd(), "assets/fonts/FaralyticsOG-Regular.ttf")),
    weight: 400 as const,
    style: "normal" as const,
  },
  {
    name: "FaralyticsSans",
    data: readFileSync(join(process.cwd(), "assets/fonts/FaralyticsOG-Bold.ttf")),
    weight: 700 as const,
    style: "normal" as const,
  },
  {
    name: "FaralyticsSans",
    data: readFileSync(join(process.cwd(), "assets/fonts/FaralyticsOG-Black.ttf")),
    weight: 900 as const,
    style: "normal" as const,
  },
];
