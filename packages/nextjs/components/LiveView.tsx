"use client";
import Link from "next/link";
import NumberFlow from "@number-flow/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AccountSearch } from "./AccountSearch";
import { AppNavigation } from "./AppNavigation";
import { AvatarImage } from "./AvatarImage";
import { TimelineTime } from "./TimelineTime";
import { ShareActions } from "./ShareActions";
import { shareCredit, type ShareTarget } from "~~/lib/share-credit";
import { useMiniapp } from "./MiniappProvider";
import { PURPLES, type Profile } from "~~/lib/activity";
import { LOGO_PIXELS } from "~~/lib/brand";
import {
  liveClockParts,
  liveEventAction,
  liveActionColors,
  liveDirections,
  type LiveDirection,
  liveMetricLabels,
  livePath,
  liveTypes,
  mergeLiveEvents,
  type LiveCounts,
  type LiveData,
  type LiveEvent,
  type LiveType,
} from "~~/lib/live-view";

const name = (profile: Profile) => (profile.username ? `@${profile.username}` : `FID ${profile.fid}`);
const integer = { useGrouping: false };
const twoDigits = { useGrouping: false, minimumIntegerDigits: 2 };
const STALE_AFTER_MS = 3 * 60 * 1000;

export function LiveView({
  initialUser = "",
  initialType = "all",
  initialDirection = "actor",
  initialNow,
}: {
  initialUser?: string;
  initialType?: LiveType;
  initialDirection?: LiveDirection;
  initialNow: string;
}) {
  const { fid, isMiniApp } = useMiniapp();
  const [user, setUser] = useState(initialUser);
  const [draft, setDraft] = useState(initialUser);
  const [type, setType] = useState(initialType);
  const [direction, setDirection] = useState(initialDirection);
  const [data, setData] = useState<LiveData | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [live, setLive] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const [shareError, setShareError] = useState("");
  const shareGuard = useRef(false);
  const liveRef = useRef(true);
  const [pending, setPending] = useState(false);
  const pendingRows = useRef<LiveEvent[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const [now, setNow] = useState(Date.parse(initialNow));
  const list = useRef<HTMLOListElement>(null);
  const positions = useRef<Map<string, number> | null>(null);
  const actions = useRef({ poll: () => {}, latest: () => {} });
  const resolved = !!data?.profile && (draft === user || draft === data.profile.fid);

  function rememberPositions() {
    positions.current = new Map(
      Array.from(list.current?.children ?? []).map((node) => [
        (node as HTMLElement).dataset.eventId!,
        node.getBoundingClientRect().top,
      ]),
    );
  }
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) setNow(Date.now());
    };
    tick();
    const timer = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  useEffect(() => {
    liveRef.current = live;
    if (live) actions.current.poll();
  }, [live]);
  useEffect(() => {
    let active = true,
      inFlight = false,
      initialized = false;
    let head: string | null = null;
    let lastUpdate = 0;
    let rows: LiveEvent[] = [];
    let drain: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    setData(null);
    setEvents([]);
    setLoading(true);
    setError("");
    setPending(false);
    pendingRows.current = [];
    positions.current = null;
    const atTop = () => (list.current?.getBoundingClientRect().top ?? 0) >= -80;
    function applyPending() {
      if (!pendingRows.current.length) return;
      rememberPositions();
      rows = mergeLiveEvents(rows, pendingRows.current);
      pendingRows.current = [];
      setEvents(rows);
      setPending(false);
    }
    const autoLatest = () => {
      if (liveRef.current && !document.hidden && atTop()) applyPending();
    };
    async function load() {
      if (!active || inFlight || (initialized && (!liveRef.current || document.hidden))) return;
      inFlight = true;
      const requestedAt = Date.now();
      const refresh = initialized && requestedAt - lastUpdate > STALE_AFTER_MS;
      try {
        const params = new URLSearchParams({ type });
        if (user) {
          params.set("user", user);
          params.set("direction", direction);
        }
        if (head && !refresh) params.set("after", head);
        const response = await fetch(`/api/live-view?${params}`, {
          cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]),
        });
        const next = (await response.json()) as LiveData & { error?: string };
        if (!response.ok) throw new Error(next.error || "Could not refresh live activity.");
        if (!active) return;
        if (initialized && (!liveRef.current || document.hidden)) return;
        // A response suspended with the tab can itself be too old to display.
        if (Date.now() - requestedAt > STALE_AFTER_MS) {
          drain = setTimeout(() => void load(), 0);
          return;
        }
        setData(next);
        setError("");
        lastUpdate = Date.now();
        head = next.headCursor;
        if (!initialized) {
          initialized = true;
          rows = next.events;
          setEvents(rows);
          setDraft(next.profile ? next.profile.fid : "");
          const url = new URLSearchParams();
          if (next.profile) url.set("user", next.profile.fid);
          if (type !== "all") url.set("type", type);
          if (next.profile && direction !== "actor") url.set("direction", direction);
          const share = new URLSearchParams(window.location.search).get("share");
          if (share && user === initialUser && type === initialType && direction === initialDirection)
            url.set("share", share);
          window.history.replaceState(null, "", `/live-view${url.size ? `?${url}` : ""}`);
        } else if (refresh) {
          rows = next.events;
          pendingRows.current = [];
          positions.current = null;
          setEvents(rows);
          setPending(false);
          setAnnouncement("Showing latest events.");
        } else if (next.events.length) {
          const incoming = mergeLiveEvents(pendingRows.current, next.events).filter(
            (event) => !rows.some((old) => old.id === event.id),
          );
          if (atTop() && !list.current?.contains(document.activeElement)) {
            pendingRows.current = incoming;
            applyPending();
          } else {
            pendingRows.current = incoming;
            setPending(incoming.length > 0);
          }
          if (incoming.length) setAnnouncement(`${incoming.length} new event${incoming.length === 1 ? "" : "s"}.`);
        }
        if (!refresh && next.hasMore && next.headCursor) drain = setTimeout(() => void load(), 400);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Could not refresh live activity.");
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    }
    actions.current = {
      poll: () => {
        autoLatest();
        void load();
      },
      latest: () => {
        applyPending();
        list.current?.scrollIntoView({ block: "start", behavior: "auto" });
      },
    };
    void load();
    const timer = setInterval(() => void load(), 5000);
    const visible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("scroll", autoLatest, { passive: true });
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
      clearTimeout(drain);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("scroll", autoLatest);
    };
  }, [user, type, direction, initialUser, initialType, initialDirection]);
  useLayoutEffect(() => {
    const previous = positions.current;
    positions.current = null;
    if (!previous || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (const node of Array.from(list.current?.children ?? [])) {
      const element = node as HTMLElement;
      const old = previous.get(element.dataset.eventId!);
      element.animate(
        [
          {
            transform: `translateY(${old === undefined ? -18 : old - element.getBoundingClientRect().top}px)`,
            opacity: old === undefined ? 0 : 1,
          },
          { transform: "translateY(0)", opacity: 1 },
        ],
        { duration: 380, easing: "cubic-bezier(.2,.7,.2,1)" },
      );
    }
  }, [events]);

  function apply(value: string) {
    setDraft(value);
    setUser(value.trim());
    if (!value.trim()) setDirection("actor");
  }
  function profileLink(profile: Profile) {
    const href = `https://farcaster.xyz/${profile.username || `~/profiles/${profile.fid}`}`;
    return (
      <a
        className="live-account"
        href={href}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => {
          if (!isMiniApp) return;
          event.preventDefault();
          const id = Number(profile.fid);
          void (Number.isSafeInteger(id) ? sdk.actions.viewProfile({ fid: id }) : sdk.actions.openUrl(href))
            .catch(() => sdk.actions.openUrl(href))
            .catch(() => {});
        }}
      >
        {name(profile)}
      </a>
    );
  }
  async function handleShare(target: ShareTarget) {
    if (!data || shareGuard.current) return;
    shareGuard.current = true;
    setSharing(true);
    setShareError("");
    setShareNotice("");
    let popup: Window | null = null;
    let url = "";
    try {
      popup = target !== "copy" && !(target === "farcaster" && isMiniApp) ? window.open("about:blank", "_blank") : null;
      if (popup) popup.opener = null;
      const prepared = (async () => {
        const response = await fetch("/api/live-view/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user: user || undefined, type, direction }),
          signal: AbortSignal.timeout(45000),
        });
        const snapshot = await response.json();
        if (!response.ok) throw new Error(snapshot.error || "Could not prepare this share.");
        url = new URL(
          livePath({ user: snapshot.profile?.fid, type: snapshot.type, direction: snapshot.direction }, snapshot.id),
          process.env.NEXT_PUBLIC_URL || window.location.origin,
        ).toString();
        return snapshot;
      })();
      let copyError: unknown;
      const copied =
        target === "copy" && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write
          ? navigator.clipboard
              .write([
                new ClipboardItem({ "text/plain": prepared.then(() => new Blob([url], { type: "text/plain" })) }),
              ])
              .catch((error) => {
                copyError = error;
              })
          : undefined;
      const snapshot = await prepared;
      if (target === "copy") {
        if (copied) {
          await copied;
          if (copyError) throw copyError;
        } else await navigator.clipboard.writeText(url);
        setShareNotice("Link copied.");
      } else {
        const text = `Farcaster today · Live View · ${snapshot.date} UTC\n\n${shareCredit(target)}`;
        if (target === "farcaster" && isMiniApp) {
          try {
            await sdk.actions.composeCast({ text, embeds: [url] });
            setShareOpen(false);
            return;
          } catch {
            /* Use the web composer when native sharing is unavailable. */
          }
        }
        const compose = new URL(target === "x" ? "https://x.com/intent/post" : "https://farcaster.xyz/~/compose");
        compose.searchParams.set("text", text);
        compose.searchParams.set(target === "x" ? "url" : "embeds[]", url);
        if (popup) popup.location.replace(compose.toString());
        else window.open(compose.toString(), "_blank", "noopener,noreferrer");
      }
      setShareOpen(false);
    } catch (error) {
      popup?.close();
      setShareError(
        url
          ? `Could not share. Copy this link: ${url}`
          : error instanceof Error
            ? error.message
            : "Could not prepare this share.",
      );
    } finally {
      shareGuard.current = false;
      setSharing(false);
    }
  }
  const clock = liveClockParts(now);
  return (
    <main className="live-view-page">
      <header className="topbar">
        <Link className="wordmark" href="/">
          <span className="mark" aria-hidden="true">
            {LOGO_PIXELS.map(([x, y, level], index) => (
              <i key={index} style={{ gridColumn: x + 1, gridRow: y + 1, background: PURPLES[level] }} />
            ))}
          </span>
          faralytics<span className="wordmark-dot">.</span>
        </Link>
        <h1>
          Live View<span>.</span>
        </h1>
      </header>
      <AppNavigation active="live-view" />
      <div className="live-controls">
        <time
          className="live-clock"
          dateTime={new Date(now).toISOString()}
          aria-label={`${clock.year} ${clock.month} ${clock.day} ${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}:${String(clock.second).padStart(2, "0")} UTC`}
          aria-live="off"
          data-testid="live-clock"
        >
          <span aria-hidden="true">
            <NumberFlow value={clock.year} format={integer} /> {clock.month}{" "}
            <NumberFlow value={clock.day} format={twoDigits} /> <NumberFlow value={clock.hour} format={twoDigits} />:
            <NumberFlow value={clock.minute} format={twoDigits} />:
            <NumberFlow value={clock.second} format={twoDigits} /> UTC
          </span>
        </time>
        <button
          className="live-filter-toggle"
          type="button"
          aria-label={user || type !== "all" ? "Filters (active)" : "Filters"}
          aria-expanded={filtersOpen}
          aria-controls="live-filters"
          data-active={!!user || type !== "all"}
          onClick={() => setFiltersOpen((value) => !value)}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M4 4h16l-6 7v7l-4 2v-9z" />
          </svg>
        </button>
      </div>
      <div className="live-filters" id="live-filters" hidden={!filtersOpen}>
        <form
          className="search-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (draft.trim() && !resolved) apply(draft);
          }}
        >
          <AccountSearch
            searchId="live-user"
            label="Filter by username or FID"
            value={resolved ? name(data!.profile!).replace(/^FID /, "") : draft}
            onChange={setDraft}
            onSelect={apply}
            onReset={() => apply("")}
            onShowMe={isMiniApp && fid ? () => apply(fid) : undefined}
            busy={loading}
            resolved={resolved}
            profile={resolved ? data!.profile! : undefined}
          />
        </form>
        <label className="interaction-filter">
          <span>Event type</span>
          <select
            aria-label="Live event type"
            value={type}
            onChange={(event) => setType(event.target.value as LiveType)}
          >
            {Object.entries(liveTypes).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="interaction-filter">
          <span>User role</span>
          <select
            aria-label="Live user role"
            value={direction}
            disabled={!user}
            onChange={(event) => setDirection(event.target.value as LiveDirection)}
          >
            {Object.entries(liveDirections).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {user && <p className="live-scope-note">User role affects events; daily metrics show actions by this user.</p>}
      </div>
      {data && (
        <div
          className="live-stats"
          aria-label={data.profile ? `Today’s activity by ${name(data.profile)}` : "Today’s network activity"}
        >
          {(Object.keys(liveMetricLabels) as (keyof LiveCounts)[]).map((key) => (
            <article className="live-stat" key={key} data-testid={`live-stat-${key}`}>
              <h2 title={key === "dau" ? "Unique FIDs with any captured action today" : undefined}>
                {liveMetricLabels[key]}
              </h2>
              <NumberFlow className="live-stat-value numeric-value" value={data.totals.today[key]} locales="en-US" />
              <p>
                <span>Yesterday</span> <NumberFlow value={data.totals.yesterday[key]} locales="en-US" />
              </p>
            </article>
          ))}
        </div>
      )}
      {loading && (
        <p className="notice" role="status">
          Loading live activity…
        </p>
      )}
      {error && (
        <div className="error-box" role="alert">
          {error}{" "}
          <button type="button" onClick={() => actions.current.poll()}>
            Try again
          </button>
        </div>
      )}
      {shareNotice && (
        <p className="live-share-notice" role="status">
          {shareNotice}
        </p>
      )}
      {shareError && (
        <p className="error-box" role="alert">
          {shareError}
        </p>
      )}
      <section className="timeline-feed live-feed" aria-label="Live events">
        <div className="timeline-toolbar">
          <span className={live ? "live-indicator" : ""}>{live ? "● Live" : "Paused"}</span>
          <div>
            <button
              className="live-share-toggle"
              type="button"
              aria-label="Share daily metrics"
              aria-expanded={shareOpen}
              aria-controls="live-share-menu"
              disabled={!data || sharing}
              onClick={() => setShareOpen((value) => !value)}
            >
              <svg
                viewBox="0 0 24 24"
                width="19"
                height="19"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M12 16V3m-5 5 5-5 5 5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
              </svg>
            </button>
            {shareOpen && (
              <div className="live-share-menu" id="live-share-menu">
                <ShareActions
                  placement="below"
                  heading="share today’s metrics:"
                  disabled={sharing}
                  onShare={(target) => void handleShare(target)}
                />
              </div>
            )}
            <button
              className="live-pause"
              type="button"
              onClick={() => setLive((value) => !value)}
              aria-pressed={!live}
            >
              {live ? "Pause" : "Resume"}
            </button>
          </div>
        </div>
        <ol className="live-events" ref={list}>
          {events.map((event) => {
            const action = liveEventAction(event);
            const castUrl = (hash: string) => `https://farcaster.xyz/~/conversations/${hash}`;
            return (
              <li key={event.id} data-event-id={event.id}>
                <div className="live-event-main">
                  <div className="live-sentence">
                    <span className="result-avatar live-event-avatar" aria-hidden="true">
                      <AvatarImage source={event.actor.pfp_url} size={20} />
                    </span>
                    {profileLink(event.actor)}{" "}
                    <a
                      className={`live-verb live-verb-${event.action}`}
                      style={{ color: liveActionColors[event.action] }}
                      href={action.actionUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {action.verb}
                    </a>
                    {action.castHash && (
                      <>
                        {action.connector}
                        <a className="live-cast-link" href={castUrl(action.castHash)} target="_blank" rel="noreferrer">
                          cast
                        </a>
                        {action.target && <> by {profileLink(action.target)}</>}
                      </>
                    )}
                    {action.profileAction && action.target && <> {profileLink(action.target)}</>}
                    {event.action === "mention" && (
                      <>
                        {" "}
                        {event.mentions.map((profile) => (
                          <span key={profile.fid}>{profileLink(profile)} </span>
                        ))}
                        {event.mentionCount > event.mentions.length && (
                          <span>+{event.mentionCount - event.mentions.length} others</span>
                        )}
                      </>
                    )}
                  </div>
                  {event.text && (
                    <a className="live-cast-text" href={action.actionUrl} target="_blank" rel="noreferrer">
                      {event.text}
                    </a>
                  )}
                  {event.quotes?.map((quote) => (
                    <blockquote className="live-quote" key={`${quote.author.fid}:${quote.hash}`}>
                      <span className="result-avatar live-quote-avatar" aria-hidden="true">
                        <AvatarImage source={quote.author.pfp_url} size={16} />
                      </span>
                      {profileLink(quote.author)}
                      <a className="live-quote-text" href={castUrl(quote.hash)} target="_blank" rel="noreferrer">
                        {quote.text ?? "Quoted cast is unavailable in captured history."}
                      </a>
                    </blockquote>
                  ))}
                  {event.action !== "mention" && event.mentions.length > 0 && (
                    <div className="live-mentions">
                      Mentioned{" "}
                      {event.mentions.map((profile) => (
                        <span key={profile.fid}>{profileLink(profile)} </span>
                      ))}
                    </div>
                  )}
                  <div className="live-event-foot">
                    <TimelineTime timestamp={event.timestamp} now={now} />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        {!loading && !events.length && (
          <p className="empty-note">No recent events for these filters. New activity will appear here.</p>
        )}
      </section>
      {pending && (
        <button className="timeline-new" onClick={() => actions.current.latest()}>
          Show new events ↑
        </button>
      )}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {data && (
        <p className="timeline-note">
          {data.source.coverage} {data.source.catchingUp ? "Source is catching up; events may arrive late." : ""}
        </p>
      )}
    </main>
  );
}
