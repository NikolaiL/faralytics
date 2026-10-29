import type { Hash, PublicClient } from "viem";

/** Poll only while a user-submitted transaction is pending, independently of background reads. */
export function waitForConfirmation(client: Pick<PublicClient, "waitForTransactionReceipt">, hash: Hash) {
  return client.waitForTransactionReceipt({ hash, confirmations: 2, pollingInterval: 1_000, timeout: 120_000 });
}
