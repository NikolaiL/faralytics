"use client";

import { sdk } from "@farcaster/miniapp-sdk";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountSearch } from "~~/components/AccountSearch";
import { AvatarImage } from "~~/components/AvatarImage";
import { CopyToast } from "~~/components/CopyToast";
import { useMiniapp } from "~~/components/MiniappProvider";
import { NumberText } from "~~/components/NumberText";
import { ShareActions } from "~~/components/ShareActions";
import { YearReviewFireworks } from "~~/components/YearReviewFireworks";
import { PURPLES } from "~~/lib/activity";
import { LOGO_PIXELS } from "~~/lib/brand";
import type { ShareTarget } from "~~/lib/share-credit";
import {
  formatYearReviewPostTime,
  yearReviewPath,
  yearReviewSections,
  yearReviewShareText,
  yearReviewYear,
  type YearReview,
} from "~~/lib/year-review";

const OnchainActions = dynamic(() => import("./OnchainActions"), { ssr: false });

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
          <p>All five chapters, together in one edition.</p>
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
          alt="Combined Year in Review NFT artwork with all five chapters"
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
  const [result, setResult] = useState<{
    request: typeof request;
    data?: YearReview & { sharePath?: string | null };
    error?: string;
  }>();
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
    if (data.sharePath === null) {
      setShareError("The share preview is temporarily unavailable.");
      return;
    }
    setShareError("");
    const path = data.sharePath ?? yearReviewPath(data.profile.fid, data.end, String(Date.now()));
    const url = new URL(path, window.location.origin).href;
    if (target === "copy") {
      try {
        await navigator.clipboard.writeText(url);
        setCopyCount((count) => count + 1);
      } catch {
        setShareError(`Copy this link: ${url}`);
      }
      return;
    }
    const text = yearReviewShareText(data, target, isMiniApp ? (fid ?? undefined) : undefined);
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
            <span>
              Chapter {page + 1} of {sections.length}
            </span>
          </div>
          <h2 id="year-review-section">{section.title}</h2>
          <p>{section.description}</p>
          {section.people ? (
            section.people.length ? (
              <ol className="year-review-people">
                {section.people.map(({ profile, sent, received, mutual }, index) => (
                  <li key={profile.fid}>
                    <span className="year-review-person-rank" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="result-avatar" aria-hidden="true">
                      {(profile.username ?? "FC").slice(0, 2).toUpperCase()}
                      <AvatarImage source={profile.pfp_url} size={42} />
                    </span>
                    <div className="year-review-person-name">
                      <a href={`https://farcaster.xyz/~/profiles/${profile.fid}`} target="_blank" rel="noreferrer">
                        {profile.username ? `@${profile.username}` : `FID ${profile.fid}`}
                      </a>
                      <small>
                        <NumberText>{sent.toLocaleString("en-US")}</NumberText> sent ·{" "}
                        <NumberText>{received.toLocaleString("en-US")}</NumberText> received
                      </small>
                    </div>
                    <div className="year-review-person-score">
                      <NumberText>{mutual.toLocaleString("en-US")}</NumberText>
                      <small>mutual</small>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="timeline-empty">No mutual interactions captured this year.</p>
            )
          ) : section.stats.length ? (
            <dl className="year-review-stats">
              {section.stats.map(([label, value], index) => (
                <div key={label}>
                  <dt>
                    <span className="year-review-stat-fireworks" aria-hidden="true">
                      <YearReviewFireworks variant={1 + index + page * 2} />
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
          {section.post && (
            <aside className="year-review-top-post" aria-labelledby="year-review-top-post">
              <div className="year-review-top-post-heading">
                <div>
                  <h3 id="year-review-top-post">Most engaged post</h3>
                  {section.post.postedAt && (
                    <time dateTime={section.post.postedAt}>
                      Posted {formatYearReviewPostTime(section.post.postedAt)}
                    </time>
                  )}
                </div>
                <p>
                  <NumberText>{section.post.interactions.toLocaleString("en-US")}</NumberText> interactions
                </p>
              </div>
              {section.post.text && <blockquote>{section.post.text}</blockquote>}
              <a
                href={section.post.url}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => {
                  if (!isMiniApp || !section.post) return;
                  event.preventDefault();
                  const { hash, url } = section.post;
                  void sdk.actions
                    .viewCast({ hash })
                    .catch(() => sdk.actions.openUrl(url))
                    .catch(() => {});
                }}
              >
                View post on Farcaster ↗
              </a>
            </aside>
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
