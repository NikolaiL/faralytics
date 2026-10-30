"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { NumberText } from "./NumberText";
import type { LookupStats } from "~~/lib/lookup-stats";
const number = (value: string) => BigInt(value).toLocaleString("en-US");
const time = (value: string) => new Date(value).toLocaleString("en-GB", { timeZone: "UTC" });
const toolName = (tool: string) => tool.replace(/[-_]/g, " ").replace(/^./, (character) => character.toUpperCase());
export function StatsDashboard() {
  const [data, setData] = useState<LookupStats>();
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
      <Link className="stats-account" href={tool === "followers" ? `/followers?fids=${fid}` : `/?user=${fid}`}>
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
        Each FID counts once per chart session. Clearing a chart starts a new session.
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
          <section className="stats-panel" aria-labelledby="popular-heading">
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
          <section className="stats-panel" aria-labelledby="latest-heading">
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
                      <th>Who</th>
                      <th>Viewed</th>
                      <th>Tool</th>
                      <th>Session</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.latest.map((row) => (
                      <tr key={row.lookupId}>
                        <td>
                          <time dateTime={row.lastViewedAt}>
                            <NumberText>{time(row.lastViewedAt)}</NumberText>
                          </time>
                        </td>
                        <td data-label="Who">
                          {row.viewerFid ? profile(row.viewerFid) : <span className="stats-anonymous">Anonymous</span>}
                        </td>
                        <td data-label="Viewed">
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
        </>
      )}
    </main>
  );
}
