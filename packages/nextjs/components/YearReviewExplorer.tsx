"use client";

import { sdk } from "@farcaster/miniapp-sdk";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountSearch } from "~~/components/AccountSearch";
import { CopyToast } from "~~/components/CopyToast";
import { useMiniapp } from "~~/components/MiniappProvider";
import { NumberText } from "~~/components/NumberText";
import { ShareActions } from "~~/components/ShareActions";
import { YearReviewFireworks } from "~~/components/YearReviewFireworks";
import { PURPLES } from "~~/lib/activity";
import { LOGO_PIXELS } from "~~/lib/brand";
import { formatShareText, shareCredit, type ShareTarget } from "~~/lib/share-credit";
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
      <div className="year-review-keepsake">
        <div>
          <p className="eyebrow">The keepsake</p>
          <h2>One year. One NFT.</h2>
          <p>All four chapters, together in one edition.</p>
        </div>
        <button type="button" onClick={() => void prepare()} disabled={busy} aria-expanded={!!image}>
          {busy ? "Preparing recap NFT…" : image ? "Hide NFT preview" : "Preview full recap NFT"}
        </button>
      </div>
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
  draft: draftEdition,
}: {
  initialUser: string;
  initialEnd?: string;
  previewOnly: boolean;
  draft: boolean;
}) {
  const { isMiniApp, fid } = useMiniapp();
  const [draft, setDraft] = useState(initialUser);
  const [request, setRequest] = useState({ user: initialUser, end: initialEnd });
  const [result, setResult] = useState<{ request: typeof request; data?: YearReview; error?: string }>();
  const [page, setPage] = useState(0);
  const [copyCount, setCopyCount] = useState(0);
  const [shareError, setShareError] = useState("");
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
    setShareError("");
    setRequest({ user, end: request.end });
    window.history.replaceState(null, "", user ? yearReviewPath(user, request.end) : "/year-in-review");
  }

  async function share(target: ShareTarget) {
    if (!data) return;
    setShareError("");
    const url = new URL(yearReviewPath(data.profile.fid, data.end, String(Date.now())), window.location.origin).href;
    if (target === "copy") {
      try {
        await navigator.clipboard.writeText(url);
        setCopyCount((count) => count + 1);
      } catch {
        setShareError(`Copy this link: ${url}`);
      }
      return;
    }
    const name = data.profile.username ? `@${data.profile.username}` : `FID ${data.profile.fid}`;
    const subject = fid === data.profile.fid ? "My" : `${name}’s`;
    const text = formatShareText(
      `${subject} ${yearReviewYear} on Farcaster, in four chapters. ✦\n\n${shareCredit(target)}`,
      target,
    );
    if (target === "farcaster" && isMiniApp) {
      try {
        await sdk.actions.composeCast({ text, embeds: [url] });
        return;
      } catch {
        /* Fall back to the web composer. */
      }
    }
    const compose = new URL(target === "x" ? "https://x.com/intent/post" : "https://farcaster.xyz/~/compose");
    compose.searchParams.set("text", text);
    compose.searchParams.set(target === "x" ? "url" : "embeds[]", url);
    window.open(compose.toString(), "_blank", "noopener,noreferrer");
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
        {draftEdition && <span className="year-review-badge">Draft preview</span>}
      </header>
      <section className="year-review-hero">
        <div className="year-review-fireworks">
          <YearReviewFireworks />
        </div>
        <p className="eyebrow">Farcaster · The New Year Edition</p>
        <h1>
          <span>{yearReviewYear}</span> in review
        </h1>
        <p>The casts, conversations, and connections that made your year.</p>
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
          <div className="year-review-progress" aria-hidden="true">
            {sections.map(({ title }, index) => (
              <span key={title} data-state={index === page ? "current" : index < page ? "past" : "future"} />
            ))}
          </div>
          <div className="year-review-meta">
            <span>Through {date.format(new Date(`${data.end}T00:00:00Z`))} UTC</span>
            <span>
              Chapter {page + 1} of {sections.length}
            </span>
          </div>
          <h2 id="year-review-section">{section.title}</h2>
          <p>{section.description}</p>
          {section.stats.length ? (
            <dl className="year-review-stats">
              {section.stats.map(([label, value]) => (
                <div key={label}>
                  <dt>
                    <span className="year-review-stat-fireworks" aria-hidden="true">
                      <YearReviewFireworks />
                    </span>
                    {label}
                  </dt>
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
      {data && (
        <>
          <ShareActions placement="below" disabled={false} onShare={share} heading="Share the New Year Edition" />
          <CopyToast count={copyCount} />
          {shareError && (
            <p role="status" className="notice">
              {shareError}
            </p>
          )}
        </>
      )}
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
