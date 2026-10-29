import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import deployedContracts from "~~/contracts/deployedContracts";
import { validatePackage } from "~~/lib/ipfs";
import { authenticNFTPackage } from "~~/lib/nft-auth";
import { pinNFT } from "~~/lib/pinata";
import { reportServerError, withErrorReporting } from "~~/utils/reportServerError";
export const runtime = "nodejs";
export const maxDuration = 60;
const client = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || "https://base-rpc.publicnode.com"),
});
export const POST = withErrorReporting("/api/nft/publish", async (request) => {
  const text = await request.text();
  if (text.length > 450_000) return Response.json({ error: "Request too large." }, { status: 413 });
  let input;
  try {
    input = JSON.parse(text);
    if (!/^[1-9][0-9]{0,19}$/.test(input.tokenId)) throw new Error();
    await validatePackage(input);
    if (!authenticNFTPackage(input.metadataURI, input.signature))
      throw new Error("Invalid server-prepared package signature.");
  } catch {
    return Response.json({ error: "Invalid NFT package." }, { status: 400 });
  }
  try {
    // Only pin bytes matching a real paid mint. Public callers cannot upload arbitrary free files.
    const uri = await client.readContract({
      ...deployedContracts[8453].FaralyticsIPFS,
      functionName: "tokenURI",
      args: [BigInt(input.tokenId)],
    });
    if (uri !== input.metadataURI)
      return Response.json({ error: "Package does not match this minted NFT." }, { status: 409 });
  } catch {
    return Response.json({ error: "Mint is not confirmed yet. Retry the upload shortly." }, { status: 409 });
  }
  try {
    return Response.json(
      await pinNFT({
        signature: input.signature,
        imageBase64: input.imageBase64,
        imageURI: input.imageURI,
        metadataURI: input.metadataURI,
        metadataJSON: input.metadataJSON,
      }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    reportServerError(error, "/api/nft/publish");
    return Response.json(
      { error: "NFT minted, but the image upload needs another try. Retry upload without minting again." },
      { status: 502 },
    );
  }
});
