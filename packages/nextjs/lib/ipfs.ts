import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
export async function contentCID(bytes: Uint8Array) {
  return CID.createV1(0x55, await sha256.digest(bytes)).toString();
}
export type PreparedNFT = {
  signature: string;
  metadataURI: string;
  imageURI: string;
  imageBase64: string;
  metadataJSON: string;
};
export async function validatePackage(value: PreparedNFT) {
  if (
    !value ||
    typeof value.imageBase64 !== "string" ||
    value.imageBase64.length > 350_000 ||
    typeof value.metadataJSON !== "string" ||
    Buffer.byteLength(value.metadataJSON) > 64_000
  )
    throw new Error("Invalid NFT package size.");
  const image = Buffer.from(value.imageBase64, "base64");
  if (
    image.length > 262_144 ||
    image.toString("base64") !== value.imageBase64 ||
    !image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    throw new Error("Invalid PNG package.");
  const imageURI = `ipfs://${await contentCID(image)}`;
  const metadataURI = `ipfs://${await contentCID(Buffer.from(value.metadataJSON))}`;
  const metadata = JSON.parse(value.metadataJSON);
  if (imageURI !== value.imageURI || metadata.image !== imageURI || metadataURI !== value.metadataURI)
    throw new Error("NFT package does not match its IPFS content addresses.");
  return { image, metadata: Buffer.from(value.metadataJSON), imageURI, metadataURI };
}
