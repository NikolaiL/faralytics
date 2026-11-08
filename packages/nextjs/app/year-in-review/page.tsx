import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { YearReviewExplorer } from "~~/components/YearReviewExplorer";
import { YearReviewFireworks } from "~~/components/YearReviewFireworks";
import { yearReviewAccess, yearReviewCanMint, yearReviewIsPublic } from "~~/lib/year-review-access";
import { yearReviewEnd, yearReviewPath, yearReviewYear } from "~~/lib/year-review";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const title = `${yearReviewYear} Year in Review — Faralytics`;

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const metadata = { title, robots: { index: false, follow: false } };
  if (!yearReviewIsPublic()) return metadata;
  const { user, end, ts } = await searchParams;
  if (typeof user !== "string" || !/^@?[a-z0-9][a-z0-9.-]{0,62}$/i.test(user)) return metadata;
  try {
    const origin = process.env.NEXT_PUBLIC_URL || "http://localhost:3100";
    const url = new URL(
      yearReviewPath(user, yearReviewEnd(end), typeof ts === "string" ? ts.slice(0, 16) : undefined),
      origin,
    );
    const image = new URL(`/api/og/year-in-review/farcaster.png${url.search}`, origin).toString();
    const description = "Four chapters of captured Farcaster activity in the New Year Edition.";
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
        "fc:miniapp": JSON.stringify({
          version: "1",
          imageUrl: image,
          button: {
            title: "Check My Year in Review",
            action: { type: "launch_miniapp", name: "Faralytics", url, splashBackgroundColor: "#0d0b12" },
          },
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
