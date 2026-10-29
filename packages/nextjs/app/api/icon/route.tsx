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
      <svg width={Math.round(size * 0.586)} height={Math.round(size * 0.586)} viewBox="0 0 300 300">
        {Array.from({ length: 9 }, (_, i) => (
          <rect
            key={i}
            x={(i % 3) * 106}
            y={Math.floor(i / 3) * 106}
            width="84"
            height="84"
            rx="15"
            fill={i === 2 ? "#211b2e" : i === 6 ? "#b596f2" : "#855dcd"}
          />
        ))}
      </svg>
    </div>,
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
});
