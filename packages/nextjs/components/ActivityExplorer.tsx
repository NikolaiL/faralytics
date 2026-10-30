"use client";
import { sdk } from "@farcaster/miniapp-sdk";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { Activity, Day } from "~~/lib/activity";
import {
  activityShareText,
  comparisonShareText,
  accountName,
  activityDate,
  dateKey,
  periodLabel,
  PURPLES,
  sharePath,
  utcDate,
} from "~~/lib/activity";
import { LOGO_PIXELS } from "~~/lib/brand";
import { BrandChart } from "./BrandChart";
import { AvatarImage } from "./AvatarImage";
import { ComparisonChart } from "./ComparisonChart";
import { Heatmap } from "./Heatmap";
import { AccountSearch } from "./AccountSearch";
import { useMiniapp } from "./MiniappProvider";
import { AddMiniappButton } from "./AddMiniappButton";

const OnchainActions = dynamic(() => import("./OnchainActions"), { ssr: false });

function Mark() {
  return (
    <span className="mark" aria-hidden="true">
      {LOGO_PIXELS.map(([x, y, level], i) => (
        <i key={i} style={{ gridColumn: x + 1, gridRow: y + 1, background: PURPLES[level] }} />
      ))}
    </span>
  );
}
function ShareActions({
  disabled,
  onShare,
  placement,
}: {
  disabled: boolean;
  onShare: (target: "farcaster" | "x" | "copy") => void;
  placement: "header" | "below";
}) {
  return (
    <div
      className={`share-actions ${placement === "below" ? "share-actions-below" : ""}`}
      role="group"
      aria-labelledby={`share-heading-${placement}`}
    >
      <p id={`share-heading-${placement}`}>a year worth sharing:</p>
      <div className="share-buttons">
        <button
          data-testid={placement === "header" ? "share-farcaster" : "share-farcaster-bottom"}
          aria-label="Share on Farcaster"
          disabled={disabled}
          className="button-primary"
          onClick={() => void onShare("farcaster")}
        >
          <span className="share-label-full">Share on Farcaster</span>
          <span className="share-label-short">FC</span>
        </button>
        <button
          data-testid={placement === "header" ? "share-x" : "share-x-bottom"}
          aria-label="Share on X"
          disabled={disabled}
          onClick={() => void onShare("x")}
        >
          <span className="share-label-full">Share on X</span>
          <span className="share-label-short">X</span>
        </button>
        <button
          data-testid={placement === "header" ? "copy-link" : "copy-link-bottom"}
          disabled={disabled}
          aria-label="Copy link"
          onClick={() => void onShare("copy")}
        >
          <span className="share-label-full">Copy link</span>
          <svg
            className="share-copy-icon"
            aria-hidden="true"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function ActivityExplorer({
  initialData,
  initialUser,
  initialPeriod = "365",
  initialEnd,
  initialComparison,
  initialCompareUser,
}: {
  initialData?: Activity;
  initialUser?: string;
  initialPeriod?: string;
  initialEnd?: string;
  initialComparison?: Activity;
  initialCompareUser?: string;
}) {
  const { fid, isMiniApp } = useMiniapp();
  const [input, setInput] = useState(
    initialData?.profile.username ? `@${initialData.profile.username}` : initialUser || "",
  );
  const [data, setData] = useState<Activity | undefined>(initialData);
  const [comparison, setComparison] = useState<Activity | undefined>(initialComparison);
  const [compareInput, setCompareInput] = useState(
    initialComparison
      ? initialComparison.profile.username
        ? `@${initialComparison.profile.username}`
        : initialComparison.profile.fid
      : initialCompareUser || "",
  );
  const [compareOpen, setCompareOpen] = useState(!!initialComparison || !!initialCompareUser);
  const [compareBusy, setCompareBusy] = useState(false);
  const [compareError, setCompareError] = useState("");
  const compareController = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(!initialData && !!initialUser);
  const [period, setPeriod] = useState(initialData?.period || initialPeriod);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [hasMeaningfulInteraction, setHasMeaningfulInteraction] = useState(false);
  const [day, setDay] = useState<Day>();
  const controller = useRef<AbortController | null>(null);
  const chart = useRef<HTMLDivElement>(null);
  const selfLoaded = useRef(false);

  function updateURL(first: Activity, second?: Activity) {
    const params = new URLSearchParams({ user: first.profile.fid, period: first.period, end: first.anchor });
    if (second) params.set("compare", second.profile.fid);
    window.history.replaceState(null, "", `/?${params}`);
  }
  async function fetchActivity(
    user: string,
    selectedPeriod: string,
    end: string,
    signal: AbortSignal,
  ): Promise<Activity> {
    const params = new URLSearchParams({ user, period: selectedPeriod, end });
    const response = await fetch(`/api/activity?${params}`, { signal });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Could not load activity.");
    return body as Activity;
  }
  async function load(
    user: string,
    selectedPeriod: string,
    end?: string,
    interactive = true,
    compareUser = comparison?.profile.fid,
  ) {
    controller.current?.abort();
    compareController.current?.abort();
    setCompareBusy(false);
    setCompareError("");
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    setNote("");
    setPeriod(selectedPeriod);
    try {
      const anchor = end || dateKey(new Date());
      const [next, partner] = await Promise.all([
        fetchActivity(user, selectedPeriod, anchor, abort.signal),
        compareUser ? fetchActivity(compareUser, selectedPeriod, anchor, abort.signal) : Promise.resolve(undefined),
      ]);
      if (abort.signal.aborted) return;
      if (partner?.profile.fid === next.profile.fid) throw new Error("Choose two different accounts to compare.");
      setComparison(partner);
      if (partner) {
        setCompareInput(partner.profile.username ? `@${partner.profile.username}` : partner.profile.fid);
        setCompareOpen(true);
      }
      setData(next);
      if (interactive) setHasMeaningfulInteraction(true);
      setDay(undefined);
      setInput(next.profile.username ? `@${next.profile.username}` : next.profile.fid);
      updateURL(next, partner);
    } catch (cause) {
      if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load activity.");
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    if (!initialData && initialUser) void load(initialUser, initialPeriod, initialEnd, false, initialCompareUser);
    return () => {
      controller.current?.abort();
      compareController.current?.abort();
    };
    // Initial URL is consumed once; later changes come from the form and year controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (fid && !selfLoaded.current && !initialData && !initialUser) {
      selfLoaded.current = true;
      void load(fid, "365", undefined, false);
    }
    // Only a newly discovered host FID should trigger automatic lookup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fid, initialData, initialUser]);
  useEffect(() => {
    if (chart.current && data?.period === "365") chart.current.scrollLeft = chart.current.scrollWidth;
  }, [data]);

  async function loadComparison(user: string) {
    if (!data || busy) return;
    compareController.current?.abort();
    const abort = new AbortController();
    compareController.current = abort;
    setCompareBusy(true);
    setCompareError("");
    setNote("");
    try {
      const next = await fetchActivity(user, data.period, data.anchor, abort.signal);
      if (abort.signal.aborted) return;
      if (next.profile.fid === data.profile.fid) throw new Error("Choose a different account to compare.");
      setComparison(next);
      setCompareInput(next.profile.username ? `@${next.profile.username}` : next.profile.fid);
      setHasMeaningfulInteraction(true);
      updateURL(data, next);
    } catch (cause) {
      if (!abort.signal.aborted)
        setCompareError(cause instanceof Error ? cause.message : "Could not compare accounts.");
    } finally {
      if (!abort.signal.aborted) setCompareBusy(false);
    }
  }
  function removeComparison() {
    controller.current?.abort();
    setBusy(false);
    setPeriod(data?.period || "365");
    setError("");
    compareController.current?.abort();
    setComparison(undefined);
    setCompareInput("");
    setCompareBusy(false);
    setCompareError("");
    setNote("");
    if (data) updateURL(data);
  }

  function resetLookup() {
    removeComparison();
    setCompareOpen(false);
    controller.current?.abort();
    controller.current = null;
    selfLoaded.current = true;
    setInput("");
    setData(undefined);
    setBusy(false);
    setPeriod("365");
    setError("");
    setNote("");
    setDay(undefined);
    window.history.replaceState(null, "", "/");
  }

  async function share(target: "farcaster" | "x" | "copy") {
    const origin = process.env.NEXT_PUBLIC_URL || window.location.origin;
    const timestamp = Date.now().toString();
    const url = new URL(
      data
        ? sharePath(data.profile.fid, data.period, data.anchor, timestamp, comparison?.profile.fid)
        : `/?ts=${timestamp}`,
      origin,
    ).toString();
    const text = data
      ? comparison
        ? comparisonShareText(data, comparison)
        : activityShareText(data, fid)
      : "Your year. One square at a time. Look up your Farcaster activity with Faralytics.\n\nHow about you?";
    const credit = "faralytics - created by @nikolaii.eth with @viniapp";
    if (target === "copy") {
      try {
        await navigator.clipboard.writeText(url);
        setNote(data ? "Chart link copied." : "App link copied.");
        setHasMeaningfulInteraction(true);
      } catch {
        setNote(`Copy this ${data ? "chart" : "app"} link: ${url}`);
      }
      return;
    }
    if (target === "farcaster" && isMiniApp) {
      try {
        const result = await sdk.actions.composeCast({ text: `${text}\n\n${credit}`, embeds: [url] });
        if (result.cast) setHasMeaningfulInteraction(true);
        return;
      } catch {
        setNote("Could not open the in-app composer. Opening the web composer.");
      }
    }
    const compose = new URL(target === "x" ? "https://x.com/intent/post" : "https://farcaster.xyz/~/compose");
    compose.searchParams.set("text", `${text}\n\n${credit}`);
    compose.searchParams.set(target === "x" ? "url" : "embeds[]", url);
    window.open(compose.toString(), "_blank", "noopener,noreferrer");
  }
  const username = data?.profile.username;
  const isResolved =
    !!data && [data.profile.fid, username?.toLowerCase()].includes(input.trim().replace(/^@/, "").toLowerCase());
  const years = [...new Set([...(data?.years || [new Date().getUTCFullYear()]), ...(comparison?.years || [])])].sort(
    (a, b) => b - a,
  );
  const imageParams = data
    ? new URLSearchParams({
        fid: data.profile.fid,
        period: data.period,
        end: data.anchor,
        ...(comparison ? { compare: comparison.profile.fid } : {}),
      }).toString()
    : "";
  return (
    <main>
      <header className="topbar">
        <Link className="wordmark" href="/">
          <Mark />
          faralytics<span className="wordmark-dot">.</span>
        </Link>
        <ShareActions disabled={!!data && (busy || compareBusy || !!error)} onShare={share} placement="header" />
      </header>
      <section className="intro">
        <h1 className="eyebrow">Your year. One square at a time.</h1>
      </section>
      <form
        className="search-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!input.trim() || busy) return;
          void load(input, "365");
        }}
        aria-label="Look up Farcaster activity"
      >
        <AccountSearch
          value={input}
          onChange={setInput}
          onSelect={(fid) => void load(fid, "365")}
          busy={busy}
          resolved={isResolved}
          onReset={resetLookup}
          onShowMe={isMiniApp && fid ? () => void load(fid, "365") : undefined}
        />
        {data && (
          <div className="search-hint">
            <button
              type="button"
              className="compare-toggle"
              data-testid="compare-toggle"
              aria-expanded={compareOpen}
              aria-controls="compare-search"
              disabled={busy}
              onClick={() => {
                if (compareOpen) removeComparison();
                setCompareOpen(!compareOpen);
              }}
            >
              Compare to <span aria-hidden="true">{compareOpen ? "−" : "+"}</span>
            </button>
            {isMiniApp && fid && input.trim() && data && data.profile.fid !== fid && (
              <button
                type="button"
                className="my-activity-button"
                data-testid="my-activity"
                disabled={busy}
                onClick={() => void load(fid, "365")}
              >
                My activity <span aria-hidden="true">↗</span>
              </button>
            )}
          </div>
        )}
      </form>
      {data && compareOpen && (
        <form
          id="compare-search"
          className="compare-search"
          data-testid="compare-search"
          aria-label="Look up a second account"
          onSubmit={(event) => {
            event.preventDefault();
            if (compareInput.trim() && !compareBusy && !busy) void loadComparison(compareInput);
          }}
        >
          <label className="compare-label" htmlFor="compare-input">
            Compare with another Farcaster account
          </label>
          <AccountSearch
            searchId="compare"
            value={compareInput}
            onChange={setCompareInput}
            onSelect={(user) => void loadComparison(user)}
            busy={busy || compareBusy}
            resolved={
              !!comparison &&
              [comparison.profile.fid, comparison.profile.username?.toLowerCase()].includes(
                compareInput.trim().replace(/^@/, "").toLowerCase(),
              )
            }
            onReset={removeComparison}
          />
          {compareError && (
            <div className="error-box" role="alert" data-testid="compare-error">
              {compareError}
            </div>
          )}
        </form>
      )}
      {error && (
        <div role="alert" className="error-box" data-testid="lookup-error">
          {error}{" "}
          {data && (
            <button
              className="text-button"
              onClick={() => {
                setError("");
                setPeriod(data.period);
              }}
            >
              Keep current chart
            </button>
          )}
        </div>
      )}
      {!data && !busy && !error && <BrandChart />}
      {(data || busy) && (
        <section className={`activity-section ${busy ? "is-loading" : ""}`} aria-busy={busy}>
          {!comparison && (
            <div className="profile-heading">
              <div className="identity">
                <div className="avatar" aria-hidden="true">
                  {(username || "fc").slice(0, 2)}
                  <AvatarImage source={data?.profile.pfp_url} size={44} />
                </div>
                <div>
                  <h2 data-testid="profile-name">
                    {data
                      ? data.profile.display_name || (username ? `@${username}` : `FID ${data.profile.fid}`)
                      : "Finding your squares…"}
                  </h2>
                  <span>
                    {data
                      ? `${username ? `@${username} · ` : ""}FID ${data.profile.fid}`
                      : "Reading captured Farcaster activity"}
                  </span>
                </div>
              </div>
              <span className="captured-badge">Captured activity</span>
            </div>
          )}
          <div className="chart-layout">
            <div className="chart-card" data-testid="activity-card">
              {data && comparison ? (
                <ComparisonChart
                  key={`${data.profile.fid}:${comparison.profile.fid}:${data.period}:${data.anchor}`}
                  first={data}
                  second={comparison}
                  onActivate={() => setHasMeaningfulInteraction(true)}
                />
              ) : (
                <>
                  <div className="chart-title">
                    <h3>
                      <strong data-testid="activity-total">{data ? data.total.toLocaleString() : "—"}</strong> actions{" "}
                      <span>in {periodLabel(data?.period || period)}</span>
                    </h3>
                    <span className="utc-label">UTC</span>
                  </div>
                  {data ? (
                    <>
                      <div className="chart-scroll" ref={chart} data-testid="activity-graph">
                        <Heatmap
                          days={data.days}
                          peak={data.peak}
                          onSelect={setDay}
                          onActivate={() => setHasMeaningfulInteraction(true)}
                        />
                      </div>
                      <div className="chart-caption">
                        <span className="day-detail" role="status" aria-live="polite">
                          {day
                            ? `${day.actions.toLocaleString()} actions · ${utcDate(day.date).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`
                            : "Each square is a day. Make it purple."}
                        </span>
                        <div className="legend" aria-label="Activity intensity from less to more">
                          <span>Less</span>
                          {PURPLES.map((color) => (
                            <i key={color} style={{ background: color }} />
                          ))}
                          <span>More</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="chart-skeleton" role="status">
                      Loading activity…
                    </div>
                  )}
                  <div className="stats">
                    <div>
                      <strong>
                        {data?.activeDays.toLocaleString() || "—"}
                        <small>days</small>
                      </strong>
                      <span>Active days</span>
                    </div>
                    <div>
                      <strong>
                        {data?.longestStreak.toLocaleString() || "—"}
                        <small>days</small>
                      </strong>
                      <span>Longest streak</span>
                    </div>
                    <div>
                      <strong className="busiest-total" data-testid="busiest-actions">
                        {data?.peak.toLocaleString() || "—"}
                        <small>actions</small>
                      </strong>
                      <span className="busiest-caption">
                        on busiest day:{" "}
                        <time dateTime={data?.peakDate ?? undefined}>{activityDate(data?.peakDate ?? null)}</time>
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
            <nav className="year-picker" aria-label="Activity year">
              <button
                data-testid="period-365"
                disabled={busy || compareBusy}
                aria-pressed={period === "365"}
                onClick={() => data && void load(data.profile.fid, "365", data.anchor)}
              >
                Last 365 days
              </button>
              {years.map((year) => (
                <button
                  data-testid={`year-${year}`}
                  key={year}
                  disabled={busy || compareBusy}
                  aria-pressed={period === String(year)}
                  onClick={() => data && void load(data.profile.fid, String(year), data.anchor)}
                >
                  {year}
                </button>
              ))}
            </nav>
          </div>
          {data && <ShareActions disabled={busy || compareBusy || !!error} onShare={share} placement="below" />}
          {data && comparison && (
            <p className="comparison-mint-note">NFT minting captures {accountName(data)}’s individual chart.</p>
          )}
          {data && <OnchainActions activity={data} disabled={busy || compareBusy || !!error} />}
          {data && data.total === 0 && (
            <p className="empty-note" data-testid="empty-activity">
              No captured actions in this period. Try another year; missing history can also mean zero recorded
              activity.
            </p>
          )}
          {data && (
            <div className="image-links">
              <span>Download your chart</span>
              <a
                href={`/api/og/farcaster.png?${imageParams}`}
                download="faralytics-farcaster.png"
                target="_blank"
                rel="noreferrer"
              >
                Farcaster · 3:2 ↗
              </a>
              <a href={`/api/og/x.png?${imageParams}`} download="faralytics-x.png" target="_blank" rel="noreferrer">
                X · 2:1 ↗
              </a>
            </div>
          )}
        </section>
      )}
      {note && (
        <p className="notice" data-testid="share-status" role="status">
          {note}
        </p>
      )}
      <details className="data-note">
        <summary>
          What counts as activity? <span aria-hidden="true">＋</span>
        </summary>
        <p>
          All captured signed actions: casts, replies, likes, recasts, follows, removals, profile changes,
          verifications, and other actions in the activity dataset. Each action counts once. Days use UTC; the 365-day
          view includes today. Future dates are dimmed.
        </p>
        <p>
          {data?.coverage || "Historical coverage is incomplete. Older pruned or deleted actions may be unavailable."} A
          blank square means no captured activity, not proof of no activity.
        </p>
        {data && (
          <p>
            {data.catchingUp
              ? "The source is catching up; recent totals may lag. "
              : "The source reports it is caught up. "}
            Chart fetched{" "}
            {new Date(data.updatedAt).toLocaleString("en-GB", {
              timeZone: "UTC",
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            UTC. Counts refresh about every five minutes.
          </p>
        )}
      </details>
      <footer>
        <AddMiniappButton meaningfulInteraction={hasMeaningfulInteraction} />
        <a href="https://viniapp.xyz" target="_blank" rel="noreferrer">
          created with <b>viniapp</b> ↗
        </a>
      </footer>
    </main>
  );
}
