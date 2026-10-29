import { erc20Abi } from "viem";
export const TREASURY = "0x8D6230427a37986D25Fe4D5B3d0aaEF1b924fEd6" as const;
const externalContracts = {
  8453: { USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", abi: erc20Abi, deployedOnBlock: 0 } },
} as const;
export default externalContracts;
