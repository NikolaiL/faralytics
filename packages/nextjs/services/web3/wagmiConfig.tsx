import { wagmiConnectors } from "./wagmiConnectors";
import { Chain, createClient, fallback, http } from "viem";
import { hardhat, mainnet } from "viem/chains";
import { createConfig } from "wagmi";
import scaffoldConfig, { DEFAULT_ALCHEMY_API_KEY, ScaffoldConfig } from "~~/scaffold.config";
import { getAlchemyHttpUrl } from "~~/utils/scaffold-eth";

import { farcasterMiniApp as miniAppConnector } from "@farcaster/miniapp-wagmi-connector";
import { MiniKit } from "@worldcoin/minikit-js";
import { worldApp } from "@worldcoin/minikit-js/wagmi";
import { injected } from "wagmi/connectors";

// The Base App / Coinbase in-app browser is a standard web app + wallet with NO
// Farcaster SDK. The Farcaster mini-app connector's reconnect calls that SDK and
// hangs, which stalls wagmi's reconnectOnMount at status="connecting" forever and
// blocks coinbaseWallet from reconnecting. So exclude the Farcaster connector when
// running in the Coinbase runtime. Detected at module load, SSR-safe.
const isCoinbaseRuntime =
  typeof window !== "undefined" &&
  (!!(window as any).ethereum?.isCoinbaseBrowser ||
    !!(window as any).ethereum?.isCoinbaseWallet ||
    (Array.isArray((window as any).ethereum?.providers) &&
      (window as any).ethereum.providers.some((p: any) => p?.isCoinbaseBrowser || p?.isCoinbaseWallet)) ||
    /CoinbaseBrowser|CoinbaseWallet|CoinbaseApp/i.test(typeof navigator !== "undefined" ? navigator.userAgent : ""));

// World App: install MiniKit and register the worldApp() connector ONLY inside
// World App. Gate on window.WorldApp — the host signal present BEFORE install —
// NOT window.MiniKit, which MiniKit.install() itself sets and would mis-flag other
// hosts (e.g. the Base App) as worldapp. Registering worldApp() outside World App
// would also hang wagmi's reconnectOnMount there.
const isWorldAppRuntime =
  typeof window !== "undefined" && !!(window as { WorldApp?: unknown }).WorldApp;

if (isWorldAppRuntime) {
  try {
    MiniKit.install(process.env.NEXT_PUBLIC_WORLD_APP_ID);
  } catch {
    // ignore
  }
}


const { targetNetworks } = scaffoldConfig;

// We always want to have mainnet enabled (ENS resolution, ETH price, etc). But only once.
export const enabledChains = targetNetworks.find((network: Chain) => network.id === 1)
  ? targetNetworks
  : ([...targetNetworks, mainnet] as const);

export const wagmiConfig = createConfig({
  chains: enabledChains,
  connectors: [...(isWorldAppRuntime ? [worldApp()] : []), ...(isCoinbaseRuntime ? [] : [miniAppConnector()]), injected({ shimDisconnect: true }), ...wagmiConnectors()],
  ssr: true,
  client: ({ chain }) => { const publicRpcUrlsByChain: Record<number, string[]> = { 1: ["https://ethereum-rpc.publicnode.com"], 8453: ["https://base-rpc.publicnode.com", "https://mainnet.base.org"], 42220: ["https://celo-rpc.publicnode.com"], 480: ["https://worldchain-mainnet.g.alchemy.com/public"] }; const publicFallbacks = (publicRpcUrlsByChain[chain.id] ?? []).map(url => http(url)); if (publicFallbacks.length === 0) { publicFallbacks.push(http()); } let rpcFallbacks = publicFallbacks; const rpcOverrideUrl = (scaffoldConfig.rpcOverrides as ScaffoldConfig["rpcOverrides"])?.[chain.id]; if (rpcOverrideUrl) { rpcFallbacks = [http(rpcOverrideUrl), ...publicFallbacks]; } else { const alchemyHttpUrl = getAlchemyHttpUrl(chain.id); if (alchemyHttpUrl) { rpcFallbacks = [...publicFallbacks, http(alchemyHttpUrl)]; } } return createClient({ chain, transport: fallback(rpcFallbacks), ...(chain.id !== (hardhat as Chain).id ? { pollingInterval: scaffoldConfig.pollingInterval } : {}), }); }
});
