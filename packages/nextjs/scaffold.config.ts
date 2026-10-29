import * as chains from "viem/chains";


const worldChain = {
  id: 480,
  name: "World Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://worldchain-mainnet.g.alchemy.com/public"] } },
  blockExplorers: { default: { name: "Worldscan", url: "https://worldscan.org" } },
} as const satisfies chains.Chain;

const DEFAULT_POLLING_INTERVAL = 30_000;
const PRODUCTION_POLLING_INTERVAL = 300_000;
const configuredPollingInterval = Number(process.env.NEXT_PUBLIC_SCAFFOLD_POLLING_INTERVAL);
const scaffoldPollingInterval =
  Number.isFinite(configuredPollingInterval) && configuredPollingInterval > 0
    ? configuredPollingInterval
    : process.env.NODE_ENV === "production"
      ? PRODUCTION_POLLING_INTERVAL
      : DEFAULT_POLLING_INTERVAL;


export type BaseConfig = {
  targetNetworks: readonly chains.Chain[];
  pollingInterval: number;
  alchemyApiKey: string;
  rpcOverrides?: Record<number, string>;
  walletConnectProjectId: string;
  burnerWalletMode: "localNetworksOnly" | "allNetworks" | "disabled";
};

export type ScaffoldConfig = BaseConfig ;

export const DEFAULT_ALCHEMY_API_KEY = "YOUR_ALCHEMY_API_KEY";

const scaffoldConfig = {
  // The networks on which your DApp is live
  targetNetworks: [
    chains.base,
    chains.celo,
    worldChain
  ],
  // The interval at which your front-end polls the RPC servers for new data (it has no effect if you only target the local network (default is 4000))
  pollingInterval: scaffoldPollingInterval,
  // This is ours Alchemy's default API key.
  // You can get your own at https://dashboard.alchemyapi.io
  // It's recommended to store it in an env variable:
  // .env.local for local testing, and in the Vercel/system env config for live apps.
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '',
  // If you want to use a different RPC for a specific network, you can add it here.
  // The key is the chain ID, and the value is the HTTP RPC URL
  rpcOverrides: {
    // Example:
    // [chains.mainnet.id]: "https://mainnet.rpc.buidlguidl.com",
  },
  // This is ours WalletConnect's default project ID.
  // You can get your own at https://cloud.walletconnect.com
  // It's recommended to store it in an env variable:
  // .env.local for local testing, and in the Vercel/system env config for live apps.
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || '3a8170812b534d0ff9d794f19a901d64',
  // Configure Burner Wallet visibility:
  // - "localNetworksOnly": only show when all target networks are local (hardhat/anvil)
  // - "allNetworks": show on any configured target networks
  // - "disabled": completely disable
  burnerWalletMode: 'localNetworksOnly'
} as const satisfies ScaffoldConfig;

export default scaffoldConfig;