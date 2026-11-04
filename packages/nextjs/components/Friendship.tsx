"use client";

import { sdk } from "@farcaster/miniapp-sdk";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PURPLES, type Profile } from "~~/lib/activity";
import { relativeEventTime } from "~~/lib/follow-timeline";
import { LOGO_PIXELS } from "~~/lib/brand";
import { friendshipLabels, friendshipPeriods, type FriendshipCounts, type FriendshipPage } from "~~/lib/friendship";
import { AccountSearch } from "./AccountSearch";
import { AddMiniappButton } from "./AddMiniappButton";
import { AppNavigation } from "./AppNavigation";
import { AvatarImage } from "./AvatarImage";
import { useMiniapp } from "./MiniappProvider";
import { NumberText } from "./NumberText";
import { ShareActions } from "./ShareActions";
import { ChartImages } from "./ChartImages";
import { CopyToast } from "./CopyToast";
import { formatShareText, shareCredit, type ShareTarget } from "~~/lib/share-credit";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const name = (profile: Profile) => (profile.username ? `@${profile.username}` : `FID ${profile.fid}`);

function Account({ profile, trailing = false }: { profile: Profile; trailing?: boolean }) {
  return (
    <a
      className={`timeline-account${trailing ? " is-target" : ""}`}
      href={`https://farcaster.xyz/~/profiles/${profile.fid}`}
      target="_blank"
      rel="noreferrer"
    >
      <span className="result-avatar timeline-avatar" aria-hidden="true">
        {(profile.username || "fc").slice(0, 2)}
        <AvatarImage source={profile.pfp_url} size={40} />
      </span>
      <span>{name(profile)}</span>
    </a>
  );
}

