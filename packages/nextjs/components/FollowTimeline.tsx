"use client";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { AccountSearch } from "./AccountSearch";
import { AddMiniappButton } from "./AddMiniappButton";
import { AppNavigation } from "./AppNavigation";
import { AvatarImage } from "./AvatarImage";
import { NumberText } from "./NumberText";
import { useMiniapp } from "./MiniappProvider";
import { useLookupLog } from "~~/hooks/useLookupLog";
import { PURPLES, type Profile } from "~~/lib/activity";
import { LOGO_PIXELS } from "~~/lib/brand";
import { mergeTimeline, relativeEventTime, type TimelineEvent, type TimelinePage } from "~~/lib/follow-timeline";

const accountName = (profile: Profile) => (profile.username ? `@${profile.username}` : `FID ${profile.fid}`);
export function FollowTimeline({
  initialActor = "",
  initialTarget = "",
}: {
  initialActor?: string;
  initialTarget?: string;
}) {
  const { isMiniApp } = useMiniapp();
  const [selection, setSelection] = useState({ actor: initialActor, target: initialTarget });
  const [actorInput, setActorInput] = useState(initialActor);
  const [targetInput, setTargetInput] = useState(initialTarget);
  const [filters, setFilters] = useState<TimelinePage["filters"]>({ actor: null, target: null });
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [olderError, setOlderError] = useState("");
  const [hasNew, setHasNew] = useState(false);
  const [live, setLive] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const [meaningful, setMeaningful] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const actions = useRef({ older: () => {}, refresh: () => {}, poll: () => {} });
  const liveRef = useRef(true);
  const animateFrom = useRef<Map<string, number> | null>(null);
  const key = JSON.stringify(selection);
  useEffect(() => {
    setSelection({ actor: initialActor, target: initialTarget });
  }, [initialActor, initialTarget]);
  const ids = [...new Set([filters.actor?.fid, filters.target?.fid].filter((fid): fid is string => !!fid))];
  const resetLog = useLookupLog(
    !loading && !error && ids.length
      ? { tool: "follow-timeline", fids: ids, period: "all", end: new Date().toISOString().slice(0, 10) }
      : null,
  );

  useEffect(() => {
    let active = true,
      inFlight = false,
      initialized = false;
    let rows: TimelineEvent[] = [],
      head: string | null = null,
      tail: string | null = null,
      more = false;
    const selected = JSON.parse(key) as { actor: string; target: string };
    const controller = new AbortController();
    let drain: ReturnType<typeof setTimeout> | undefined;
    const atTop = () =>
      (list.current?.getBoundingClientRect().top ?? 0) >= -80 && !list.current?.contains(document.activeElement);
    setEvents([]);
    setLoading(true);
    setError("");
    setOlderError("");
    setHasNew(false);
    setHasMore(false);
    setLoadingMore(false);
    setFilters({ actor: null, target: null });
    animateFrom.current = null;
    async function load(mode: "reset" | "older" | "newer") {
      if (!active || inFlight || (mode === "older" && (!more || !tail))) return;
      if (mode === "newer" && (!liveRef.current || document.hidden)) return;
      if (mode === "newer" && !initialized) mode = "reset";
      inFlight = true;
      if (mode === "reset") setLoading(true);
      if (mode === "older") {
        setLoadingMore(true);
        setOlderError("");
      }
      const params = new URLSearchParams();
      if (selected.actor) params.set("actor", selected.actor);
      if (selected.target) params.set("target", selected.target);
      if (mode === "older" && tail) params.set("before", tail);
      // shortcut: late backfills older than this event-time cursor appear on refresh/older pages; use an observed-at stream if they must be pushed immediately.
      if (mode === "newer" && head) params.set("after", head);
      try {
        const response = await fetch(`/api/follow-timeline?${params}`, {
          cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]),
        });
        const data = (await response.json()) as TimelinePage & { error?: string };
        if (!response.ok) throw new Error(data.error || "Could not load follow events.");
        if (!active) return;
        if (mode === "newer" && (!liveRef.current || document.hidden)) return;
        setError("");
        if (mode === "reset") {
          initialized = true;
          rows = data.events;
          head = data.headCursor;
          tail = data.nextCursor;
          more = data.hasMore;
          setHasMore(more);
          setFilters(data.filters);
          setActorInput(data.filters.actor ? accountName(data.filters.actor).replace(/^FID /, "") : "");
          setTargetInput(data.filters.target ? accountName(data.filters.target).replace(/^FID /, "") : "");
          setHasNew(false);
          setNow(Date.now());
          const url = new URLSearchParams();
          if (data.filters.actor) url.set("actor", data.filters.actor.fid);
          if (data.filters.target) url.set("target", data.filters.target.fid);
          window.history.replaceState(null, "", `/follow-timeline${url.size ? `?${url}` : ""}`);
          setEvents(rows);
        } else if (mode === "older") {
          rows = mergeTimeline(rows, data.events);
          tail = data.nextCursor;
          more = data.hasMore;
          setHasMore(more);
          setEvents(rows);
        } else if (data.events.length) {
          if (!atTop()) {
            setHasNew(true);
            return;
          }
          animateFrom.current = new Map(
            Array.from(list.current?.children || []).map((node) => [
              (node as HTMLElement).dataset.eventId!,
              node.getBoundingClientRect().top,
            ]),
          );
          const added = data.events.filter((event) => !rows.some((old) => old.id === event.id)).length;
          rows = mergeTimeline(rows, data.events);
          head = data.headCursor;
          if (!tail) {
            tail = rows.at(-1)?.cursor || null;
            more = data.hasMore;
            setHasMore(more);
          }
          setEvents(rows);
          setHasNew(false);
          if (added) setAnnouncement(`${added} new follow event${added === 1 ? "" : "s"}.`);
          // Drain ascending cursor batches so a busy global feed never skips events between polls.
          if (data.hasMore) drain = setTimeout(() => void load("newer"), 400);
        }
      } catch (cause) {
        if (!active) return;
        const message = cause instanceof Error ? cause.message : "Could not load follow events.";
        if (mode === "older") setOlderError(message);
        else
          setError(
            mode === "newer" ? "Could not refresh. Your events are still here; retrying automatically." : message,
          );
      } finally {
        inFlight = false;
        if (active) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    }
    actions.current = {
      older: () => void load("older"),
      refresh: () => {
        animateFrom.current = null;
        void load("reset");
      },
      poll: () => void load("newer"),
    };
    void load("reset");
    const timer = setInterval(() => void load("newer"), 5000);
    const visible = () => {
      if (!document.hidden) void load("newer");
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
      clearTimeout(drain);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [key]);
  useEffect(() => {
    liveRef.current = live;
    if (live) actions.current.poll();
    const timer = setInterval(() => {
      if (live && !document.hidden) setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [live]);
  useLayoutEffect(() => {
    const previous = animateFrom.current;
    animateFrom.current = null;
    if (!previous || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (const node of Array.from(list.current?.children || [])) {
      const element = node as HTMLElement;
      const oldTop = previous.get(element.dataset.eventId!);
      const shift = oldTop === undefined ? -12 : oldTop - element.getBoundingClientRect().top;
      element.animate(
        [
          { transform: `translateY(${shift}px)`, ...(oldTop === undefined ? { opacity: 0 } : {}) },
          { transform: "translateY(0)", opacity: 1 },
        ],
        { duration: 380, easing: "cubic-bezier(.2,.7,.2,1)" },
      );
    }
  }, [events]);
  useEffect(() => {
    if (!hasMore || loading || olderError || !sentinel.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          actions.current.older();
        }
      },
      { rootMargin: "180px" },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [hasMore, loading, olderError]);

  function apply(role: "actor" | "target", value: string) {
    setMeaningful(true);
    if (!value && !selection[role === "actor" ? "target" : "actor"]) resetLog();
    setSelection((previous) => ({ ...previous, [role]: value.trim() }));
  }
  function account(profile: Profile, avatar = false) {
    const href = `https://farcaster.xyz/${profile.username || `~/profiles/${profile.fid}`}`;
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="timeline-account"
        title={`FID ${profile.fid}`}
        onClick={(event) => {
          if (!isMiniApp) return;
          event.preventDefault();
          const fid = Number(profile.fid);
          void (Number.isSafeInteger(fid) ? sdk.actions.viewProfile({ fid }) : sdk.actions.openUrl(href))
            .catch(() => sdk.actions.openUrl(href))
            .catch(() => {});
        }}
      >
        {avatar && (
          <span className="result-avatar timeline-avatar" aria-hidden="true">
            {(profile.username || "fc").slice(0, 2)}
            <AvatarImage source={profile.pfp_url} size={40} />
          </span>
        )}
        <span>{profile.username ? accountName(profile) : <NumberText>{accountName(profile)}</NumberText>}</span>
      </a>
    );
  }
  return (
    <main className="timeline-page">
      <header className="topbar">
        <Link className="wordmark" href="/">
          <span className="mark" aria-hidden="true">
            {LOGO_PIXELS.map(([x, y, level], i) => (
              <i key={i} style={{ gridColumn: x + 1, gridRow: y + 1, background: PURPLES[level] }} />
            ))}
          </span>
          faralytics<span className="wordmark-dot">.</span>
        </Link>
        <span className="timeline-kicker">The social graph, in motion.</span>
      </header>
      <AppNavigation
        active="follow-timeline"
        fids={filters.target ? [filters.target.fid] : filters.actor ? [filters.actor.fid] : []}
      />
      <section className="timeline-intro">
        <span className="eyebrow">Connections, as they happen.</span>
        <h1>
          Follow timeline<span>.</span>
        </h1>
        <p>A follow. An unfollow. Every captured connection, in order.</p>
      </section>
      <div className="timeline-filters">
        {(["actor", "target"] as const).map((role) => {
          const profile = filters[role];
          const value = role === "actor" ? actorInput : targetInput;
          return (
            <form
              className="search-form"
              key={role}
              aria-label={`Filter by ${role}`}
              onSubmit={(event) => {
                event.preventDefault();
                if (value.trim()) apply(role, value);
              }}
            >
              <div className="timeline-filter-label">
                <label htmlFor={`timeline-${role}-input`}>{role === "actor" ? "Actor" : "Target"}</label>
                <span>{role === "actor" ? "Who made the move" : "Who it was about"}</span>
              </div>
              <AccountSearch
                searchId={`timeline-${role}`}
                label={`${role === "actor" ? "Actor" : "Target"} username or FID`}
                value={value}
                onChange={role === "actor" ? setActorInput : setTargetInput}
                onSelect={(fid) => apply(role, fid)}
                busy={loading}
                resolved={!!profile && (value === accountName(profile) || value === profile.fid)}
                onReset={() => {
                  if (role === "actor") setActorInput("");
                  else setTargetInput("");
                  apply(role, "");
                }}
              />
            </form>
          );
        })}
      </div>
      <section className="timeline-feed" aria-label="Follow events" data-testid="timeline-feed">
        <div className="timeline-toolbar">
          <div>
            <span className={`timeline-live ${live ? "is-live" : ""}`}>
              <i />
              {live ? "Live" : "Paused"}
            </span>
            {selection.actor || selection.target ? (
              <button
                type="button"
                className="timeline-clear"
                data-testid="timeline-clear"
                onClick={() => {
                  resetLog();
                  setActorInput("");
                  setTargetInput("");
                  setSelection({ actor: "", target: "" });
                  setMeaningful(true);
                }}
              >
                Clear filters ×
              </button>
            ) : (
              <span className="timeline-scope">Everyone</span>
            )}
          </div>
          <button
            type="button"
            data-testid="timeline-pause"
            aria-pressed={!live}
            onClick={() => {
              liveRef.current = !live;
              setLive(!live);
              setMeaningful(true);
            }}
          >
            {live ? "Ⅱ Pause" : "▶ Resume"}
          </button>
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
        {hasNew && (
          <button
            type="button"
            className="timeline-new"
            data-testid="timeline-new"
            onClick={() => {
              window.scrollTo({
                top: 0,
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
              });
              actions.current.refresh();
            }}
          >
            ↑ New events · Show latest
          </button>
        )}
        {error && (
          <div className="timeline-error" role="alert">
            {error}
            <button type="button" data-testid="timeline-retry" onClick={() => actions.current.refresh()}>
              Retry
            </button>
          </div>
        )}
        {loading && (
          <div className="timeline-loading" role="status">
            <span className="search-spinner" />
            Loading follow events…
          </div>
        )}
        <ol ref={list} className="timeline-list" aria-busy={loading} aria-live="off" data-testid="timeline-list">
          {events.map((event) => (
            <li
              key={event.id}
              data-event-id={event.id}
              data-testid="timeline-event"
              className={`timeline-row is-${event.action}`}
            >
              <div className="timeline-sentence">
                {account(event.actor, true)}
                <span className="timeline-verb">
                  <span aria-hidden="true">{event.action === "follow" ? "+" : "−"}</span>
                  {event.action === "follow" ? "followed" : "unfollowed"}
                </span>
                {account(event.target)}
              </div>
              <time
                dateTime={event.timestamp}
                title={new Date(event.timestamp).toLocaleString("en-GB", { timeZone: "UTC" }) + " UTC"}
              >
                <NumberText>{relativeEventTime(event.timestamp, now)}</NumberText>
              </time>
            </li>
          ))}
        </ol>
        {!loading && !events.length && !error && (
          <div className="timeline-empty">
            <span aria-hidden="true">↗</span>
            <h2>No captured events yet</h2>
            <p>Try another actor or target, or clear both filters to see everyone.</p>
          </div>
        )}
        {!loading && events.length > 0 && (
          <div className="timeline-more" ref={sentinel}>
            {olderError && <p role="alert">{olderError}</p>}
            {hasMore ? (
              <button
                type="button"
                data-testid="timeline-more"
                disabled={loadingMore}
                onClick={() => actions.current.older()}
              >
                {loadingMore ? (
                  <>
                    <span className="search-spinner" />
                    Loading older events…
                  </>
                ) : olderError ? (
                  "Retry older events"
                ) : (
                  "Load older events ↓"
                )}
              </button>
            ) : (
              <p>You’re up to date with the captured history for these filters.</p>
            )}
          </div>
        )}
      </section>
      <p className="timeline-note">
        Captured follow and unfollow actions · UTC. Updates every <NumberText>5</NumberText> seconds while visible.
        Historical coverage may be incomplete.
      </p>
      <footer>
        <AddMiniappButton meaningfulInteraction={meaningful} />
        <a href="https://viniapp.xyz" target="_blank" rel="noreferrer">
          created with <b>viniapp</b> ↗
        </a>
      </footer>
    </main>
  );
}
