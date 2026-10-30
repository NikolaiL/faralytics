"use client";
/* eslint-disable @next/next/no-img-element -- The prepared PNG preview is already a self-contained data URI. */
import { NumberText } from "./NumberText";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useAccount, useConnect, usePublicClient, useSwitchChain } from "wagmi";
import type { Connector } from "wagmi";
import { decodeEventLog, erc20Abi, parseEther } from "viem";
import { sdk } from "@farcaster/miniapp-sdk";
import { config } from "~~/services/web3/wagmiConfig";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import deployedContracts from "~~/contracts/deployedContracts";
import externalContracts, { TREASURY } from "~~/contracts/externalContracts";
import type { Activity } from "~~/lib/activity";
import type { PreparedNFT } from "~~/lib/ipfs";
import { waitForConfirmation } from "~~/lib/transactions";
import { celebrateTransaction } from "~~/lib/confetti";
import { useMiniapp } from "./MiniappProvider";
import { Address } from "./Address";
const NFT = deployedContracts[8453].FaralyticsIPFS;
const USDC = externalContracts[8453].USDC;
function coffeeReceived(receipt: {
  status: string;
  logs: readonly { address: string; data: `0x${string}`; topics: readonly `0x${string}`[] }[];
}) {
  if (receipt.status !== "success") return 0n;
  return receipt.logs.reduce((amount, log) => {
    if (log.address.toLowerCase() !== USDC.address.toLowerCase()) return amount;
    try {
      const event = decodeEventLog({
        abi: erc20Abi,
        data: log.data,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      return event.eventName === "Transfer" && event.args.to.toLowerCase() === TREASURY.toLowerCase()
        ? amount + event.args.value
        : amount;
    } catch {
      return amount;
    }
  }, 0n);
}
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
type PendingNFT = { package: PreparedNFT; transactionHash: `0x${string}`; tokenId?: string };
type Selection = { kind: "mint" | "coffee"; activity: Activity; resume?: PendingNFT };
const PENDING_KEY = "faralytics:pending-ipfs-nft";
function Actions({ activity, disabled }: { activity: Activity; disabled?: boolean }) {
  const { isMiniApp } = useMiniapp();
  const account = useAccount();
  const { connectors, connectAsync } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const client = usePublicClient();
  const mint = useScaffoldWriteContract("FaralyticsIPFS");
  const coffee = useScaffoldWriteContract("USDC");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [preview, setPreview] = useState("");
  const [prepared, setPrepared] = useState<PreparedNFT | null>(null);
  const [pendingNFT, setPendingNFT] = useState<PendingNFT | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [tx, setTx] = useState<`0x${string}` | null>(null);
  const [nativeCoffee, setNativeCoffee] = useState(false);
  const [showWallets, setShowWallets] = useState(false);
  const [availableWallets, setAvailableWallets] = useState<Connector[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const guard = useRef(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!selection) return;
    previousFocus.current = document.activeElement as HTMLElement;
    let active = true;
    setPreview("");
    setPrepared(null);
    setPrice(null);
    setNativeCoffee(false);
    void fetch("/api/eth-price")
      .then((r) => r.json())
      .then((r) => {
        if (active) setPrice(r.usd);
      })
      .catch(() => {});
    const abort = new AbortController();
    if (selection.kind === "mint") {
      if (selection.resume) {
        setPrepared(selection.resume.package);
        setPreview(`data:image/png;base64,${selection.resume.package.imageBase64}`);
      } else {
        void fetch("/api/nft/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user: selection.activity.profile.fid,
            period: selection.activity.period,
            end: selection.activity.anchor,
          }),
          signal: abort.signal,
        })
          .then(async (response) => {
            const body = await response.json();
            if (!response.ok) throw new Error(body.error);
            return body as PreparedNFT;
          })
          .then((value) => {
            if (active) {
              setPrepared(value);
              setPreview(`data:image/png;base64,${value.imageBase64}`);
            }
          })
          .catch(() => {
            if (active) setMessage("Could not prepare the NFT image. Close and try again.");
          });
      }
    }
    if (selection.kind === "coffee" && isMiniApp) {
      void sdk
        .getCapabilities()
        .then((capabilities) => {
          if (active) setNativeCoffee(capabilities.includes("actions.sendToken"));
        })
        .catch(() => {});
    }
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !guard.current) setSelection(null);
    };
    document.addEventListener("keydown", close);
    return () => {
      active = false;
      abort.abort();
      document.removeEventListener("keydown", close);
      previousFocus.current?.focus();
    };
  }, [selection, isMiniApp]);
  useEffect(() => {
    if (!showWallets) return;
    let active = true;
    void Promise.all(
      connectors
        .filter((c) => c.id !== "farcaster")
        .map(async (connector) => {
          try {
            return connector.type !== "injected" || (await connector.getProvider()) ? connector : null;
          } catch {
            return null;
          }
        }),
    ).then((results) => {
      if (!active) return;
      const wallets = results.filter((c): c is Connector => c !== null);
      setAvailableWallets(
        wallets.filter(
          (c) => c.id !== "injected" || !wallets.some((other) => other.type === "injected" && other.id !== "injected"),
        ),
      );
    });
    return () => {
      active = false;
    };
  }, [showWallets, connectors]);
  async function connectBrowserWallet(connector: Connector) {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setMessage("");
    try {
      await connectAsync({ connector, chainId: 8453 });
      setShowWallets(false);
      setMessage("Wallet connected. Review the details, then confirm.");
    } catch (error) {
      const detail = error as { shortMessage?: string; message?: string };
      setMessage(
        /reject|denied|cancel/i.test(detail.shortMessage || detail.message || "")
          ? "Connection cancelled. Choose a wallet to try again."
          : "Could not connect this wallet. Check its connection window, or choose another wallet.",
      );
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null");
      if (saved?.transactionHash && saved?.package?.metadataURI) setPendingNFT(saved);
    } catch {
      /* Storage is optional for normal minting. */
    }
  }, []);
  function savePending(value: PendingNFT | null) {
    setPendingNFT(value);
    try {
      if (value) sessionStorage.setItem(PENDING_KEY, JSON.stringify(value));
      else sessionStorage.removeItem(PENDING_KEY);
    } catch {
      /* Keep the in-memory upload retry available. */
    }
  }
  function mintedToken(receipt: {
    logs: readonly { address: string; data: `0x${string}`; topics: readonly `0x${string}`[] }[];
  }) {
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== NFT.address.toLowerCase()) continue;
      try {
        const event = decodeEventLog({
          abi: NFT.abi,
          topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
          data: log.data,
        });
        if (event.eventName === "ActivityMinted") return String(event.args.tokenId);
      } catch {
        /* Other ERC721 events. */
      }
    }
  }
  async function publishNFT(value: PendingNFT) {
    if (!client) throw new Error("Base is unavailable.");
    let tokenId = value.tokenId;
    if (!tokenId) {
      setMessage("Checking the saved mint on Base…");
      const receipt = await waitForConfirmation(client, value.transactionHash);
      if (receipt.status !== "success") {
        savePending(null);
        setMessage("The saved mint did not complete. Close this dialog to try again.");
        return;
      }
      tokenId = mintedToken(receipt);
      if (!tokenId) {
        savePending(null);
        setMessage("No NFT was minted in the saved transaction. Close this dialog to try again.");
        return;
      }
    }
    setToken(tokenId);
    savePending({ ...value, tokenId });
    setMessage("Mint confirmed. Pinning your image and metadata to IPFS…");
    const response = await fetch("/api/nft/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...value.package, tokenId }),
      signal: AbortSignal.timeout(70_000),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Image upload needs another try.");
    if (result.metadataURI !== value.package.metadataURI) throw new Error("Unexpected metadata address.");
    savePending(null);
    celebrateTransaction(value.transactionHash);
    setMessage("Your activity NFT is minted. Its image and metadata are pinned on IPFS.");
  }
  async function retryUpload() {
    if (!pendingNFT || guard.current) return;
    guard.current = true;
    setBusy(true);
    try {
      await publishNFT(pendingNFT);
    } catch {
      setMessage("The NFT transaction is saved. Retry the artwork upload below; you do not need to mint again.");
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  function open(kind: Selection["kind"]) {
    setMessage("");
    setShowWallets(false);
    setTx(null);
    setToken(null);
    if (kind === "mint" && pendingNFT) {
      setTx(pendingNFT.transactionHash);
      setToken(pendingNFT.tokenId || null);
      setMessage("Finish the saved NFT upload without another mint payment.");
      setSelection({ kind, activity, resume: pendingNFT });
    } else setSelection({ kind, activity });
  }
  async function run() {
    if (!selection || guard.current || !client) return;
    guard.current = true;
    setBusy(true);
    setMessage("");
    let nftSubmitted = false;
    try {
      if (nativeCoffee && selection.kind === "coffee") {
        const result = await sdk.actions.sendToken({
          token: `eip155:8453/erc20:${USDC.address}`,
          amount: "2000000",
          recipientAddress: TREASURY,
        });
        if (!result.success) {
          setMessage(
            result.reason === "rejected_by_user"
              ? "Cancelled. No payment sent."
              : "Farcaster could not complete the send. Check your wallet before trying again.",
          );
          return;
        }
        setTx(result.send.transaction);
        setMessage("Checking your payment on Base…");
        const receipt = await waitForConfirmation(client, result.send.transaction);
        const received = coffeeReceived(receipt);
        const paid = received === 2_000_000n;
        if (received > 0n) celebrateTransaction(receipt.transactionHash);
        setMessage(
          paid
            ? "Thank you for the coffee! 2 USDC received."
            : "Your send was completed with different details. See the transaction for the amount and recipient.",
        );
        return;
      }
      if (!account.isConnected) {
        if (!isMiniApp) {
          setShowWallets(true);
          return;
        }
        const connector = connectors.find((c) => (isMiniApp ? c.id === "farcaster" : c.id !== "farcaster"));
        if (!connector) throw new Error("Open in Farcaster or a browser with an Ethereum wallet installed.");
        await connectAsync({ connector, chainId: 8453 });
        setMessage("Wallet connected. Review the details, then confirm.");
        return;
      }
      if (account.chainId !== 8453) {
        await switchChainAsync({ chainId: 8453 });
        setMessage("Switched to Base. Confirm when ready.");
        return;
      }
      const onSubmitted = (hash: `0x${string}`) => {
        setTx(hash);
        if (selection.kind === "mint" && prepared) {
          nftSubmitted = true;
          savePending({ package: prepared, transactionHash: hash });
        }
        setMessage("Transaction sent. Waiting for confirmation…");
      };
      if (selection.kind === "mint") {
        if (!prepared) throw new Error("Prepare your NFT first.");
        const receipt = await mint.writeContractAsync({
          functionName: "mint",
          args: [prepared.metadataURI],
          value: parseEther("0.001"),
          onSubmitted,
        });
        const tokenId = mintedToken(receipt);
        if (!tokenId) {
          savePending(null);
          nftSubmitted = false;
          throw new Error("No NFT was minted in this transaction.");
        }
        await publishNFT({ package: prepared, transactionHash: receipt.transactionHash, tokenId });
      } else {
        const receipt = await coffee.writeContractAsync({
          functionName: "transfer",
          args: [TREASURY, 2_000_000n],
          onSubmitted,
        });
        if (coffeeReceived(receipt) !== 2_000_000n) throw new Error("No coffee payment was found in this transaction.");
        celebrateTransaction(receipt.transactionHash);
        setMessage("Thank you for the coffee! 2 USDC received.");
      }
    } catch (error) {
      const detail = error as { code?: number; shortMessage?: string; message?: string };
      const rejected =
        detail.code === 4001 || /reject|denied|cancel/i.test(detail.shortMessage || detail.message || "");
      setMessage(
        nftSubmitted
          ? "Your mint transaction is saved. Finish the artwork upload below without paying another mint fee."
          : rejected
            ? "Cancelled. No new payment sent."
            : (detail.shortMessage || "Could not complete this step.") +
              " If a transaction was sent, check its status below before trying again.",
      );
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  const isMint = selection?.kind === "mint";
  const needsWallet = !nativeCoffee || isMint;
  return (
    <>
      <div className="onchain-actions" data-testid="onchain-actions">
        <button className="mint-button" data-testid="mint-nft" disabled={disabled} onClick={() => open("mint")}>
          {pendingNFT ? "Finish NFT upload" : "Mint my activity NFT"}{" "}
          <span>
            <NumberText>{pendingNFT ? "No new mint fee" : "0.001 ETH ↗"}</NumberText>
          </span>
        </button>
        <button className="coffee-button" data-testid="buy-coffee" disabled={disabled} onClick={() => open("coffee")}>
          ☕ Buy @nikolaii.eth a coffee{" "}
          <span>
            <NumberText>2 USDC</NumberText>
          </span>
        </button>
      </div>
      {selection &&
        createPortal(
          <div
            className="payment-overlay"
            onClick={(event) => {
              if (event.target === event.currentTarget && !busy) setSelection(null);
            }}
          >
            <section
              className="payment-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="payment-title"
              data-testid="payment-modal"
              onKeyDown={(event) => {
                if (event.key !== "Tab") return;
                const nodes = event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]");
                const first = nodes[0],
                  last = nodes[nodes.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first?.focus();
                }
              }}
            >
              <h2 id="payment-title">{isMint ? "Keep this year forever" : "A coffee for the creator"}</h2>
              {isMint &&
                (preview ? (
                  <img className="nft-preview" src={preview} alt="Exact permanent NFT artwork preview" />
                ) : (
                  <p>Preparing your NFT preview…</p>
                ))}
              <dl>
                <dt>You pay</dt>
                <dd>
                  <NumberText>
                    {isMint ? `0.001 ETH${price ? ` (≈ $${(price * 0.001).toFixed(2)})` : ""}` : "2 USDC (about $2)"}
                  </NumberText>
                </dd>
                <dt>{isMint ? "Mint contract" : "Recipient"}</dt>
                <dd>
                  <Address address={isMint ? NFT.address : TREASURY} />
                </dd>
                {isMint && (
                  <>
                    <dt>Creator / fee recipient</dt>
                    <dd>
                      <Address address={TREASURY} />
                    </dd>
                  </>
                )}
                <dt>Network</dt>
                <dd>Base · network fee shown by your wallet</dd>
                {account.address && needsWallet && (
                  <>
                    <dt>Your wallet</dt>
                    <dd>
                      <Address address={account.address} />
                    </dd>
                  </>
                )}
              </dl>
              <p>
                {isMint
                  ? "One transferable NFT of this chart. The image and metadata are pinned to public IPFS; their permanent content address is stored onchain. This is a snapshot of captured activity; it does not verify account ownership. Mint payments are final."
                  : "A voluntary tip to support Faralytics. No purchase or NFT is included."}
              </p>
              {nativeCoffee && !isMint && (
                <p>
                  Farcaster’s send-money screen will open with <NumberText>2</NumberText> USDC and the recipient filled
                  in.
                </p>
              )}
              {showWallets && !account.isConnected && (
                <div className="wallet-options" data-testid="wallet-options">
                  <h3>Choose your wallet</h3>
                  <p>
                    Use an installed browser wallet, or connect with Coinbase Wallet. Connecting does not send a
                    payment.
                  </p>
                  {availableWallets.map((connector) => (
                    <button
                      key={connector.uid}
                      type="button"
                      disabled={busy}
                      data-testid={`connect-${connector.id}`}
                      onClick={() => void connectBrowserWallet(connector)}
                    >
                      {connector.id === "injected" ? "Browser wallet" : connector.name} <span>↗</span>
                    </button>
                  ))}
                  {!availableWallets.some((connector) => connector.type === "injected") && (
                    <p>No browser wallet extension detected. You can still use Coinbase Wallet.</p>
                  )}
                </div>
              )}
              {message && (
                <p role="status" data-testid="payment-status">
                  {message}
                </p>
              )}
              {tx && (
                <a className="transaction-link" href={`https://basescan.org/tx/${tx}`} target="_blank" rel="noreferrer">
                  View transaction ↗
                </a>
              )}
              {token && (
                <a
                  className="transaction-link"
                  href={`https://opensea.io/assets/base/${NFT.address}/${token}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View NFT #{token} ↗
                </a>
              )}
              <div className="payment-buttons">
                {pendingNFT && selection.kind === "mint" && (
                  <button
                    type="button"
                    className="mint-button"
                    data-testid="retry-nft-upload"
                    disabled={busy}
                    onClick={() => void retryUpload()}
                  >
                    {busy ? "Uploading…" : "Retry artwork upload"}
                  </button>
                )}
                <button autoFocus type="button" disabled={busy} onClick={() => setSelection(null)}>
                  {tx ? "Close" : "Cancel"}
                </button>
                {!tx && !(showWallets && !account.isConnected) && (
                  <button
                    type="button"
                    className="mint-button"
                    data-testid="confirm-payment"
                    disabled={busy || (isMint && !preview)}
                    onClick={() => void run()}
                  >
                    {busy
                      ? "Please wait…"
                      : needsWallet && !account.isConnected
                        ? "Connect wallet"
                        : needsWallet && account.chainId !== 8453
                          ? "Switch to Base"
                          : isMint
                            ? "Confirm mint · 0.001 ETH"
                            : "Confirm coffee · 2 USDC"}
                  </button>
                )}
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
export default function OnchainActions(props: { activity: Activity; disabled?: boolean }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <Actions {...props} />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
