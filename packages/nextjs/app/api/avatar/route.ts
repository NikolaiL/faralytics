import { trustedAvatarUrl } from "~~/lib/avatar-url";
import { loadAvatar } from "~~/lib/avatar";
import { withErrorReporting } from "~~/utils/reportServerError";
export const runtime = "nodejs";
export const GET = withErrorReporting("/api/avatar", async (request) => {
  const source = request.nextUrl.searchParams.get("url");
  if (!trustedAvatarUrl(source)) return new Response(null, { status: 400 });
  const image = await loadAvatar(source);
  if (!image) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(new Uint8Array(image), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
