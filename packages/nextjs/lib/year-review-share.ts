import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { validFid } from "~~/lib/activity";
import { yearReviewPath } from "~~/lib/year-review";

function sign(user: string, end: string, ts: string) {
  const secret = process.env.YEAR_REVIEW_SHARE_SECRET;
  return secret
    ? createHmac("sha256", secret)
        .update(JSON.stringify(["year-review-preview-v1", user, end, ts]))
        .digest("hex")
    : null;
}

export function protectedYearReviewSharePath(user: string, end: string) {
  if (!process.env.YEAR_REVIEW_PASSWORD) return undefined;
  const ts = String(Date.now());
  const token = sign(user, end, ts);
  return token ? yearReviewPath(user, end, ts, token) : null;
}

export function isProtectedYearReviewShare(user: unknown, end: string, ts: unknown, token: unknown) {
  if (
    !process.env.YEAR_REVIEW_PASSWORD ||
    typeof user !== "string" ||
    !validFid(user) ||
    typeof ts !== "string" ||
    !/^\d{13}$/.test(ts) ||
    typeof token !== "string" ||
    !/^[0-9a-f]{64}$/.test(token)
  )
    return false;
  const expected = sign(user, end, ts);
  return !!expected && timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expected, "hex"));
}
