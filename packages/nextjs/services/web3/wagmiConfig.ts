import { createConfig, http } from "wagmi";
import { coinbaseWallet, injected } from "wagmi/connectors";
import farcasterMiniApp from "@farcaster/miniapp-wagmi-connector";
import { base } from "viem/chains";
import scaffoldConfig from "~~/scaffold.config";
export const config = createConfig({
  chains: [base],
  connectors: [
    farcasterMiniApp(),
    injected(),
    coinbaseWallet({
      version: "4",
      appName: "Faralytics",
      appLogoUrl: "https://faralytics.vercel.app/api/icon?size=200&v=grid5-v2",
      preference: "all",
    }),
  ],
  transports: { [base.id]: http("https://base-rpc.publicnode.com") },
  pollingInterval: scaffoldConfig.pollingInterval,
  ssr: true,
});
