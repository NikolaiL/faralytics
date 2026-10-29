import { withErrorReporting } from "~~/utils/reportServerError";
export const GET = withErrorReporting("/api/eth-price", async () => {
  const response = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot", {
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) return Response.json({ usd: null });
  const result = await response.json();
  const usd = Number(result?.data?.amount);
  return Response.json(
    { usd: Number.isFinite(usd) && usd > 0 ? usd : null },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
});
