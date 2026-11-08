"use client";

import { sdk } from "@farcaster/miniapp-sdk";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLookupLog } from "~~/hooks/useLookupLog";
import { PURPLES } from "~~/lib/activity";
import { LOGO_PIXELS } from "~~/lib/brand";
import { formatShareText, shareCredit, type ShareTarget } from "~~/lib/share-credit";
import { cloudHeight, cloudWidth } from "~~/lib/word-cloud-layout";
import {
  globalWordCloudPeriods,
  wordCloudPath,
  wordCloudPeriods,
  wordCloudRange,
  wordCloudSelection,
  type GlobalWordCloudData,
  type GlobalWordCloudPeriod,
  type WordCloudData,
  type WordCloudPeriod,
  type WordCloudSelection,
} from "~~/lib/word-cloud";
import { AccountSearch } from "./AccountSearch";
import { AddMiniappButton } from "./AddMiniappButton";
import { AppNavigation } from "./AppNavigation";
import { ChartImages } from "./ChartImages";
import { CopyToast } from "./CopyToast";
import { useMiniapp } from "./MiniappProvider";
import { NumberText } from "./NumberText";
import { ShareActions } from "./ShareActions";
import { WordCloudTimeMachine } from "./WordCloudTimeMachine";

const OnchainActions = dynamic(() => import("./OnchainActions"), { ssr: false });

