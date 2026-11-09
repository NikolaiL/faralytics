"use client";

import { sdk } from "@farcaster/miniapp-sdk";
import NumberFlow from "@number-flow/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AccountSearch } from "~~/components/AccountSearch";
import { AvatarImage } from "~~/components/AvatarImage";
import { CopyToast } from "~~/components/CopyToast";
import { useMiniapp } from "~~/components/MiniappProvider";
import { NumberText } from "~~/components/NumberText";
import { ShareActions } from "~~/components/ShareActions";
import { WordCloudCanvas } from "~~/components/WordCloudTimeMachine";
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
  type YearReviewRating,
} from "~~/lib/year-review";

const OnchainActions = dynamic(() => import("./OnchainActions"), { ssr: false });
const finaleTitle = `Here’s to ${Number(yearReviewYear) + 1}!`;
const topPercentFormat = { style: "percent", maximumSignificantDigits: 1 } as const;
const formatTopPercent = new Intl.NumberFormat("en-US", topPercentFormat);

function RecapArtwork({ src }: { src: string }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  return (
    <figure className="year-review-artwork" data-state={state}>
      {state !== "ready" && (
        <p role="status">{state === "loading" ? "Generating recap image…" : "Recap image is unavailable."}</p>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Year in Review artwork for Farcaster sharing and the recap NFT"
        width={1200}
        height={800}
        onLoad={() => setState("ready")}
        onError={() => setState("error")}
      />
    </figure>
  );
}

function ReviewStat({
  label,
  value,
  variant,
  rating,
}: {
  label: string;
  value: number;
  variant: number;
  rating?: YearReviewRating;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const card = ref.current;
    if (!card) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setEntered(true);
        observer.disconnect();
      },
      { threshold: 0.1 },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  const topShare = rating ? rating.topPercent / 100 : 1;
  const rank = rating?.rank.toLocaleString("en-US");

  return (
    <div ref={ref}>
      <dt>
        <span className="year-review-stat-fireworks" aria-hidden="true">
          <YearReviewFireworks variant={variant} />
        </span>
        {label}
      </dt>
      <dd className="year-review-stat-value">
        <NumberFlow className="numeric-value" value={entered ? value : 0} locales="en-US" />
      </dd>
      {rating && (
        <dd className="year-review-rating">
          <div
            className="year-review-percentile"
            role="meter"
            aria-label={`${label} percentile`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={rating.percentile}
            aria-valuetext={`Rank ${rank}, top ${formatTopPercent.format(topShare)} of active accounts`}
          >
            <span
              className="year-review-percentile-fill"
              aria-hidden="true"
              style={{ transform: `scaleX(${entered ? rating.percentile / 100 : 0})` }}
            />
            <span>#{rank}</span>
            <NumberFlow
              className="year-review-percentile-value"
              value={entered ? topShare : 1}
              format={topPercentFormat}
              locales="en-US"
              prefix="Top "
              trend={-1}
            />
          </div>
        </dd>
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
    data?: YearReview & { ratings?: Record<string, YearReviewRating>; sharePath?: string | null };
    error?: string;
  }>();
  const [page, setPage] = useState(0);
  const chapterHeading = useRef<HTMLHeadingElement>(null);
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
  const chapterTitles = [...sections.map(({ title }) => title), finaleTitle];
  const isFinale = page === sections.length;
  const hasActivity = sections.some(({ stats }) => stats.some(([, value]) => value > 0));
  const snapshot = data ? { kind: "year-review" as const, user: data.profile.fid, end: data.end } : null;
  const artwork = data
    ? (data.sharePath || yearReviewPath(data.profile.fid, data.end)).replace(
        "/year-in-review?",
        "/api/og/year-in-review/farcaster.png?",
      )
    : "";

  function goToChapter(index: number) {
    setPage(index);
    requestAnimationFrame(() => chapterHeading.current?.focus());
  }

  const pager = (
    <nav className="year-review-pager" aria-label="Recap pages">
      <button type="button" disabled={page === 0} onClick={() => goToChapter(page - 1)}>
        ‹ Previous
      </button>
      <div>
        {chapterTitles.map((title, index) => (
          <button
            type="button"
            key={title}
            aria-current={index === page ? "page" : undefined}
            aria-label={title}
            onClick={() => goToChapter(index)}
          >
            {index + 1}
          </button>
        ))}
      </div>
      <button type="button" className="button-primary" disabled={isFinale} onClick={() => goToChapter(page + 1)}>
        Next ›
      </button>
    </nav>
  );

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
      {data && (
        <section
          className={isFinale ? "year-review-panel year-review-finale" : "year-review-panel"}
          aria-labelledby="year-review-section"
        >
          <div className="year-review-progress" aria-hidden="true">
            {chapterTitles.map((title, index) => (
              <span key={title} data-state={index === page ? "current" : index < page ? "past" : "future"} />
            ))}
          </div>
          <div className="year-review-meta">
            <span>
              Chapter {page + 1} of {chapterTitles.length}
            </span>
          </div>
          {pager}
          {isFinale && (
            <div className="year-review-finale-fireworks" aria-hidden="true">
              <YearReviewFireworks variant={6} />
            </div>
          )}
          <h2 id="year-review-section" ref={chapterHeading} tabIndex={-1}>
            {chapterTitles[page]}
          </h2>
          {section?.description && <p>{section.description}</p>}
          {section?.kind === "words" ? (
            section.stats.length ? (
              <div className="year-review-cloud">
                <WordCloudCanvas words={section.stats} />
              </div>
            ) : (
              <p className="timeline-empty">No matching words this year.</p>
            )
          ) : section?.people ? (
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
          ) : section ? (
            <dl className="year-review-stats" key={section.title}>
              {section.stats.map(([label, value], index) => (
                <ReviewStat
                  key={label}
                  label={label}
                  value={value}
                  variant={1 + index + page * 2}
                  rating={data.ratings?.[label]}
                />
              ))}
            </dl>
          ) : null}
          {section?.post && (
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
          {isFinale && artwork && <RecapArtwork key={artwork} src={artwork} />}
          <div className="year-review-actions">
            <ShareActions placement="below" disabled={false} onShare={share} heading="Share recap" />
            {shareError && (
              <p role="status" className="notice">
                {shareError}
              </p>
            )}
            {snapshot && hasActivity && !previewOnly && <OnchainActions snapshot={snapshot} />}
          </div>
        </section>
      )}
      {data && <p className="timeline-note">{data.coverage}</p>}
      <CopyToast count={copyCount} />
    </main>
  );
}
