import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const cookieName = "faralytics-year-review";
const embeddedCookieName = "__Host-faralytics-year-review-embedded";
const digest = (value: string) => createHash("sha256").update(value).digest();
const matches = (actual: string, expected: string) => timingSafeEqual(digest(actual), digest(expected));
const session = (password: string, name: string) => createHmac("sha256", password).update(name).digest("hex");

export function yearReviewIsPublic() {
  return process.env.YEAR_REVIEW_ENABLED === "1" && !process.env.YEAR_REVIEW_PASSWORD;
}

export function yearReviewCanMint() {
  return yearReviewIsPublic() || !!process.env.YEAR_REVIEW_PASSWORD;
}

export async function yearReviewAccess() {
  const { VERCEL, VERCEL_ENV, YEAR_REVIEW_PREVIEW, YEAR_REVIEW_PASSWORD } = process.env;
  if (YEAR_REVIEW_PASSWORD) {
    const jar = await cookies();
    const unlocked = [cookieName, embeddedCookieName].some((name) =>
      matches(jar.get(name)?.value ?? "", session(YEAR_REVIEW_PASSWORD, name)),
    );
    return unlocked ? "allowed" : "locked";
  }
  const local = !VERCEL && !VERCEL_ENV;
  const preview = VERCEL_ENV === "preview" && YEAR_REVIEW_PREVIEW === "1";
  return local || preview || yearReviewIsPublic() ? "allowed" : "hidden";
}

export async function unlockYearReview(input: string, secure: boolean) {
  const password = process.env.YEAR_REVIEW_PASSWORD;
  if (!password || !matches(input, password)) return false;
  const jar = await cookies();
  jar.set(cookieName, session(password, cookieName), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  });
  // Farcaster runs the app in a cross-site iframe, where the Lax cookie is unavailable.
  if (secure)
    jar.set(embeddedCookieName, session(password, embeddedCookieName), {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      partitioned: true,
      path: "/",
    });
  return true;
}
