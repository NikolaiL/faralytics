import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const cookieName = "faralytics-year-review";
const digest = (value: string) => createHash("sha256").update(value).digest();
const matches = (actual: string, expected: string) => timingSafeEqual(digest(actual), digest(expected));
const session = (password: string) => createHmac("sha256", password).update(cookieName).digest("hex");

export function yearReviewIsPublic() {
  return process.env.YEAR_REVIEW_ENABLED === "1" && !process.env.YEAR_REVIEW_PASSWORD;
}

export function yearReviewCanMint() {
  return yearReviewIsPublic() || !!process.env.YEAR_REVIEW_PASSWORD;
}

export async function yearReviewAccess() {
  const { VERCEL, VERCEL_ENV, YEAR_REVIEW_PREVIEW, YEAR_REVIEW_PASSWORD } = process.env;
  if (YEAR_REVIEW_PASSWORD) {
    const value = (await cookies()).get(cookieName)?.value ?? "";
    return matches(value, session(YEAR_REVIEW_PASSWORD)) ? "allowed" : "locked";
  }
  const local = !VERCEL && !VERCEL_ENV;
  const preview = VERCEL_ENV === "preview" && YEAR_REVIEW_PREVIEW === "1";
  return local || preview || yearReviewIsPublic() ? "allowed" : "hidden";
}

export async function unlockYearReview(input: string, secure: boolean) {
  const password = process.env.YEAR_REVIEW_PASSWORD;
  if (!password || !matches(input, password)) return false;
  (await cookies()).set(cookieName, session(password), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  });
  return true;
}
