import { base } from "viem/chains";
const scaffoldConfig = {
  targetNetworks: [base],
  pollingInterval:
    Number(process.env.NEXT_PUBLIC_SCAFFOLD_POLLING_INTERVAL) ||
    (process.env.NODE_ENV === "production" ? 300_000 : 30_000),
};
export default scaffoldConfig;
