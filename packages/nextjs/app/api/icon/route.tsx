import { LOGO_PIXELS } from "~~/lib/brand";
import { ImageResponse } from "next/og";
import { withErrorReporting } from "~~/utils/reportServerError";
export const runtime = "nodejs";
export const GET = withErrorReporting("/api/icon", (request) => {
  const size = request.nextUrl.searchParams.get("size") === "200" ? 200 : 1024;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#0d0b12",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={Math.round(size * 0.586)} height={Math.round(size * 0.586)} viewBox="0 0 288 288">
        {LOGO_PIXELS.map(([x, y], i) => (
          <rect key={i} x={x * 60} y={y * 60} width="48" height="48" rx="9" fill={i === 6 ? "#b596f2" : "#855dcd"} />
        ))}
      </svg>
    </div>,
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
});
