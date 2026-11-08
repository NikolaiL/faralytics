"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountSearch } from "~~/components/AccountSearch";
import { useMiniapp } from "~~/components/MiniappProvider";
import { NumberText } from "~~/components/NumberText";
import { PURPLES } from "~~/lib/activity";
import { LOGO_PIXELS } from "~~/lib/brand";
import { yearReviewPath, yearReviewSections, yearReviewYear, type YearReview } from "~~/lib/year-review";

const OnchainActions = dynamic(() => import("./OnchainActions"), { ssr: false });
const date = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });

function RecapPreview({ snapshot }: { snapshot: { kind: "year-review"; user: string; end: string } }) {
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function prepare() {
    if (image) {
      setImage("");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/nft/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
        signal: AbortSignal.timeout(60000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not prepare the NFT preview.");
      setImage(`data:image/png;base64,${data.imageBase64}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not prepare the NFT preview.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="year-review-nft">
      <button
        type="button"
        className="button-primary"
        onClick={() => void prepare()}
        disabled={busy}
        aria-expanded={!!image}
      >
        {busy ? "Preparing recap NFT…" : image ? "Hide NFT preview" : "Preview full recap NFT"}
      </button>
      {error && <p role="alert">{error}</p>}
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="year-review-artwork"
          src={image}
          alt="Combined Year in Review NFT artwork with all four sections"
          width={1200}
          height={800}
        />
      )}
    </div>
  );
}

export function YearReviewExplorer({
  initialUser,
  initialEnd,
  previewOnly,
}: {
  initialUser: string;
  initialEnd?: string;
  previewOnly: boolean;
}) {
  const { isMiniApp, fid } = useMiniapp();
  const [draft, setDraft] = useState(initialUser);
  const [request, setRequest] = useState({ user: initialUser, end: initialEnd });
  const [result, setResult] = useState<{ request: typeof request; data?: YearReview; error?: string }>();
  const [page, setPage] = useState(0);
  const current = result?.request === request ? result : undefined;
  const data = current?.data;
  const busy = !!request.user && !current;
  const resolved = !!data && draft === request.user;

  useEffect(() => {
    if (!request.user) return;
    const controller = new AbortController();
    async function lookup() {
      try {
        const response = await fetch(`/api${yearReviewPath(request.user, request.end)}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load this review.");
        if (!controller.signal.aborted) {
          setResult({ request, data: body });
          window.history.replaceState(null, "", yearReviewPath(body.profile.fid, body.end));
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setResult({ request, error: error instanceof Error ? error.message : "Could not load this review." });
      }
    }
    void lookup();
    return () => controller.abort();
  }, [request]);

  function apply(value: string) {
    const user = value.trim();
    setDraft(user);
    setPage(0);
    setRequest({ user, end: request.end });
    window.history.replaceState(null, "", user ? yearReviewPath(user, request.end) : "/year-in-review");
  }

  const sections = data ? yearReviewSections(data) : [];
  const section = sections[page];
  const hasActivity = sections.some(({ stats }) => stats.some(([, value]) => value > 0));
  const snapshot = data ? { kind: "year-review" as const, user: data.profile.fid, end: data.end } : null;
  return (
    <main className="year-review-page">
      <header className="topbar">
        <Link className="wordmark" href="/">
          <span className="mark" aria-hidden="true">
            {LOGO_PIXELS.map(([x, y, level], index) => (
              <i key={index} style={{ gridColumn: x + 1, gridRow: y + 1, background: PURPLES[level] }} />
            ))}
          </span>
          faralytics<span className="wordmark-dot">.</span>
        </Link>
        {previewOnly && <span className="year-review-badge">Draft preview</span>}
      </header>
      <section className="timeline-intro">
        <p className="eyebrow">Your Farcaster year</p>
        <h1>
          {yearReviewYear} in review<span>.</span>
        </h1>
        <p>The things you posted, the conversations they started, and the people you connected with.</p>
      </section>
      <form
        className="search-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && !resolved && draft.trim()) apply(draft);
        }}
      >
        <AccountSearch
          searchId="year-review-account"
          value={resolved && data.profile.username ? `@${data.profile.username}` : draft}
          onChange={setDraft}
          onSelect={apply}
          onReset={() => apply("")}
          onShowMe={isMiniApp && fid ? () => apply(fid) : undefined}
          profile={resolved ? data.profile : undefined}
          resolved={resolved}
          busy={busy}
        />
      </form>
      {busy && (
        <p role="status" className="notice">
          <span className="search-spinner" aria-hidden="true" /> Counting captured activity…
        </p>
      )}
      {current?.error && (
        <p role="alert" className="error-box">
          {current.error}
        </p>
      )}
      {!request.user && <p className="empty-note">Look up an account to open its recap.</p>}
      {data && section && (
        <section className="year-review-panel" aria-labelledby="year-review-section">
          <div className="year-review-meta">
            <span>Through {date.format(new Date(`${data.end}T00:00:00Z`))} UTC</span>
            <span>
              Page {page + 1} of {sections.length}
            </span>
          </div>
          <h2 id="year-review-section">{section.title}</h2>
          <p>{section.description}</p>
          {section.stats.length ? (
            <dl className="year-review-stats">
              {section.stats.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    <NumberText>{value.toLocaleString("en-US")}</NumberText>
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="timeline-empty">No matching words in this period.</p>
          )}
          <nav className="year-review-pager" aria-label="Recap pages">
            <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>
              ‹ Previous
            </button>
            <div>
              {sections.map(({ title }, index) => (
                <button
                  type="button"
                  key={title}
                  aria-current={index === page ? "page" : undefined}
                  aria-label={title}
                  onClick={() => setPage(index)}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="button-primary"
              disabled={page === sections.length - 1}
              onClick={() => setPage(page + 1)}
            >
              Next ›
            </button>
          </nav>
        </section>
      )}
      {data && <p className="timeline-note">{data.coverage}</p>}
      {snapshot &&
        hasActivity &&
        (previewOnly ? (
          <RecapPreview key={`${snapshot.user}:${snapshot.end}`} snapshot={snapshot} />
        ) : (
          <OnchainActions snapshot={snapshot} />
        ))}
    </main>
  );
}