function FriendshipResults({ first, second, ts }: { first: string; second: string; ts: string }) {
  const { isMiniApp } = useMiniapp();
  const [data, setData] = useState<FriendshipPage | null>(null);
  const [request, setRequest] = useState({ before: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shareError, setShareError] = useState("");
  const [copyCount, setCopyCount] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ first, second });
    if (ts) params.set("ts", ts);
    if (request.before) params.set("before", request.before);
    async function load() {
      try {
        const response = await fetch(`/api/friendship?${params}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]),
        });
        const page = (await response.json()) as FriendshipPage & { error?: string };
        if (!response.ok) throw new Error(page.error || "Could not load friendship activity.");
        if (controller.signal.aborted) return;
        setData((previous) =>
          previous && request.before
            ? { ...previous, events: [...previous.events, ...page.events], nextCursor: page.nextCursor }
            : page,
        );
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Could not load friendship activity.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [first, second, ts, request]);

  function loadPage(before: string) {
    setError("");
    setLoading(true);
    setRequest({ before });
  }

  async function share(target: ShareTarget) {
    if (!data) return;
    setShareError("");
    const params = new URLSearchParams({ first, second, ts: ts || Date.now().toString() });
    const url = new URL(`/friendship?${params}`, process.env.NEXT_PUBLIC_URL || window.location.origin).toString();
    if (target === "copy") {
      try {
        await navigator.clipboard.writeText(url);
        setCopyCount((count) => count + 1);
      } catch {
        setShareError(`Copy this link: ${url}`);
      }
      return;
    }
    const text = formatShareText(
      `Explore the Farcaster friendship between ${data.profiles.map(name).join(" and ")}.\n\nHow about you?\n\n${shareCredit(target)}`,
      target,
    );
    if (target === "farcaster" && isMiniApp) {
      try {
        await sdk.actions.composeCast({ text, embeds: [url] });
        return;
      } catch {
        /* Fall back to the web composer if the host bridge fails. */
      }
    }
    const compose = new URL(target === "x" ? "https://x.com/intent/post" : "https://farcaster.xyz/~/compose");
    compose.searchParams.set("text", text);
    compose.searchParams.set(target === "x" ? "url" : "embeds[]", url);
    window.open(compose.toString(), "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <CopyToast count={copyCount} />
      {data && (
        <section className="friendship-summary chart-card" aria-label="Interaction totals">
          <table>
            <thead>
              <tr>
                <th scope="col">Interaction Stats</th>
                {data.profiles.map((profile) => (
                  <th key={profile.fid} scope="col">
                    {name(profile)}
                  </th>
                ))}
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {friendshipPeriods.map(([period, label]) => {
                const [a, b] = data.profiles.map(
                  (profile) => data.counts[profile.fid]?.[period as keyof FriendshipCounts] ?? 0,
                );
                return (
                  <tr key={period}>
                    <th scope="row">
                      <NumberText>{label}</NumberText>
                    </th>
                    {[a, b, a + b].map((count, index) => (
                      <td key={index}>
                        <NumberText>{count.toLocaleString("en-US")}</NumberText>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
      <section className="timeline-feed" aria-label="Friendship timeline" aria-busy={loading}>
        <div className="timeline-toolbar">
          <strong>Interaction timeline</strong>
          <span className="utc-label">UTC</span>
        </div>
        {error && (
          <div className="timeline-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => loadPage(request.before)}>
              Retry
            </button>
          </div>
        )}
        {!data && loading && (
          <div className="timeline-loading" role="status">
            <span className="search-spinner" />
            Loading interactions…
          </div>
        )}
        {data && !data.events.length && (
          <div className="timeline-empty">
            <h2>No captured interactions</h2>
          </div>
        )}
        {data && (
          <ol className="timeline-list" data-testid="friendship-events">
            {data.events.map((event) => {
              const [a, b] = data.profiles;
              const [actor, target] = event.actor === a.fid ? [a, b] : [b, a];
              const date = new Date(event.ts * 1000);
              const castUrl = /^0x[0-9a-f]{40}$/i.test(event.castHash)
                ? `https://farcaster.xyz/~/conversations/${event.castHash}`
                : undefined;
              const CastLink = castUrl ? "a" : "span";
              const castLinkProps = castUrl
                ? {
                    href: castUrl,
                    target: "_blank",
                    rel: "noreferrer",
                    onClick: (click: React.MouseEvent) => {
                      if (!isMiniApp) return;
                      click.preventDefault();
                      void sdk.actions
                        .viewCast({ hash: event.castHash })
                        .catch(() => sdk.actions.openUrl(castUrl))
                        .catch(() => {});
                    },
                  }
                : {};
              return (
                <li className={`timeline-row is-${event.action}`} key={`${event.ts}:${event.hash}`}>
                  <div className="timeline-sentence">
                    <Account profile={actor} />
                    <CastLink className="timeline-verb" {...castLinkProps}>
                      {friendshipLabels[event.action]}
                    </CastLink>
                    <Account profile={target} trailing />
                  </div>
                  <CastLink className="friendship-time" {...castLinkProps}>
                    <time dateTime={date.toISOString()} title={`${dateFormat.format(date)} UTC`}>
                      <NumberText>{relativeEventTime(date.toISOString(), now)}</NumberText>
                    </time>
                  </CastLink>
                </li>
              );
            })}
          </ol>
        )}
        {data?.nextCursor && (
          <div className="timeline-more">
            <button type="button" disabled={loading} onClick={() => loadPage(data.nextCursor!)}>
              {loading ? "Loading…" : "Load older"}
            </button>
          </div>
        )}
      </section>
      {data && (
        <>
          <ShareActions placement="below" heading="a friendship worth sharing:" disabled={false} onShare={share} />
          {shareError && (
            <p className="notice" role="status">
              {shareError}
            </p>
          )}
          <ChartImages
            basePath="/api/og/friendship"
            params={new URLSearchParams({ first, second, ...(ts ? { ts } : {}) }).toString()}
            filename="faralytics-friendship"
            label="Preview share image"
            previewOnly
          />
        </>
      )}
      <p className="timeline-note">Counts reflect captured interactions. Historical coverage may be incomplete.</p>
    </>
  );
}

