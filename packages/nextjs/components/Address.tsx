"use client";
import type { Address as AddressType } from "viem";
export function Address({ address }: { address: AddressType }) {
  return (
    <span className="wallet-address">
      <a href={`https://basescan.org/address/${address}`} target="_blank" rel="noreferrer" title={address}>
        {address.slice(0, 6)}…{address.slice(-4)}
      </a>
      <button
        type="button"
        aria-label="Copy wallet address"
        onClick={() => void navigator.clipboard.writeText(address)}
      >
        Copy
      </button>
    </span>
  );
}
