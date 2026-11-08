import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { YearReviewExplorer } from "~~/components/YearReviewExplorer";
import { yearReviewAvailable, yearReviewPublished } from "~~/lib/year-review-data";

export const metadata: Metadata = {
  title: "2026 Year in Review — Faralytics",
  robots: { index: false, follow: false },
};

export default async function YearReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!yearReviewAvailable()) notFound();
  const { user, end } = await searchParams;
  return (
    <YearReviewExplorer
      initialUser={typeof user === "string" ? user.slice(0, 64) : ""}
      initialEnd={typeof end === "string" ? end.slice(0, 10) : undefined}
      previewOnly={!yearReviewPublished()}
    />
  );
}
