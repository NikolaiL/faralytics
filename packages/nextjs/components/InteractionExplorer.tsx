"use client";

import { sdk } from "@farcaster/miniapp-sdk";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLookupLog } from "~~/hooks/useLookupLog";
import { PURPLES } from "~~/lib/activity";
import { LOGO_PIXELS } from "~~/lib/brand";
import { friendshipPeriods } from "~~/lib/friendship";
import { interactionMetrics, interactionSelection, type InteractionRanking } from "~~/lib/interaction-ranking";
import { AccountSearch } from "./AccountSearch";
import { AddMiniappButton } from "./AddMiniappButton";
import { AppNavigation } from "./AppNavigation";
import { AvatarImage } from "./AvatarImage";
import { useMiniapp } from "./MiniappProvider";
import { NumberText } from "./NumberText";
import { ChartImages } from "./ChartImages";
import { CopyToast } from "./CopyToast";
import { ShareActions } from "./ShareActions";
import { formatShareText, shareCredit, type ShareTarget } from "~~/lib/share-credit";

type RankingFilters = {
  selection: ReturnType<typeof interactionSelection>;
  onSelectionChange: (selection: ReturnType<typeof interactionSelection>) => void;
};

const OnchainActions = dynamic(() => import("./OnchainActions"), { ssr: false });

export function InteractionExplorer({
  initialUser,
  initialSelection,
}: {
  initialUser: string;
  initialSelection: ReturnType<typeof interactionSelection>;
}) {
  const { isMiniApp, fid } = useMiniapp();
  const [draft, setDraft] = useState(initialUser);
  const [selection, setSelection] = useState(initialSelection);
  const [request, setRequest] = useState({ user: initialUser });
  const [meaningful, setMeaningful] = useState(false);
  const { data, busy, error, resetLog } = useInteractionRanking(request);

  function apply(value: string) {
    const user = value.trim();
    setDraft(user);
    if (!user || user !== request.user) resetLog();
    setRequest({ user });
    if (user) setMeaningful(true);
    window.history.replaceState(null, "", user ? `/interactions?${new URLSearchParams({ user })}` : "/interactions");
  }

  const resolved = !!data && draft === request.user;
  return (
    <main className="interactions-page">
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
      <AppNavigation active="friendship" fids={data ? [data.profile.fid] : []} />
      <section className="timeline-intro">
        <Link
          className="text-button timeline-kicker"
          href={data ? `/friendship?first=${data.profile.fid}` : "/friendship"}
        >
          ← Friendship
        </Link>
        <h1>
          Top interactions<span>.</span>
        </h1>
        <p>See who interacts most with a Farcaster account.</p>
      </section>
      <form
        className="search-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && !resolved && draft.trim()) apply(draft);
        }}
      >
        <AccountSearch
          searchId="interaction-account"
          value={resolved && data.profile.username ? `@${data.profile.username}` : draft}
          onChange={setDraft}
          onSelect={apply}
          onReset={() => apply("")}
          onShowMe={isMiniApp && fid ? () => apply(fid) : undefined}
          resolved={resolved}
          profile={resolved ? data.profile : undefined}
          busy={busy}
        />
      </form>
      {!request.user && <p className="empty-note">Look up a username or FID to see their top interactions.</p>}
      {request.user && (
        <InteractionRankingPanel
          data={data}
          busy={busy}
          error={error}
          selection={selection}
          onSelectionChange={setSelection}
        />
      )}
      <footer>
        <AddMiniappButton meaningfulInteraction={meaningful} />
      </footer>
    </main>
  );
}