export function WordCloudExplorer({
  initialUser,
  initialSelection,
  initialGlobalPeriod,
}: {
  initialUser: string;
  initialSelection: WordCloudSelection;
  initialGlobalPeriod: GlobalWordCloudPeriod;
}) {
  const { isMiniApp, fid } = useMiniapp();
  const [draft, setDraft] = useState(initialUser);
  const [request, setRequest] = useState({ user: initialUser, ...initialSelection, globalPeriod: initialGlobalPeriod });
  const [result, setResult] = useState<{
    request: typeof request;
    data?: WordCloudData | GlobalWordCloudData;
    error?: string;
  }>();
  const [meaningful, setMeaningful] = useState(false);
  const [copyCount, setCopyCount] = useState(0);
  const [shareError, setShareError] = useState("");
  const [showTimeline, setShowTimeline] = useState(false);
  const [imageError, setImageError] = useState("");
  const current = result?.request === request ? result : undefined;
  const data = current?.data;
  const account = data?.profile;
  const profile = result?.request.user === request.user ? result.data?.profile : undefined;
  const loading = !current;
  const busy = !!request.user && loading;
  const resolved = !!profile && draft === request.user;
  const resetLog = useLookupLog(
    data && account
      ? {
          tool: "word-cloud",
          fids: [account.fid],
          period: data.period,
          end: new Date(Number(data.at) * 1000).toISOString().slice(0, 10),
        }
      : null,
  );

  useEffect(() => {
    const controller = new AbortController();
    async function lookup() {
      try {
        const url = request.user
          ? `/api${wordCloudPath(request.user, { period: request.period, at: request.at })}`
          : `/api/word-cloud?period=${request.globalPeriod}`;
        const response = await fetch(url, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(request.user ? 15000 : 20000)]),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load the word cloud.");
        if (!controller.signal.aborted) setResult({ request, data: body });
      } catch (error) {
        if (!controller.signal.aborted)
          setResult({ request, error: error instanceof Error ? error.message : "Could not load the word cloud." });
      }
    }
    void lookup();
    return () => controller.abort();
  }, [request]);

  function apply(value: string, period = request.period, at?: string) {
    const user = value.trim();
    const selection = wordCloudSelection(period, at);
    if (user !== request.user || !user) resetLog();
    setDraft(user);
    setShowTimeline(false);
    setRequest({ user, ...selection, globalPeriod: request.globalPeriod });
    setShareError("");
    if (user) setMeaningful(true);
    window.history.replaceState(
      null,
      "",
      user ? wordCloudPath(user, selection) : `/word-cloud?period=${request.globalPeriod}`,
    );
  }

  function selectGlobalPeriod(period: GlobalWordCloudPeriod) {
    setRequest({ ...request, globalPeriod: period });
    window.history.replaceState(null, "", `/word-cloud?period=${period}`);
  }

  async function share(target: ShareTarget) {
    if (!data || !account) return;
    setShareError("");
    const url = new URL(
      wordCloudPath(account.fid, { period: data.period, at: data.at }, String(Date.now())),
      process.env.NEXT_PUBLIC_URL || window.location.origin,
    ).toString();
    if (target === "copy") {
      try {
        await navigator.clipboard.writeText(url);
        setCopyCount((count) => count + 1);
      } catch {
        setShareError(`Copy this link: ${url}`);
      }
      return;
    }
    const name = account.username ? `@${account.username}` : `FID ${account.fid}`;
    const subject =
      isMiniApp && fid === account.fid ? "My most-used words on Farcaster" : `Most-used words for ${name}`;
    const text = formatShareText(
      `${subject} · ${wordCloudPeriods[data.period]}.\n\nCheck yours!\n\n${shareCredit(target)}`,
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

  const params = data
    ? new URLSearchParams({ ...(account ? { user: account.fid } : {}), period: data.period, at: data.at }).toString()
    : "";
  const image = `/api/og/word-cloud/cloud.png?${params}`;
  return (
    <main className="word-cloud-page">
      <header className="topbar">
        <Link className="wordmark" href="/">
          <span className="mark" aria-hidden="true">
            {LOGO_PIXELS.map(([x, y, level], i) => (
              <i key={i} style={{ gridColumn: x + 1, gridRow: y + 1, background: PURPLES[level] }} />
            ))}
          </span>
          faralytics<span className="wordmark-dot">.</span>
        </Link>
        <ShareActions
          placement="header"
          heading="a cloud worth sharing:"
          disabled={!account || showTimeline}
          onShare={share}
        />
      </header>
      <AppNavigation active="word-cloud" fids={profile ? [profile.fid] : []} />
      <section className="timeline-intro">
        <h1>
          Word Cloud<span>.</span>
        </h1>
        <p>Explore what Farcaster is talking about, or look up an account’s most-used words.</p>
      </section>
      <form
        className="search-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && !resolved && draft.trim()) apply(draft);
        }}
      >
        <AccountSearch
          searchId="word-cloud-account"
          value={resolved && profile.username ? `@${profile.username}` : draft}
          onChange={setDraft}
          onSelect={apply}
          onReset={() => apply("")}
          onShowMe={isMiniApp && fid ? () => apply(fid) : undefined}
          resolved={resolved}
          profile={resolved ? profile : undefined}
          busy={busy}
        />
      </form>
      <section className="timeline-feed word-cloud-panel" aria-label="Most-used words" aria-busy={loading}>
        <div className="timeline-toolbar">
          {request.user ? (
            <>
              <label className="interaction-filter">
                <span className="word-cloud-period-label">
                  Period <small id="word-cloud-range">{wordCloudRange(request)}</small>
                </span>
                <select
                  aria-label="Word cloud period"
                  aria-describedby="word-cloud-range"
                  value={request.period}
                  onChange={(event) => apply(request.user, event.target.value as WordCloudPeriod, request.at)}
                >
                  {Object.entries(wordCloudPeriods).map(([period, label]) => (
                    <option key={period} value={period}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="word-cloud-time-toggle"
                disabled={!data}
                aria-expanded={showTimeline}
                aria-controls={showTimeline ? "word-cloud-time-machine" : undefined}
                onClick={() => setShowTimeline((value) => !value)}
              >
                {showTimeline ? "Back to snapshot" : "Time Machine"}
              </button>
            </>
          ) : (
            <div className="word-cloud-global-title">
              <h2>Across Farcaster</h2>
              <label className="interaction-filter">
                <span className="word-cloud-period-label">
                  Period <small id="word-cloud-global-range">{data ? wordCloudRange(data) : ""}</small>
                </span>
                <select
                  aria-label="Global word cloud period"
                  aria-describedby="word-cloud-global-range"
                  value={request.globalPeriod}
                  onChange={(event) => selectGlobalPeriod(event.target.value as GlobalWordCloudPeriod)}
                >
                  {globalWordCloudPeriods.map(([period, label]) => (
                    <option key={period} value={period}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
        {loading && (
          <p className="timeline-empty" role="status">
            Counting captured words…
          </p>
        )}
        {current?.error && (
          <p className="timeline-error" role="alert">
            {current.error}{" "}
            <button
              type="button"
              className="text-button"
              onClick={() => apply(request.user, request.period, request.at)}
            >
              Try again
            </button>
          </p>
        )}
        {account && showTimeline && <WordCloudTimeMachine key={account.fid} fid={account.fid} />}
        {data &&
          !showTimeline &&
          (data.words.length ? (
            <>
              {imageError === image ? (
                <p className="timeline-empty" role="status">
                  Could not draw the cloud. Word counts are available below.
                </p>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={image}
                  className="word-cloud-image"
                  src={image}
                  width={cloudWidth}
                  height={cloudHeight}
                  alt="Word cloud sized by frequency. Exact counts are listed below."
                  data-testid="word-cloud-image"
                  onError={() => setImageError(image)}
                />
              )}
              <details className="word-cloud-words">
                <summary>View word counts</summary>
                <ol>
                  {data.words.map(([word, count]) => (
                    <li key={word}>
                      <span>{word}</span>
                      <strong>
                        <NumberText>{count.toLocaleString("en-US")}</NumberText>
                      </strong>
                    </li>
                  ))}
                </ol>
              </details>
            </>
          ) : (
            <p className="timeline-empty">No matching words in this period.</p>
          ))}
        {data && !showTimeline && (
          <p className="timeline-note word-cloud-note">
            <NumberText>{data.casts.toLocaleString("en-US")}</NumberText>
            {" captured casts with text. Common plurals are combined. Older text may be missing."}
          </p>
        )}
      </section>
      {data && account && !showTimeline && (
        <>
          <ShareActions placement="below" heading="a cloud worth sharing:" disabled={false} onShare={share} />
          <CopyToast count={copyCount} />
          {shareError && (
            <p className="notice" role="status">
              {shareError}
            </p>
          )}
          {!!data.words.length && (
            <OnchainActions
              snapshot={{
                kind: "word-cloud",
                user: account.fid,
                period: data.period,
                at: data.at,
              }}
            />
          )}
          <ChartImages
            basePath="/api/og/word-cloud"
            params={params}
            filename="faralytics-word-cloud"
            label="Preview share image"
            previewOnly
          />
        </>
      )}
      <footer>
        <AddMiniappButton meaningfulInteraction={meaningful} />
      </footer>
    </main>
  );
}
