"use client";
import { sdk } from "@farcaster/miniapp-sdk";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppNavigation } from "./AppNavigation";
import { CopyToast } from "./CopyToast";
import { useMiniapp } from "./MiniappProvider";
import { ShareActions } from "./ShareActions";
import { TopCasterList } from "./TopCasterList";
import { PURPLES } from "~~/lib/activity";
import { LOGO_PIXELS } from "~~/lib/brand";
import {
  casterMetrics,
  casterPath,
  casterPeriods,
  casterShareText,
  type CasterMetric,
  type CasterPeriod,
  type CasterSelection,
  type TopCasters,
} from "~~/lib/top-casters";
import type { ShareTarget } from "~~/lib/share-credit";

export function TopCastersExplorer({
  selection: initial,
  initialData,
  initialError,
}: {
  selection: CasterSelection;
  initialData?: TopCasters;
  initialError?: string;
}) {
  const { fid, isMiniApp, ready } = useMiniapp();
  const [selection, setSelection] = useState(initial);
  const [result, setResult] = useState<{ key: string; data?: TopCasters; error?: string }>({
    key: JSON.stringify(initial),
    data: initialData,
    error: initialError,
  });
  const [retry, setRetry] = useState(0);
  const [copyCount, setCopyCount] = useState(0);
  const [shareError, setShareError] = useState("");
  const viewer = initial.user || (ready ? fid : undefined);
  const current = { ...selection, user: viewer };
  const key = JSON.stringify(current);
  const data = result.key === key ? result.data : undefined;
  const error = result.key === key ? result.error : undefined;
  const busy = !data && !error;

  useEffect(() => {
    const parsed: CasterSelection = JSON.parse(key);
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/top-casters?${casterPath(parsed).split("?")[1]}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load Top Casters.");
        if (!controller.signal.aborted) setResult({ key, data: body });
      } catch (error) {
        if (!controller.signal.aborted)
          setResult({ key, error: error instanceof Error ? error.message : "Could not load Top Casters." });
      }
    })();
    return () => controller.abort();
  }, [key, retry]);

  function change(period: CasterPeriod) {
    const next = { ...current, period };
    setSelection(next);
    window.history.replaceState(null, "", casterPath(next));
  }

  async function handleShare(metric: CasterMetric, target: ShareTarget, timestamp: number) {
    if (!data) return;
    setShareError("");
    const url = new URL(
      casterPath({ ...current, metric }, String(timestamp)),
      process.env.NEXT_PUBLIC_URL || window.location.origin,
    ).toString();
    try {
      if (target === "copy") {
        await navigator.clipboard.writeText(url);
        setCopyCount((count) => count + 1);
        return;
      }
      const text = casterShareText({ ...current, metric }, data, target, fid);
      if (target === "farcaster" && isMiniApp) {
        try {
          await sdk.actions.composeCast({ text, embeds: [url] });
          return;
        } catch {
          /* Use the web composer when native sharing is unavailable. */
        }
      }
      const compose = new URL(target === "x" ? "https://x.com/intent/post" : "https://farcaster.xyz/~/compose");
      compose.searchParams.set("text", text);
      compose.searchParams.set(target === "x" ? "url" : "embeds[]", url);
      window.open(compose.toString(), "_blank", "noopener,noreferrer");
    } catch {
      setShareError(`Could not share. Copy this link: ${url}`);
    }
  }

  return (
    <main className="top-casters-page">
      <header className="topbar">
        <Link className="wordmark" href="/">
          <span className="mark" aria-hidden="true">
            {LOGO_PIXELS.map(([x, y, level], i) => (
              <i key={i} style={{ gridColumn: x + 1, gridRow: y + 1, background: PURPLES[level] }} />
            ))}
          </span>
          faralytics<span className="wordmark-dot">.</span>
        </Link>
      </header>
      <AppNavigation active="top-casters" />
      <section className="timeline-intro">
        <h1>
          Top casters<span>.</span>
        </h1>
        <p>The people behind the captured Farcaster activity.</p>
      </section>
      <div className="caster-controls">
        <label className="interaction-filter">
          <span>Timeframe · UTC</span>
          <select
            aria-label="Caster timeframe"
            data-testid="caster-timeframe"
            value={current.period}
            onChange={(event) => change(event.target.value as CasterPeriod)}
          >
            {Object.entries(casterPeriods).map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {current.metric && (
          <button
            className="text-button"
            onClick={() => {
              const next = { ...current, metric: undefined };
              setSelection(next);
              window.history.replaceState(null, "", casterPath(next));
            }}
          >
            Show all categories
          </button>
        )}
      </div>
      {busy && (
        <p role="status" className="notice">
          <span className="search-spinner" aria-hidden="true" /> Ranking captured activity…
        </p>
      )}
      {error && (
        <div role="alert" className="error-box">
          {error}{" "}
          <button
            className="button-primary"
            onClick={() => {
              setResult({ key });
              setRetry((count) => count + 1);
            }}
          >
            Try again
          </button>
        </div>
      )}
      {data && (
        <>
          <p className="timeline-note">
            {data.start} – {data.through} UTC · {data.partialDay ? "Includes today’s partial UTC day. " : ""}Summary
            refreshed {data.updatedAt} UTC.{data.checkedAt ? ` Source checked ${data.checkedAt} UTC.` : ""}
            {data.catchingUp ? " Source is catching up." : ""}
          </p>
          <p className="timeline-note">
            Casts exclude replies. Positive captured actions count even if later undone. Mentions use corrected tags.
            Received actions include responses to older posts and exclude self-actions. Equal counts are ordered by FID.{" "}
            {data.coverage}
          </p>
          <div className="caster-grid" data-testid="top-casters-lists">
            {data.lists
              .filter((list) => !current.metric || list.metric === current.metric)
              .map((list) => (
                <TopCasterList key={list.metric} list={list} profiles={data.profiles} user={viewer}>
                  <ShareActions
                    placement="below"
                    heading={`share ${casterMetrics[list.metric].toLowerCase()}:`}
                    disabled={false}
                    onShare={(target) => void handleShare(list.metric, target, Date.now())}
                  />
                </TopCasterList>
              ))}
          </div>
        </>
      )}
      {shareError && (
        <p className="error-box" role="alert">
          {shareError}
        </p>
      )}
      <CopyToast count={copyCount} />
    </main>
  );
}
