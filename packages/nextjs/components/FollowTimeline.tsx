"use client";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { AccountSearch } from "./AccountSearch";
import { AddMiniappButton } from "./AddMiniappButton";
import { AppNavigation } from "./AppNavigation";
import { AvatarImage } from "./AvatarImage";
import { NumberText } from "./NumberText";
import { ShareActions } from "./ShareActions";
import { CopyToast } from "./CopyToast";
import { ChartImages } from "./ChartImages";
import { useMiniapp } from "./MiniappProvider";
import { useLookupLog } from "~~/hooks/useLookupLog";
import { PURPLES, type Profile } from "~~/lib/activity";
import { LOGO_PIXELS } from "~~/lib/brand";
import { mergeTimeline, relativeEventTime, type TimelineEvent, type TimelinePage } from "~~/lib/follow-timeline";
import { timelineSharePath, timelineShareText, type TimelineShareData } from "~~/lib/timeline-share";

const accountName = (profile: Profile) => (profile.username ? `@${profile.username}` : `FID ${profile.fid}`);
export function FollowTimeline({
  initialActor = "",
  initialTarget = "",
  initialGlobal = false,
}: {
  initialActor?: string;
  initialTarget?: string;
  initialGlobal?: boolean;
}) {
  const { isMiniApp, fid, ready } = useMiniapp();
  const [chosenSelection, setSelection] = useState<{ actor: string; target: string } | null>(
    initialGlobal ? { actor: "", target: "" } : null,
  );
  const selection = chosenSelection ?? {
    actor: initialActor,
    target: initialTarget || (!initialActor && isMiniApp && fid ? fid : ""),
  };
  const selectionReady = ready || !!initialActor || !!initialTarget || chosenSelection !== null;
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
  const [sharing, setSharing] = useState(false);
  const [shareNote, setShareNote] = useState("");
  const [copyCount, setCopyCount] = useState(0);
  const list = useRef<HTMLOListElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const actions = useRef({ older: () => {}, refresh: () => {}, poll: () => {} });
  const liveRef = useRef(true);
  const loadedSelection = useRef<{ actor: string; target: string } | null>(null);
  const editedRole = useRef<"actor" | "target" | null>(null);
  const animateFrom = useRef<Map<string, number> | null>(null);
  const key = JSON.stringify(selection);
  useEffect(() => {
    editedRole.current = null;
    setSelection(initialGlobal ? { actor: "", target: "" } : null);
  }, [initialActor, initialTarget, initialGlobal]);
  const ids = [...new Set([filters.actor?.fid, filters.target?.fid].filter((fid): fid is string => !!fid))];
  const resetLog = useLookupLog(
    !loading && !error && ids.length
      ? { tool: "follow-timeline", fids: ids, period: "all", end: new Date().toISOString().slice(0, 10) }
      : null,
  );

  useEffect(() => {
    if (!selectionReady) return;
    let active = true,
      inFlight = false,
      initialized = false;
    let rows: TimelineEvent[] = [],
      head: string | null = null,
      tail: string | null = null,
      more = false;
    const selected = JSON.parse(key) as { actor: string; target: string };
    const previousSelection = loadedSelection.current;
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
    setFilters((previous) => ({
      actor: previousSelection?.actor === selected.actor ? previous.actor : null,
      target: previousSelection?.target === selected.target ? previous.target : null,
    }));
    animateFrom.current = null;
    async function load(mode: "reset" | "older" | "newer") {
      if (!active || inFlight || (mode === "older" && (!more || !tail))) return;
      if (mode === "newer" && (!liveRef.current || document.hidden)) return;
      if (mode === "newer" && !initialized) mode = "reset";
      const updateActor = loadedSelection.current?.actor !== selected.actor;
      const updateTarget = loadedSelection.current?.target !== selected.target;
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
          if (selected.actor && selected.target && data.filters.actor && !data.filters.target) {
            const role = editedRole.current || "actor";
            setSelection({
              actor: role === "actor" ? data.filters.actor.fid : "",
              target: role === "target" ? data.filters.actor.fid : "",
            });
            if (role === "actor") setTargetInput("");
            else setActorInput("");
            return;
          }
          initialized = true;
          rows = data.events;
          head = data.headCursor;
          tail = data.nextCursor;
          more = data.hasMore;
          setHasMore(more);
          setFilters(data.filters);
          loadedSelection.current = selected;
          if (updateActor)
            setActorInput(data.filters.actor ? accountName(data.filters.actor).replace(/^FID /, "") : "");
          if (updateTarget)
            setTargetInput(data.filters.target ? accountName(data.filters.target).replace(/^FID /, "") : "");
          setHasNew(false);
          setNow(Date.now());
          const url = new URLSearchParams();
          if (data.filters.actor) url.set("actor", data.filters.actor.fid);
          if (data.filters.target) url.set("target", data.filters.target.fid);
          if (initialGlobal && !url.size) url.set("all", "1");
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
  }, [key, selectionReady, initialGlobal]);
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
    editedRole.current = role;
    value = value.trim();
    const other = role === "actor" ? "target" : "actor";
    const account = value.replace(/^@/, "").toLowerCase();
    const sameAccount =
      !!account &&
      [selection[other], filters[other]?.fid, filters[other]?.username].some(
        (candidate) => candidate?.replace(/^@/, "").toLowerCase() === account,
      );
    if (sameAccount) {
      if (other === "actor") setActorInput("");
      else setTargetInput("");
    }
    setMeaningful(true);
    if (!value && !selection[other]) resetLog();
    setSelection((previous) => ({
      ...(previous ?? selection),
      ...(sameAccount ? { [other]: "" } : {}),
      [role]: value,
    }));
  }
  function account(profile: Profile, trailingAvatar = false) {
    const href = `https://farcaster.xyz/${profile.username || `~/profiles/${profile.fid}`}`;
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={`timeline-account${trailingAvatar ? " is-target" : ""}`}
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
        <span className="result-avatar timeline-avatar" aria-hidden="true">
          {(profile.username || "fc").slice(0, 2)}
          <AvatarImage source={profile.pfp_url} size={40} />
        </span>
        <span>{profile.username ? accountName(profile) : <NumberText>{accountName(profile)}</NumberText>}</span>
      </a>
    );
  }
  async function share(target: "farcaster" | "x" | "copy") {
    const selection = {
      ...(filters.actor ? { actor: filters.actor.fid } : {}),
      ...(filters.target ? { target: filters.target.fid } : {}),
    };
    const ts = Date.now().toString();
    const url = new URL(
      timelineSharePath(selection, ts),
      process.env.NEXT_PUBLIC_URL || window.location.origin,
    ).toString();
    setShareNote("");
    if (target === "copy") {
      try {
        await navigator.clipboard.writeText(url);
        setCopyCount((count) => count + 1);
        setMeaningful(true);
      } catch {
        setShareNote(`Copy this link: ${url}`);
      }
      return;
    }
    const native = target === "farcaster" && isMiniApp;
    const popup = native ? null : window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    setSharing(true);
    try {
      const response = await fetch(`/api/follow-timeline/share?${new URLSearchParams({ ts, ...selection })}`, {
        signal: AbortSignal.timeout(25000),
      });
      const data = (await response.json()) as TimelineShareData & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not prepare the share.");
      const text = timelineShareText(data, target);
      if (native) {
        try {
          const result = await sdk.actions.composeCast({ text, embeds: [url] });
          if (result.cast) setMeaningful(true);
          return;
        } catch {
          /* Fall back to the web composer if the host bridge fails. */
        }
      }
      const compose = new URL(target === "x" ? "https://x.com/intent/post" : "https://farcaster.xyz/~/compose");
      compose.searchParams.set("text", text);
      compose.searchParams.set(target === "x" ? "url" : "embeds[]", url);
      if (popup) popup.location.href = compose.toString();
      else window.open(compose.toString(), "_blank", "noopener,noreferrer");
      setMeaningful(true);
    } catch (error) {
      popup?.close();
      setShareNote(error instanceof Error ? error.message : "Could not prepare the share. Please try again.");
    } finally {
      setSharing(false);
    }
  }
  return (
    <main className="timeline-page">
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
        <ShareActions
          heading="a list worth of sharing:"
          disabled={loading || sharing}
          onShare={share}
          placement="header"
        />
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
                onShowMe={isMiniApp && fid ? () => apply(role, fid) : undefined}
                busy={loading && !profile}
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
                {account(event.actor)}
                <span className="timeline-verb">
                  <span aria-hidden="true">{event.action === "follow" ? "+" : "−"}</span>
                  {event.action === "follow" ? "followed" : "unfollowed"}
                </span>
                {account(event.target, true)}
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
      {shareNote && <p role="status">{shareNote}</p>}
      <ShareActions
        heading="a list worth of sharing:"
        disabled={loading || sharing}
        onShare={share}
        placement="below"
      />
      {!loading && !error && (
        <ChartImages
          basePath="/api/og/follow-timeline"
          params={new URLSearchParams({
            ...(filters.actor ? { actor: filters.actor.fid } : {}),
            ...(filters.target ? { target: filters.target.fid } : {}),
          }).toString()}
          filename="faralytics-follow-timeline"
          label="Preview share image"
          previewOnly
        />
      )}
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
