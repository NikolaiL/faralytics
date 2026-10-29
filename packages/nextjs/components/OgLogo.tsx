import { PURPLES } from "~~/lib/activity";
import { LOGO_PIXELS } from "~~/lib/brand";

export function OgLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 27, fontWeight: 700, color: "#d6ff3f" }}>
      <svg width={30} height={30} viewBox="0 0 294 294">
        {LOGO_PIXELS.map(([x, y, level], i) => (
          <rect key={i} x={x * 60} y={y * 60} width={54} height={54} rx={9} fill={PURPLES[level]} />
        ))}
      </svg>
      <div style={{ display: "flex" }}>faralytics.</div>
    </div>
  );
}
