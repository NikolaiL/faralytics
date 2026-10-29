"use client";
import { sdk } from "@farcaster/miniapp-sdk";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Activity, Day } from "~~/lib/activity";
import { activityShareText, activityDate, dateKey, periodLabel, PURPLES, sharePath, utcDate } from "~~/lib/activity";
import { LOGO_PIXELS } from "~~/lib/brand";
import { BrandChart } from "./BrandChart";
import { AvatarImage } from "./AvatarImage";
import { Heatmap } from "./Heatmap";
import { AccountSearch } from "./AccountSearch";
import { useMiniapp } from "./MiniappProvider";

function Mark() {
  return (
    <span className="mark" aria-hidden="true">
      {LOGO_PIXELS.map(([x, y], i) => (
        <i key={i} style={{ gridColumn: x + 1, gridRow: y + 1 }} />
      ))}
    </span>
  );
}
export function ActivityExplorer({
  initialData,
  initialUser,
  initialPeriod = "365",
  initialEnd,
}: {
  initialData?: Activity;
  initialUser?: string;
  initialPeriod?: string;
  initialEnd?: string;
}) {
  const { fid, isMiniApp } = useMiniapp();
  const [input, setInput] = useState(
    initialData?.profile.username ? `@${initialData.profile.username}` : initialUser || "",
  );
  const [data, setData] = useState<Activity | undefined>(initialData);
  const [busy, setBusy] = useState(!initialData && !!initialUser);
  const [period, setPeriod] = useState(initialData?.period || initialPeriod);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [day, setDay] = useState<Day>();
  const controller = useRef<AbortController | null>(null);
  const chart = useRef<HTMLDivElement>(null);
  const selfLoaded = useRef(false);

  async function load(user: string, selectedPeriod: string, end?: string) {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    setNote("");
    setPeriod(selectedPeriod);
    try {
      const params = new URLSearchParams({ user, period: selectedPeriod });
      if (end) params.set("end", end);
      const response = await fetch(`/api/activity?${params}`, { signal: abort.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load activity.");
      const next = body as Activity;
      setData(next);
      setDay(undefined);
      setInput(next.profile.username ? `@${next.profile.username}` : next.profile.fid);
      window.history.replaceState(
        null,
        "",
        `/?${new URLSearchParams({ user: next.profile.fid, period: next.period, end: next.anchor })}`,
      );
    } catch (cause) {
      if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load activity.");
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    if (!initialData && initialUser) void load(initialUser, initialPeriod, initialEnd);
    return () => controller.current?.abort();
    // Initial URL is consumed once; later changes come from the form and year controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (fid && !selfLoaded.current && !initialData && !initialUser) {
      selfLoaded.current = true;
      void load(fid, "365");
    }
  }, [fid, initialData, initialUser]);
  useEffect(() => {
    if (chart.current && data?.period === "365") chart.current.scrollLeft = chart.current.scrollWidth;
  }, [data]);

  async function share(target: "farcaster" | "x" | "copy") {
    if (!data) return;
    const origin = process.env.NEXT_PUBLIC_URL || window.location.origin;
    const url = `${origin}${sharePath(data.profile.fid, data.period, data.anchor, Date.now().toString())}`;
    const text = activityShareText(data, fid);
    if (target === "copy") {
      try {
        await navigator.clipboard.writeText(url);
        setNote("Chart link copied.");
      } catch {
        setNote(`Copy this chart link: ${url}`);
      }
      return;
    }
    if (target === "farcaster" && isMiniApp) {
      try {
        await sdk.actions.composeCast({ text: `${text}\n\ncreated with @viniapp`, embeds: [url] });
        return;
      } catch {
        setNote("Could not open the in-app composer. Opening the web composer.");
      }
    }
    const compose = new URL(target === "x" ? "https://x.com/intent/post" : "https://farcaster.xyz/~/compose");
    compose.searchParams.set("text", `${text}\n\ncreated with ${target === "x" ? "@viniapp_xyz" : "@viniapp"}`);
    compose.searchParams.set(target === "x" ? "url" : "embeds[]", url);
    window.open(compose.toString(), "_blank", "noopener,noreferrer");
  }
  const username = data?.profile.username;
  const years = data?.years || [new Date().getUTCFullYear()];
  const imageParams = data
    ? new URLSearchParams({ fid: data.profile.fid, period: data.period, end: data.anchor }).toString()
    : "";
  return (
    <main>
      <header className="topbar">
        <Link className="wordmark" href="/">
          <Mark />
          faralytics<span className="wordmark-dot">.</span>
        </Link>
        <div className="share-actions" role="group" aria-labelledby="share-heading">
          <p id="share-heading">a year worth sharing:</p>
          <div className="share-buttons">
            <button
              data-testid="share-farcaster"
              disabled={!data || busy || !!error}
              className="button-primary"
              onClick={() => void share("farcaster")}
            >
              Share on Farcaster
            </button>
            <button
              data-testid="share-x"
              aria-label="Share on X"
              disabled={!data || busy || !!error}
              onClick={() => void share("x")}
            >
              Share on X
            </button>
            <button
              data-testid="copy-link"
              disabled={!data || busy || !!error}
              aria-label="Copy chart link"
              onClick={() => void share("copy")}
            >
              <span>Copy link</span>
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
      </header>
      <section className="intro">
        <h1 className="eyebrow">Your year. One square at a time.</h1>
        <p>
          Every cast, like, and little connection.
          <br className="mobile-break" /> See how you show up on Farcaster.
        </p>
      </section>
      <form
        className="search-form"
        onSubmit={(event) => {
          event.preventDefault();
          void load(input, "365");
        }}
        aria-label="Look up Farcaster activity"
      >
        <AccountSearch value={input} onChange={setInput} onSelect={(fid) => void load(fid, "365")} busy={busy} />
        <div className="search-hint">
          <span>No sign-in. Just curiosity.</span>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              if (fid) void load(fid, "365");
              else {
                setNote("Enter your username or FID above. Inside Farcaster, My activity finds you automatically.");
                document.getElementById("username")?.focus();
              }
            }}
          >
            My activity <span aria-hidden="true">↗</span>
          </button>
        </div>
      </form>
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
          <div className="chart-layout">
            <div className="chart-card" data-testid="activity-card">
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
                    <Heatmap days={data.days} peak={data.peak} onSelect={setDay} />
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
                  <span>Busiest day:</span>
                  <strong className="busiest-date">{activityDate(data?.peakDate ?? null)}</strong>
                </div>
              </div>
            </div>
            <nav className="year-picker" aria-label="Activity year">
              <button
                data-testid="period-365"
                disabled={busy}
                aria-pressed={period === "365"}
                onClick={() => data && void load(data.profile.fid, "365")}
              >
                Last 365 days
              </button>
              {years.map((year) => (
                <button
                  data-testid={`year-${year}`}
                  key={year}
                  disabled={busy}
                  aria-pressed={period === String(year)}
                  onClick={() => data && void load(data.profile.fid, String(year), dateKey(new Date()))}
                >
                  {year}
                </button>
              ))}
            </nav>
          </div>
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
        <span>A little activity goes a long way.</span>
        <a href="https://viniapp.xyz" target="_blank" rel="noreferrer">
          created with <b>viniapp</b> ↗
        </a>
      </footer>
    </main>
  );
}
