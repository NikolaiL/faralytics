"use client";
import { NumberText } from "./NumberText";
import { useEffect, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useLookupLog } from "~~/hooks/useLookupLog";
import { CopyToast } from "./CopyToast";
import { ChartImages } from "./ChartImages";
import { AccountSearch } from "./AccountSearch";
import { AddMiniappButton } from "./AddMiniappButton";
import { AppNavigation } from "./AppNavigation";
import { AvatarImage } from "./AvatarImage";
import { BrandChart } from "./BrandChart";
import { ShareActions } from "./ShareActions";
import { useMiniapp } from "./MiniappProvider";
import { LOGO_PIXELS } from "~~/lib/brand";
import { PURPLES } from "~~/lib/activity";
import {
  FOLLOWER_COLORS,
  followerDate,
  followerName,
  followersPath,
  followersShareText,
  followerTimestamp,
  type FollowerChartData,
} from "~~/lib/followers";
const FollowerPlot = dynamic(() => import("./FollowerPlot"), {
  ssr: false,
  loading: () => <div className="followers-no-history">Loading chart…</div>,
});

export function FollowersExplorer({
  initialData,
  initialError = "",
  initialEnd,
}: {
  initialData?: FollowerChartData;
  initialError?: string;
  initialEnd?: string;
}) {
  const { fid, isMiniApp } = useMiniapp();
  const [data, setData] = useState(initialData);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [note, setNote] = useState("");
  const [copyCount, setCopyCount] = useState(0);
  const [hidden, setHidden] = useState<string[]>([]);
  const [meaningful, setMeaningful] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const selfLoaded = useRef(false);
  const ids = data?.series.map((s) => s.profile.fid) || [];
  const resetLogSession = useLookupLog(
    data && !busy ? { tool: "followers", fids: ids, period: "all", end: data.anchor } : null,
  );
  async function load({ accounts, user }: { accounts?: string[]; user?: string }, interactive = true) {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    setNote("");
    const params = new URLSearchParams();
    if (accounts?.length) params.set("fids", accounts.join(","));
    if (user !== undefined) params.set("user", user);
    if (data?.anchor || initialEnd) params.set("end", data?.anchor || initialEnd!);
    try {
      const response = await fetch(`/api/followers?${params}`, { signal: abort.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load follower history.");
      if (abort.signal.aborted) return;
      const next = body as FollowerChartData;
      if (user && data?.series.length === next.series.length) setNote("That account is already on this chart.");
      setData(next);
      setInput("");
      setHidden([]);
      if (interactive) setMeaningful(true);
      window.history.replaceState(null, "", followersPath(next));
    } catch (cause) {
      if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load follower history.");
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (isMiniApp && fid && !selfLoaded.current && !initialData && !initialError) {
      selfLoaded.current = true;
      void load({ user: fid }, false);
    }
    // Host discovery loads the viewer once; selected accounts remain user-controlled afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMiniApp, fid, initialData, initialError]);
  function reset() {
    resetLogSession();
    controller.current?.abort();
    selfLoaded.current = true;
    setData(undefined);
    setHidden([]);
    setInput("");
    setError("");
    setNote("");
    setBusy(false);
    window.history.replaceState(null, "", "/followers");
  }
  function remove(account: string) {
    const accounts = ids.filter((id) => id !== account);
    if (accounts.length) void load({ accounts });
    else reset();
  }
  async function share(target: "farcaster" | "x" | "copy") {
    const origin = process.env.NEXT_PUBLIC_URL || window.location.origin;
    const ts = Date.now().toString();
    const url = new URL(data ? followersPath(data, ts) : `/followers?ts=${ts}`, origin).toString();
    const text = data
      ? followersShareText(data)
      : "Compare your Farcaster follower history with Faralytics.\n\nfaralytics - created by @nikolaii.eth with @viniapp";
    if (target === "copy") {
      try {
        await navigator.clipboard.writeText(url);
        setNote("");
        setCopyCount((count) => count + 1);
        setMeaningful(true);
      } catch {
        setNote(`Copy this link: ${url}`);
      }
      return;
    }
    if (target === "farcaster" && isMiniApp) {
      try {
        const result = await sdk.actions.composeCast({ text, embeds: [url] });
        if (result.cast) setMeaningful(true);
        return;
      } catch {
        setNote("Opening the web composer.");
      }
    }
    const compose = new URL(target === "x" ? "https://x.com/intent/post" : "https://farcaster.xyz/~/compose");
    compose.searchParams.set("text", text);
    compose.searchParams.set(target === "x" ? "url" : "embeds[]", url);
    window.open(compose.toString(), "_blank", "noopener,noreferrer");
  }
  const imageParams = data ? new URLSearchParams({ fids: ids.join(","), end: data.anchor }).toString() : "";
  return (
    <main className="followers-page">
      <CopyToast count={copyCount} />
      <header className="topbar">
        <Link className="wordmark" href="/">
          <span className="mark" aria-hidden="true">
            {LOGO_PIXELS.map(([x, y, level], i) => (
              <i key={i} style={{ gridColumn: x + 1, gridRow: y + 1, background: PURPLES[level] }} />
            ))}
          </span>
          faralytics<span className="wordmark-dot">.</span>
        </Link>
        <ShareActions disabled={busy} onShare={share} placement="header" />
      </header>
      <AppNavigation active="followers" fids={ids} end={data?.anchor} />
      <section className="intro">
        <h1 className="eyebrow">Every follow. A little history.</h1>
      </section>
      <div className="followers-controls">
        {ids.length < 10 ? (
          <form
            className="search-form"
            aria-label="Add a follower chart account"
            onSubmit={(event) => {
              event.preventDefault();
              if (input.trim() && !busy) void load({ accounts: ids, user: input });
            }}
          >
            <AccountSearch
              searchId="followers"
              value={input}
              onChange={setInput}
              onSelect={(user) => void load({ accounts: ids, user })}
              busy={busy}
              resolved={false}
              onReset={reset}
              onShowMe={
                isMiniApp && fid && !ids.includes(fid) ? () => void load({ accounts: ids, user: fid }) : undefined
              }
            />
          </form>
        ) : (
          <p className="followers-limit">Ten accounts selected. Remove one to add another.</p>
        )}
        <div className="followers-control-buttons">
          {data && (
            <button type="button" className="text-button" data-testid="followers-reset" onClick={reset}>
              Clear chart
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="error-box" role="alert" data-testid="followers-error">
          {error}
        </div>
      )}
      {busy && (
        <p role="status" className="followers-loading">
          Reading captured follower history…
        </p>
      )}
      {!data && !busy && <BrandChart caption="Look up accounts to explore follower history." />}
      {data && (
        <section
          className={`followers-card chart-card ${busy ? "is-loading" : ""}`}
          aria-busy={busy}
          data-testid="followers-card"
        >
          <div className="followers-card-heading">
            <div>
              <h2>
                Follower history{" "}
                <span>
                  <NumberText>{`${data.series.length} ${data.series.length === 1 ? "account" : "accounts"}`}</NumberText>
                </span>
              </h2>
              <p>
                <NumberText>
                  {data.from ? `From ${followerDate(followerTimestamp(data.from))}` : "No captured follow history"}
                </NumberText>{" "}
                · UTC
              </p>
            </div>
            <span className="captured-badge">Captured net actions</span>
          </div>
          <div className="followers-legend" data-testid="followers-legend">
            {data.series.map((series, index) => {
              const account = series.profile.fid,
                muted = hidden.includes(account);
              return (
                <div className={`follower-legend-item ${muted ? "is-muted" : ""}`} key={account}>
                  <button
                    type="button"
                    className="follower-legend-toggle"
                    aria-pressed={!muted}
                    aria-label={`${muted ? "Show" : "Hide"} ${followerName(series)}`}
                    data-testid={`follower-toggle-${account}`}
                    onClick={() => setHidden(muted ? hidden.filter((id) => id !== account) : [...hidden, account])}
                  >
                    <i style={{ background: FOLLOWER_COLORS[index] }} />
                    <span className="result-avatar" aria-hidden="true">
                      {(series.profile.username || "fc").slice(0, 2)}
                      <AvatarImage source={series.profile.pfp_url} size={28} />
                    </span>
                    <span className="follower-legend-name" style={{ color: FOLLOWER_COLORS[index] }}>
                      <strong>{followerName(series)}</strong>
                      <span>
                        <NumberText>
                          {series.followers === null
                            ? "Current count unavailable"
                            : `${series.followers.toLocaleString("en-US")} current captured followers`}
                        </NumberText>
                      </span>
                    </span>
                  </button>
                  <button
                    className="follower-remove"
                    type="button"
                    aria-label={`Remove ${followerName(series)}`}
                    data-testid={`follower-remove-${account}`}
                    disabled={busy}
                    onClick={() => remove(account)}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
          <FollowerPlot data={data} hidden={hidden} />
          <p className="followers-chart-note">
            Captured follows minus unfollows. The curve can differ from current follower counts.
          </p>
        </section>
      )}
      {data && (
        <>
          <ShareActions disabled={busy} onShare={share} placement="below" />
          <ChartImages
            basePath="/api/og/followers"
            params={imageParams.toString()}
            filename="faralytics-followers"
            label="Download follower chart"
          />
        </>
      )}
      {note && (
        <p className="notice" role="status" data-testid="followers-status">
          {note}
        </p>
      )}
      <details className="data-note">
        <summary>
          What does this curve show? <span aria-hidden="true">＋</span>
        </summary>
        <p>
          These are cumulative captured follow actions minus captured unfollow actions, downsampled to up to{" "}
          <NumberText>1,000</NumberText>
          points per account. Every line uses the same dates and scale, starting at the earliest captured follow among
          the selected accounts. Hover or use the keyboard for the nearest sampled values.
        </p>
        <p>
          Current captured follower counts in the legend include current-state information that this action curve can
          omit, including compact snapshots. Older pruned or deleted actions may be unavailable, and source sync can
          lag. The curve is not a complete historical follower count.
        </p>
        {data && (
          <p>
            Chart captured <NumberText>{data.updatedAt.replace("T", " ").slice(0, 19)}</NumberText> UTC. Counts and
            curves refresh about every five minutes. Shared images always include all selected accounts; hiding a line
            only changes this web view.
          </p>
        )}
      </details>
      <footer>
        <AddMiniappButton meaningfulInteraction={meaningful} />
        <a href="https://viniapp.xyz" target="_blank" rel="noreferrer">
          created with <b>viniapp</b> ↗
        </a>
      </footer>
    </main>
  );
}
