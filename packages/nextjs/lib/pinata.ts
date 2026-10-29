import "server-only";
import { unstable_cache } from "next/cache";
import { validatePackage, type PreparedNFT } from "./ipfs";
async function upload(bytes: Buffer, filename: string, expected: string) {
  if (!process.env.PINATA_JWT) throw new Error("NFT storage is not configured.");
  const form = new FormData();
  form.set("network", "public");
  form.set("cid_version", "v1");
  form.set(
    "file",
    new Blob([new Uint8Array(bytes)], { type: filename.endsWith(".json") ? "application/json" : "image/png" }),
    filename,
  );
  const response = await fetch("https://uploads.pinata.cloud/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  const result = await response.json();
  if (!response.ok || `ipfs://${result?.data?.cid}` !== expected)
    throw new Error("Pinata could not pin the expected immutable content.");
}
export const pinNFT = unstable_cache(
  async (value: PreparedNFT) => {
    const checked = await validatePackage(value);
    await upload(checked.image, "faralytics-activity.png", checked.imageURI);
    await upload(checked.metadata, "faralytics-metadata.json", checked.metadataURI);
    return { imageURI: checked.imageURI, metadataURI: checked.metadataURI };
  },
  ["pinata-nft-v1"],
  { revalidate: 3600 },
);
