import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { waitForConfirmation } from "../packages/nextjs/lib/transactions.ts";
const { createPublicClient, http } = createRequire(new URL("../packages/nextjs/package.json", import.meta.url))("viem");

test("a pending transaction confirms promptly despite five-minute background polling", { timeout: 8_000 }, async () => {
  const hash = `0x${"11".repeat(32)}` as const;
  const blockHash = `0x${"22".repeat(32)}`;
  const address = `0x${"33".repeat(20)}`;
  let mined = false;
  let pendingReceiptObserved = false;
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const query = JSON.parse(raw);
    let result;
    if (query.method === "eth_blockNumber") result = mined ? "0x3" : "0x1";
    else if (query.method === "eth_getTransactionReceipt") {
      if (!mined) { pendingReceiptObserved = true; result = null; }
      else result = { transactionHash: hash, transactionIndex: "0x0", blockHash, blockNumber: "0x2", from: address, to: address, cumulativeGasUsed: "0x5208", gasUsed: "0x5208", effectiveGasPrice: "0x1", status: "0x1", type: "0x2", logs: [], logsBloom: `0x${"00".repeat(256)}`, contractAddress: null };
    } else if (query.method === "eth_getTransactionByHash") result = { hash, from: address, to: address, nonce: "0x0", gas: "0x5208", value: "0x0", input: "0x", type: "0x2", chainId: "0x2105", maxFeePerGas: "0x1", maxPriorityFeePerGas: "0x1", blockHash: null, blockNumber: null, transactionIndex: null, r: "0x1", s: "0x1", v: "0x1" };
    else if (query.method === "eth_getBlockByNumber") result = { number: mined ? "0x3" : "0x1", hash: blockHash, transactions: [] };
    else throw new Error(`Unexpected RPC method: ${query.method}`);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ jsonrpc: "2.0", id: query.id, result }));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const client = createPublicClient({ transport: http(`http://127.0.0.1:${port}`), pollingInterval: 300_000, cacheTime: 300_000 });
  const timer = setTimeout(() => { mined = true; }, 200);
  try {
    const start = Date.now();
    const receipt = await waitForConfirmation(client, hash);
    assert.equal(receipt.status, "success");
    assert.ok(pendingReceiptObserved, "the test must begin before the transaction is mined");
    assert.ok(Date.now() - start < 5_000, "confirmation must not wait for the background interval");
    assert.equal(client.pollingInterval, 300_000, "background RPC reads stay slow");
  } finally {
    clearTimeout(timer);
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
