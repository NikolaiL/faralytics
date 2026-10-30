export type ShareTarget = "farcaster" | "x" | "copy";
export function shareCredit(target: ShareTarget = "farcaster") {
  return target === "x"
    ? "faralytics - created by @NikolaiLeb with @viniapp_xyz"
    : "faralytics - created by @nikolaii.eth with @viniapp";
}
