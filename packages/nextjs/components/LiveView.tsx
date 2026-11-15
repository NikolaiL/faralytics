"use client";
import Link from "next/link";
import NumberFlow from "@number-flow/react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AccountSearch } from "./AccountSearch";
import { AppNavigation } from "./AppNavigation";
import { AvatarImage } from "./AvatarImage";
import { TimelineTime } from "./TimelineTime";
import { useMiniapp } from "./MiniappProvider";
import { PURPLES, type Profile } from "~~/lib/activity";
import { LOGO_PIXELS } from "~~/lib/brand";
import {
  liveClockParts,
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
const labels: Record<keyof LiveCounts, string> = {
  casts: "Casts",
  replies: "Replies",
  recasts: "Recasts",
  likes: "Likes",
  mentions: "Mentions",
};

export function LiveView({
  initialUser = "",
  initialType = "all",
  initialNow,
}: {
  initialUser?: string;
  initialType?: LiveType;
  initialNow: string;
}) {
  const { fid, isMiniApp } = useMiniapp();
  const [user, setUser] = useState(initialUser);
  const [draft, setDraft] = useState(initialUser);
  const [type, setType] = useState(initialType);
  const [data, setData] = useState<LiveData | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [live, setLive] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
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
    const atTop = () =>
      (list.current?.getBoundingClientRect().top ?? 0) >= -80 && !list.current?.contains(document.activeElement);
    async function load() {
      if (!active || inFlight || (initialized && (!liveRef.current || document.hidden))) return;
      inFlight = true;
      try {
        const params = new URLSearchParams({ type });
        if (user) params.set("user", user);
        if (head) params.set("after", head);
        const response = await fetch(`/api/live-view?${params}`, {
          cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]),
        });
        const next = (await response.json()) as LiveData & { error?: string };
        if (!response.ok) throw new Error(next.error || "Could not refresh live activity.");
        if (!active) return;
        if (initialized && (!liveRef.current || document.hidden)) return;
        setData(next);
        setError("");
        head = next.headCursor;
        if (!initialized) {
          initialized = true;
          rows = next.events;
          setEvents(rows);
          setDraft(next.profile ? next.profile.fid : "");
          const url = new URLSearchParams();
          if (next.profile) url.set("user", next.profile.fid);
          if (type !== "all") url.set("type", type);
          window.history.replaceState(null, "", `/live-view${url.size ? `?${url}` : ""}`);
        } else if (next.events.length) {
          const incoming = mergeLiveEvents(pendingRows.current, next.events).filter(
            (event) => !rows.some((old) => old.id === event.id),
          );
          if (atTop() && !pendingRows.current.length) {
            rememberPositions();
            rows = mergeLiveEvents(rows, incoming);
            setEvents(rows);
          } else {
            pendingRows.current = incoming;
            setPending(incoming.length > 0);
          }
          if (incoming.length) setAnnouncement(`${incoming.length} new event${incoming.length === 1 ? "" : "s"}.`);
        }
        if (next.hasMore && next.headCursor) drain = setTimeout(() => void load(), 400);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Could not refresh live activity.");
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    }
    actions.current = {
      poll: () => void load(),
      latest: () => {
        rememberPositions();
        rows = mergeLiveEvents(rows, pendingRows.current);
        setEvents(rows);
        pendingRows.current = [];
        setPending(false);
        list.current?.scrollIntoView({ block: "start", behavior: "auto" });
      },
    };
    void load();
    const timer = setInterval(() => void load(), 5000);
    const visible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
      clearTimeout(drain);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [user, type]);
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
            label="Activity by username or FID"
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
      </div>
      {data && (
        <div
          className="live-stats"
          aria-label={data.profile ? `Today’s activity by ${name(data.profile)}` : "Today’s network activity"}
        >
          {(Object.keys(labels) as (keyof LiveCounts)[]).map((key) => (
            <article className="live-stat" key={key} data-testid={`live-stat-${key}`}>
              <h2>{labels[key]}</h2>
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
      <section className="timeline-feed live-feed" aria-label="Live events">
        <div className="timeline-toolbar">
          <span className={live ? "live-indicator" : ""}>{live ? "● Live" : "Paused"}</span>
          <div>
            <span>Updates every 5 seconds</span>
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
          {events.map((event) => (
            <li key={event.id} data-event-id={event.id}>
              <span className="result-avatar timeline-avatar" aria-hidden="true">
                <AvatarImage source={event.actor.pfp_url} size={32} />
              </span>
              <div className="live-event-main">
                <div className="live-sentence">
                  {profileLink(event.actor)}{" "}
                  <span className={`live-verb live-verb-${event.action}`}>
                    {event.action === "cast"
                      ? "casted"
                      : event.action === "mention"
                        ? "mentioned"
                        : `${event.action === "reply" ? "replied to" : event.action === "like" ? "liked" : "recasted"} a cast${event.target ? " by" : ""}`}
                  </span>{" "}
                  {event.action === "mention" ? (
                    <>
                      {event.mentions.map((profile) => (
                        <span key={profile.fid}>{profileLink(profile)} </span>
                      ))}
                      {event.mentionCount > event.mentions.length && (
                        <span>+{event.mentionCount - event.mentions.length} others</span>
                      )}
                    </>
                  ) : (
                    event.target && profileLink(event.target)
                  )}
                </div>
                {event.text && (
                  <a
                    className="live-cast-text"
                    href={`https://farcaster.xyz/~/conversations/${event.castHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {event.text}
                  </a>
                )}
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
                  <a href={`https://farcaster.xyz/~/conversations/${event.castHash}`} target="_blank" rel="noreferrer">
                    View cast ↗
                  </a>
                </div>
              </div>
            </li>
          ))}
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
