"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { NumberText } from "./NumberText";
import type { LookupStats } from "~~/lib/lookup-stats";
const number = (value: string) => BigInt(value).toLocaleString("en-US");
const time = (value: string) => new Date(value).toLocaleString("en-GB", { timeZone: "UTC" });
const relativeTime = (value: string, now: number) => {
  const seconds = Math.max(0, Math.floor((now - new Date(value).getTime()) / 1000));
  const [amount, unit] =
    seconds < 60
      ? [seconds, "second"]
      : seconds < 3600
        ? [Math.floor(seconds / 60), "minute"]
        : seconds < 86400
          ? [Math.floor(seconds / 3600), "hour"]
          : [Math.floor(seconds / 86400), "day"];
  return `${amount} ${unit}${amount === 1 ? "" : "s"} ago`;
};
const toolName = (tool: string) => tool.replace(/[-_]/g, " ").replace(/^./, (character) => character.toUpperCase());
export function StatsDashboard() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [data, setData] = useState<LookupStats>();
  const [tab, setTab] = useState<"latest" | "popular" | "users">("latest");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true,
      inFlight = false;
    const controller = new AbortController();
    async function refresh() {
      if (inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const response = await fetch("/api/stats", {
          cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]),
        });
        if (!response.ok) throw new Error("Stats unavailable");
        const result = (await response.json()) as LookupStats;
        if (active) {
          setData(result);
          setError("");
        }
      } catch {
        if (active) setError("Could not refresh stats. Retrying automatically.");
      } finally {
        inFlight = false;
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 10000);
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  function profile(fid: string, tool = "activity") {
    const account = data?.profiles.find((profile) => profile.fid === fid);
    const label = account?.username ? `@${account.username}` : account?.display_name || `FID ${fid}`;
    return (
      <Link
        className="stats-account"
        href={
          tool === "followers"
            ? `/followers?fids=${fid}`
            : tool === "follow-timeline"
              ? `/follow-timeline?target=${fid}`
              : `/?user=${fid}`
        }
      >
        <span>{account?.username || account?.display_name ? label : <NumberText>{label}</NumberText>}</span>
        {account?.username || account?.display_name ? (
          <small>
            FID <NumberText>{fid}</NumberText>
          </small>
        ) : null}
      </Link>
    );
  }
  return (
    <main className="stats-page">
      <header className="topbar">
        <Link className="wordmark" href="/">
          faralytics.
        </Link>
        <span className="stats-live">
          <i />
          Live · updates every <NumberText>10</NumberText>s
        </span>
      </header>
      <h1>Lookup activity</h1>
      <p className="stats-description">
        Each FID counts once per lookup session. Clearing all selected accounts starts a new session.
      </p>
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Loading lookup stats…</p>}
      {data && (
        <>
          <div className="stats-overview">
            {[
              ["Chart sessions", data.totals.sessions],
              ["FID lookups", data.totals.lookups],
              ["Different FIDs", data.totals.fids],
            ].map(([label, value]) => (
              <div key={label}>
                <strong>
                  <NumberText>{number(value)}</NumberText>
                </strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <p className="stats-updated">
            Updated <NumberText>{time(data.updatedAt)}</NumberText> UTC
          </p>
          {!data.namesAvailable && <p className="notice">Account names are temporarily unavailable. Showing FIDs.</p>}
          <div className="stats-tabs" role="tablist" aria-label="Lookup statistics">
            {(
              [
                ["latest", "Latest"],
                ["popular", "Most looked up"],
                ["users", "Top users"],
              ] as const
            ).map(([key, label], index, tabs) => (
              <button
                key={key}
                type="button"
                role="tab"
                id={`stats-tab-${key}`}
                aria-selected={tab === key}
                aria-controls={`stats-panel-${key}`}
                tabIndex={tab === key ? 0 : -1}
                onClick={() => setTab(key)}
                onKeyDown={(event) => {
                  const next =
                    event.key === "ArrowRight"
                      ? (index + 1) % tabs.length
                      : event.key === "ArrowLeft"
                        ? (index + tabs.length - 1) % tabs.length
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? tabs.length - 1
                            : -1;
                  if (next < 0) return;
                  event.preventDefault();
                  setTab(tabs[next][0]);
                  document.getElementById(`stats-tab-${tabs[next][0]}`)?.focus();
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <section
            className="stats-panel"
            id="stats-panel-popular"
            role="tabpanel"
            aria-labelledby="stats-tab-popular"
            hidden={tab !== "popular"}
          >
            <h2 id="popular-heading">Most looked-up FIDs</h2>
            <p>
              All-time chart sessions · top <NumberText>20</NumberText>
            </p>
            {data.popular.length ? (
              <ol className="stats-ranking">
                {data.popular.map((row, index) => (
                  <li key={row.fid}>
                    <span className="stats-rank">
                      <NumberText>{String(index + 1)}</NumberText>
                    </span>
                    {profile(row.fid)}
                    <strong>
                      <NumberText>{number(row.lookups)}</NumberText>
                      <small>sessions</small>
                    </strong>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No lookups recorded yet.</p>
            )}
          </section>
          <section
            className="stats-panel"
            id="stats-panel-latest"
            role="tabpanel"
            aria-labelledby="stats-tab-latest"
            hidden={tab !== "latest"}
          >
            <h2 id="latest-heading">Latest lookups</h2>
            <p>
              Latest <NumberText>50</NumberText> sessions · most recently updated first · UTC
            </p>
            {data.latest.length ? (
              <div className="stats-table-scroll">
                <table className="stats-table">
                  <thead>
                    <tr>
                      <th>Last viewed</th>
                      <th>Looked up by</th>
                      <th>Viewed accounts</th>
                      <th>Tool</th>
                      <th>Session</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.latest.map((row) => (
                      <tr key={row.lookupId}>
                        <td>
                          <time dateTime={row.lastViewedAt} title={`${time(row.lastViewedAt)} UTC`}>
                            <NumberText>{relativeTime(row.lastViewedAt, now)}</NumberText>
                          </time>
                        </td>
                        <td data-label="Looked up by">
                          {row.viewerFid ? profile(row.viewerFid) : <span className="stats-anonymous">Anonymous</span>}
                        </td>
                        <td data-label="Viewed accounts">
                          <div className="stats-viewed">
                            {row.fids.map((fid) => (
                              <div key={fid}>{profile(fid, row.tool)}</div>
                            ))}
                            {Number(row.accountCount) > row.fids.length && (
                              <span>
                                +<NumberText>{String(Number(row.accountCount) - row.fids.length)}</NumberText> more
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`stats-tool ${row.tool === "activity" ? "tool-activity" : row.tool === "followers" ? "tool-followers" : ""}`}
                          >
                            {toolName(row.tool)}
                          </span>
                        </td>
                        <td>
                          <code title={row.lookupId}>{row.lookupId.slice(0, 8)}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No lookups recorded yet.</p>
            )}
          </section>
          <section
            className="stats-panel"
            id="stats-panel-users"
            role="tabpanel"
            aria-labelledby="stats-tab-users"
            hidden={tab !== "users"}
          >
            <h2>Top users</h2>
            <p>
              Ranked by chart sessions initiated · top <NumberText>20</NumberText> identified viewers. Anonymous
              sessions are not attributed to an identified user.
            </p>
            {data.topUsers.length ? (
              <ol className="stats-ranking">
                {data.topUsers.map((row, index) => (
                  <li key={row.fid}>
                    <span className="stats-rank">
                      <NumberText>{String(index + 1)}</NumberText>
                    </span>
                    {profile(row.fid)}
                    <strong>
                      <NumberText>{number(row.lookups)}</NumberText>
                      <small>initiated</small>
                    </strong>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No identified viewers yet.</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