function useInteractionRanking(request: { user: string }) {
  const [result, setResult] = useState<{ request: typeof request; data?: InteractionRanking; error?: string }>();
  const current = result?.request === request ? result : undefined;
  const data = current?.data;
  const busy = !!request.user && !current;
  const resetLog = useLookupLog(
    data
      ? { tool: "interactions", fids: [data.profile.fid], period: "all", end: new Date().toISOString().slice(0, 10) }
      : null,
  );

  useEffect(() => {
    if (!request.user) return;
    const controller = new AbortController();
    async function lookup() {
      try {
        const response = await fetch(`/api/interactions?${new URLSearchParams({ user: request.user })}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(40000)]),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load interactions.");
        if (!controller.signal.aborted) setResult({ request, data: body });
      } catch (error) {
        if (!controller.signal.aborted)
          setResult({ request, error: error instanceof Error ? error.message : "Could not load interactions." });
      }
    }
    void lookup();
    return () => controller.abort();
  }, [request]);

  return { data, busy, error: current?.error, resetLog };
}

export function EmbeddedInteractionRanking({
  user,
  side,
  onSelect,
  shareSlot,
  ...filters
}: RankingFilters & {
  user: string;
  side: "first" | "second";
  onSelect: (fid: string) => void;
  shareSlot: HTMLDivElement | null;
}) {
  const [request] = useState({ user });
  const { data, busy, error } = useInteractionRanking(request);
  return (
    <div className="embedded-interactions">
      <h2>Top interactions</h2>
      <InteractionRankingPanel
        data={data}
        busy={busy}
        error={error}
        side={side}
        onSelect={onSelect}
        shareSlot={shareSlot}
        {...filters}
      />
    </div>
  );
}

function InteractionRankingPanel({
  data,
  busy,
  error,
  side,
  onSelect,
  selection: { period, metric },
  onSelectionChange,
  shareSlot,
}: RankingFilters & {
  data?: InteractionRanking;
  busy: boolean;
  error?: string;
  side?: "first" | "second";
  onSelect?: (fid: string) => void;
  shareSlot?: HTMLDivElement | null;
}) {
  const { isMiniApp, fid } = useMiniapp();
  const [copyCount, setCopyCount] = useState(0);
  const [shareError, setShareError] = useState("");
  const params = new URLSearchParams({ user: data?.profile.fid ?? "", period, metric });

  async function share(target: ShareTarget) {
    if (!data) return;
    setShareError("");
    const shareParams = new URLSearchParams(params);
    shareParams.set("ts", Date.now().toString());
    const url = new URL(
      `/interactions?${shareParams}`,
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
    const name = data.profile.username ? `@${data.profile.username}` : `FID ${data.profile.fid}`;
    const label = friendshipPeriods.find(([key]) => key === period)?.[1];
    const ownFarcasterShare = target === "farcaster" && isMiniApp && fid === data.profile.fid;
    const mentions = ownFarcasterShare
      ? data.rankings[period][metric].slice(0, 5).flatMap((row) => {
          const username = data.profiles.find((profile) => profile.fid === row.fid)?.username;
          return username ? [`@${username}`] : [];
        })
      : [];
    const heading = ownFarcasterShare ? "My top Farcaster interactions" : `Top Farcaster interactions for ${name}`;
    const tags = mentions.length ? `\n\n${mentions.join(" ")}` : "";
    const text = formatShareText(
      `${heading} · ${label} · ranked by ${interactionMetrics[metric].toLowerCase()}.${tags}\n\n${shareCredit(target)}`,
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
  return (
    <div className="interaction-ranking-panel">
      {shareSlot &&
        createPortal(
          <ShareActions placement="header" heading="a ranking worth sharing:" disabled={!data} onShare={share} />,
          shareSlot,
        )}
      {busy && (
        <p role="status" className="notice">
          <span className="search-spinner" aria-hidden="true" /> Ranking captured interactions…
        </p>
      )}
      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
      {data && (
        <section className="timeline-feed" aria-label="Top interactions">
          <div className="timeline-toolbar">
            <label className="interaction-filter">
              <span>Period</span>
              <select
                aria-label="Ranking period"
                value={period}
                onChange={(event) => onSelectionChange(interactionSelection(event.target.value, metric))}
              >
                {[...friendshipPeriods].reverse().map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="interaction-filter">
              <span>Rank by</span>
              <select
                aria-label="Rank by"
                value={metric}
                onChange={(event) => onSelectionChange(interactionSelection(period, event.target.value))}
              >
                {Object.entries(interactionMetrics).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {data.rankings[period][metric].length ? (
            <ol className="interaction-ranking">
              {data.rankings[period][metric].map((row, index) => {
                const profile = data.profiles.find((profile) => profile.fid === row.fid);
                const name = profile?.username ? `@${profile.username}` : `FID ${row.fid}`;
                return (
                  <li key={row.fid}>
                    <span className="interaction-rank">
                      <NumberText>{String(index + 1)}</NumberText>
                    </span>
                    <Link
                      className="timeline-account"
                      href={
                        side === "second"
                          ? `/friendship?first=${row.fid}&second=${data.profile.fid}`
                          : `/friendship?first=${data.profile.fid}&second=${row.fid}`
                      }
                      onClick={(event) => {
                        if (!onSelect || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                        event.preventDefault();
                        onSelect(row.fid);
                      }}
                    >
                      <span className="result-avatar timeline-avatar" aria-hidden="true">
                        {(profile?.username || "fc").slice(0, 2)}
                        <AvatarImage source={profile?.pfp_url} size={40} />
                      </span>
                      <span>
                        {name}
                        <small>
                          <NumberText>{`${row.sent.toLocaleString("en-US")} sent · ${row.received.toLocaleString("en-US")} received`}</NumberText>
                        </small>
                      </span>
                    </Link>
                    <strong title={`Interactions · ${interactionMetrics[metric]}`}>
                      <NumberText>{row[metric].toLocaleString("en-US")}</NumberText>
                    </strong>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="timeline-empty">No captured interactions for this period and ranking.</p>
          )}
        </section>
      )}
      {data && (
        <>
          <CopyToast count={copyCount} />
          <ShareActions placement="below" heading="a ranking worth sharing:" disabled={false} onShare={share} />
          {shareError && (
            <p className="notice" role="status">
              {shareError}
            </p>
          )}
          <OnchainActions snapshot={{ kind: "interactions", user: data.profile.fid, period, metric }} />
          <ChartImages
            basePath="/api/og/interactions"
            params={params.toString()}
            filename="faralytics-top-interactions"
            label="Preview share image"
            previewOnly
          />
        </>
      )}
      <p className="timeline-note">
        Sent and received are from the selected account’s perspective. Mutual uses the smaller of the two counts. Counts
        cover captured likes, recasts, removals, replies, mentions, follows, and unfollows.
      </p>
    </div>
  );
}
