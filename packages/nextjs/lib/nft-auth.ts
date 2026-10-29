import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
export function signNFTPackage(metadataURI: string) {
  const secret = process.env.PINATA_API_SECRET;
  if (!secret) throw new Error("NFT package signing is not configured.");
  return createHmac("sha256", secret).update(`faralytics-ipfs-v2:${metadataURI}`).digest("hex");
}
export function authenticNFTPackage(metadataURI: string, signature: unknown) {
  if (typeof signature !== "string" || !/^[a-f0-9]{64}$/.test(signature)) return false;
  return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(signNFTPackage(metadataURI), "hex"));
}
