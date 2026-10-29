"use client";
import { useWalletClient, usePublicClient } from "wagmi";
import type { Abi, Address } from "viem";
import { waitForConfirmation } from "~~/lib/transactions";
import deployedContracts from "~~/contracts/deployedContracts";
import externalContracts from "~~/contracts/externalContracts";
const contracts = { ...externalContracts[8453], ...deployedContracts[8453] };
export function useScaffoldWriteContract(contractName: keyof typeof contracts) {
  const { data: wallet } = useWalletClient();
  const publicClient = usePublicClient();
  async function writeContractAsync(options: {
    functionName: string;
    args: readonly unknown[];
    value?: bigint;
    onSubmitted?: (hash: `0x${string}`) => void;
  }) {
    if (!wallet || !publicClient) throw new Error("Connect your wallet first.");
    if (wallet.chain.id !== 8453) throw new Error("Switch your wallet to Base.");
    const contract = contracts[contractName];
    if (!contract.address || /^0x0{40}$/.test(contract.address)) throw new Error("Contract unavailable.");
    const { request } = await publicClient.simulateContract({
      address: contract.address as Address,
      abi: contract.abi as Abi,
      functionName: options.functionName,
      args: options.args,
      value: options.value,
      account: wallet.account,
    });
    const hash = await wallet.writeContract(request);
    options.onSubmitted?.(hash);
    const receipt = await waitForConfirmation(publicClient, hash);
    if (receipt.status !== "success") throw new Error("Transaction reverted. No payment completed.");
    return receipt;
  }
  return { writeContractAsync };
}
