import { withErrorReporting } from "~~/utils/reportServerError";
export const GET = withErrorReporting("/.well-known/farcaster.json", () => {
  const origin = process.env.NEXT_PUBLIC_URL || "http://localhost:3100";
  const association = process.env.FARCASTER_ACCOUNT_ASSOCIATION;
  return Response.json({
    ...(association ? { accountAssociation: JSON.parse(association) } : {}),
    miniapp: {
      version: "1",
      name: "Faralytics",
      homeUrl: origin,
      webhookUrl: "https://api.neynar.com/f/app/a7310ba9-e0d6-4353-9c29-cae3fa5fa523/event",
      iconUrl: `${origin}/api/icon?size=1024&v=grid5-v2`,
      splashImageUrl: `${origin}/api/icon?size=200&v=grid5-v2`,
      splashBackgroundColor: "#0d0b12",
      subtitle: "Your year in purple",
      description: "Explore and share your captured Farcaster activity, one purple square at a time.",
      primaryCategory: "social",
      tags: ["farcaster", "activity", "analytics"],
      ogTitle: "Faralytics",
      ogDescription: "Your year, one purple square at a time.",
      ogImageUrl: `${origin}/og/faralytics-farcaster-v12.png`,
    },
  });
});