function useSelectedProfile(input: string, attempt: number) {
  const [result, setResult] = useState<{ input: string; profile?: Profile; error?: string }>();
  useEffect(() => {
    if (!input) return;
    const controller = new AbortController();
    async function lookup() {
      try {
        const response = await fetch(`/api/search?${new URLSearchParams({ q: input, exact: "1" })}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not look up this account.");
        if (!controller.signal.aborted) setResult({ input, profile: body[0] });
      } catch (error) {
        if (!controller.signal.aborted) {
          setResult({ input, error: error instanceof Error ? error.message : "Could not look up this account." });
        }
      }
    }
    void lookup();
    return () => controller.abort();
  }, [input, attempt]);
  return result?.input === input ? result : undefined;
}

export function Friendship({
  initialFirst,
  initialSecond,
  initialTs,
}: {
  initialFirst: string;
  initialSecond: string;
  initialTs: string;
}) {
  const { isMiniApp, fid } = useMiniapp();
  const [ts, setTs] = useState(initialTs);
  const [meaningful, setMeaningful] = useState(false);
  const [selected, setSelected] = useState({ first: initialFirst, second: initialSecond });
  const [draft, setDraft] = useState(selected);
  const [attempt, setAttempt] = useState({ first: 0, second: 0 });
  const first = useSelectedProfile(selected.first, attempt.first);
  const second = useSelectedProfile(selected.second, attempt.second);
  function apply(field: "first" | "second", value: string) {
    const next = { ...selected, [field]: value.trim() };
    setDraft((previous) => ({ ...previous, [field]: next[field] }));
    setSelected(next);
    setTs("");
    if (next[field] === selected[field]) {
      setAttempt((previous) => ({ ...previous, [field]: previous[field] + 1 }));
    }
    setMeaningful(true);
    const params = new URLSearchParams();
    if (next.first) params.set("first", next.first);
    if (next.second) params.set("second", next.second);
    window.history.replaceState(null, "", `/friendship${params.size ? `?${params}` : ""}`);
  }
  return (
    <main className="friendship-page">
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
      <AppNavigation active="friendship" />
      <section className="timeline-intro">
        <span className="eyebrow">Farcaster analytics</span>
        <h1>
          Friendship<span>.</span>
        </h1>
        <p>See how two accounts have interacted on Farcaster.</p>
      </section>
      <div className="timeline-filters">
        {(["first", "second"] as const).map((field, index) => {
          const label = `Account ${index + 1}`;
          const searchId = `friendship-${field}`;
          const lookup = field === "first" ? first : second;
          const committed = !!selected[field] && draft[field] === selected[field];
          const profile = committed ? lookup?.profile : undefined;
          const value = profile?.username ? name(profile) : draft[field];
          return (
            <form
              key={field}
              className="search-form"
              aria-label={label}
              onSubmit={(event) => {
                event.preventDefault();
                if (!profile && draft[field].trim()) apply(field, draft[field]);
              }}
            >
              <div className="timeline-filter-label">
                <label htmlFor={`${searchId}-input`}>{label}</label>
              </div>
              <AccountSearch
                searchId={searchId}
                label={`${label} username or FID`}
                value={value}
                busy={committed && !lookup}
                resolved={!!profile}
                profile={profile}
                onChange={(value) => setDraft((previous) => ({ ...previous, [field]: value }))}
                onSelect={(value) => apply(field, value)}
                onReset={() => apply(field, "")}
                onShowMe={isMiniApp && fid ? () => apply(field, fid) : undefined}
              />
              {committed && lookup?.error && (
                <p className="timeline-note" role="alert">
                  {lookup.error}
                </p>
              )}
            </form>
          );
        })}
      </div>
      {first?.profile && second?.profile ? (
        <FriendshipResults
          key={JSON.stringify([first.profile.fid, second.profile.fid, ts])}
          first={first.profile.fid}
          second={second.profile.fid}
          ts={ts}
        />
      ) : (
        <p className="empty-note">Choose two accounts to see their interactions.</p>
      )}
      <footer>
        <AddMiniappButton meaningfulInteraction={meaningful} />
        <a href="https://viniapp.xyz" target="_blank" rel="noreferrer">
          created with <b>viniapp</b> ↗
        </a>
      </footer>
    </main>
  );
}
