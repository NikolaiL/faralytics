import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { YearReviewExplorer } from "~~/components/YearReviewExplorer";
import { YearReviewFireworks } from "~~/components/YearReviewFireworks";
import { yearReviewAccess, yearReviewCanMint, yearReviewIsPublic } from "~~/lib/year-review-access";
import { yearReviewEnd, yearReviewPath, yearReviewYear } from "~~/lib/year-review";
import { isProtectedYearReviewShare } from "~~/lib/year-review-share";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const title = `${yearReviewYear} Year in Review — Faralytics`;

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const metadata = { title, robots: { index: false, follow: false } };
  const { user, end, ts, share } = await searchParams;
  if (typeof user !== "string" || !/^@?[a-z0-9][a-z0-9.-]{0,62}$/i.test(user)) return metadata;
  try {
    const anchor = yearReviewEnd(end);
    const shared = typeof end === "string" && isProtectedYearReviewShare(user, anchor, ts, share);
    if (!yearReviewIsPublic() && !shared) return metadata;
    const origin = process.env.NEXT_PUBLIC_URL || "http://localhost:3100";
    const timestamp = typeof ts === "string" && /^\d{13}$/.test(ts) ? ts : undefined;
    const url = new URL(
      yearReviewPath(user, anchor, timestamp, shared && typeof share === "string" ? share : undefined),
      origin,
    );
    const image = new URL(`/api/og/year-in-review/farcaster.png${url.search}`, origin).toString();
    const launchUrl = new URL(yearReviewPath(user, anchor, timestamp), origin).toString();
    const description = `Your ${yearReviewYear} Farcaster stats, top post, most-used words and Magnificent Seven.`;
    const button = {
      title: "Check My Year in Review",
      action: { type: "launch_miniapp", name: "Faralytics", url: launchUrl, splashBackgroundColor: "#0d0b12" },
    };
    return {
      ...metadata,
      description,
      openGraph: { title, description, url, images: [{ url: image, width: 1200, height: 800 }] },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [new URL(`/api/og/year-in-review/x.png${url.search}`, origin).toString()],
      },
      other: {
        "fc:miniapp": JSON.stringify({ version: "1", imageUrl: image, button }),
        "fc:frame": JSON.stringify({
          version: "1",
          imageUrl: image,
          button: { ...button, action: { ...button.action, type: "launch_frame" } },
        }),
      },
    };
  } catch {
    return metadata;
  }
}

export default async function YearReviewPage({ searchParams }: PageProps) {
  const access = await yearReviewAccess();
  if (access === "hidden") notFound();
  const { user, end, error } = await searchParams;
  const initialUser = typeof user === "string" ? user.slice(0, 64) : "";
  const initialEnd = typeof end === "string" ? end.slice(0, 10) : undefined;
  if (access === "locked") {
    return (
      <main className="year-review-page">
        <section className="year-review-hero">
          <div className="year-review-fireworks">
            <YearReviewFireworks />
          </div>
          <p className="eyebrow">Faralytics · The New Year Edition</p>
          <h1>
            <span>{yearReviewYear}</span> in review
          </h1>
          <form className="year-review-password" action="/api/year-in-review" method="post">
            <label htmlFor="recap-password">Enter the preview password</label>
            <input type="hidden" name="user" value={initialUser} />
            <input type="hidden" name="end" value={initialEnd ?? ""} />
            <div>
              <input id="recap-password" type="password" name="password" autoComplete="current-password" required />
              <button className="button-primary" type="submit">
                Unlock recap
              </button>
            </div>
            {error === "password" && <p role="alert">That password didn’t match. Try again.</p>}
          </form>
        </section>
      </main>
    );
  }
  return (
    <YearReviewExplorer
      initialUser={initialUser}
      initialEnd={initialEnd}
      previewOnly={!yearReviewCanMint()}
      draft={!yearReviewIsPublic()}
    />
  );
}
