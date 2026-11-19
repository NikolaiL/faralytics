/* eslint-disable @next/next/no-img-element -- ImageResponse renders image elements. */
import "server-only";
import { OgLogo } from "~~/components/OgLogo";
import { loadAvatar } from "~~/lib/avatar";
import {
  liveEventAction,
  liveMetricLabels,
  liveOgEventHeight,
  liveOgEvents,
  type LiveCounts,
  type LiveSnapshot,
} from "~~/lib/live-view";
import type { Profile } from "~~/lib/activity";
const name = (profile: Profile) => (profile.username ? `@${profile.username}` : `FID ${profile.fid}`);
const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();

export async function prepareLiveViewOg(snapshot: LiveSnapshot, height: number) {
  const events = liveOgEvents(snapshot.events ?? [], height);
  const profiles = [
    ...new Map(
      events
        .flatMap((event) => [event.actor, ...(event.quotes?.[0] ? [event.quotes[0].author] : [])])
        .map((profile) => [profile.fid, profile]),
    ).values(),
  ];
  const entries = await Promise.all(
    profiles.map(async (profile) => {
      const bytes = await loadAvatar(profile.pfp_url);
      return [profile.fid, bytes ? `data:image/png;base64,${bytes.toString("base64")}` : null] as const;
    }),
  );
  return <LiveViewOg snapshot={snapshot} height={height} avatars={Object.fromEntries(entries)} />;
}
export function LiveViewOg({
  snapshot,
  height,
  avatars = {},
}: {
  snapshot: LiveSnapshot;
  height: number;
  avatars?: Record<string, string | null>;
}) {
  const events = liveOgEvents(snapshot.events ?? [], height);
  const avatar = (profile: Profile, size: number) =>
    avatars[profile.fid] ? (
      <img
        src={avatars[profile.fid]!}
        width={size}
        height={size}
        alt=""
        style={{ borderRadius: size / 2, flexShrink: 0 }}
      />
    ) : (
      <div style={{ width: size, height: size, borderRadius: size / 2, background: "#3f2a61", flexShrink: 0 }} />
    );
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: "28px 64px",
        background: "#0d0b12",
        color: "#f3eff9",
        fontFamily: "FaralyticsSans",
      }}
    >
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 32, flexShrink: 0 }}
      >
        <OgLogo />
        <span style={{ fontSize: 26, fontWeight: 700 }}>
          Live View<span style={{ color: "#d6ff3f" }}>.</span>
        </span>
      </div>
      <span style={{ height: 22, marginTop: 8, fontSize: 16, lineHeight: "22px", color: "#ac9bbb", flexShrink: 0 }}>
        {snapshot.date} · metrics as of {snapshot.totals.asOf.slice(11, 19)} UTC
        {snapshot.profile
          ? ` · ${name(snapshot.profile)}${snapshot.direction === "target" ? " · incoming events" : snapshot.direction === "both" ? " · both directions" : ""}`
          : ""}
      </span>
      <div style={{ display: "flex", gap: 8, marginTop: 12, height: 84, flexShrink: 0 }}>
        {(Object.keys(liveMetricLabels) as (keyof LiveCounts)[]).map((key) => (
          <div
            key={key}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              flex: 1,
              minWidth: 0,
              height: 84,
              padding: "8px 12px",
              border: "1px solid #332840",
              borderRadius: 12,
              background: "#17121e",
            }}
          >
            <span style={{ fontSize: 13, lineHeight: "14px", color: "#ac9bbb" }}>
              {liveMetricLabels[key]}
              {key === "dau" ? " · unique FIDs" : ""}
            </span>
            <span style={{ fontSize: 26, lineHeight: "30px", fontWeight: 900, color: "#d6ff3f" }}>
              {snapshot.totals.today[key].toLocaleString("en-US")}
            </span>
            <span style={{ fontSize: 11, lineHeight: "14px", color: "#ac9bbb" }}>
              Yesterday {snapshot.totals.yesterday[key].toLocaleString("en-US")}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12, flexShrink: 0 }}>
        {events.map((event) => {
          const action = liveEventAction(event),
            quote = event.quotes?.[0];
          const heading = `${name(event.actor)} ${action.verb}${action.castHash ? `${action.connector}cast${action.target ? ` by ${name(action.target)}` : ""}` : action.profileAction && action.target ? ` ${name(action.target)}` : event.action === "mention" ? ` ${event.mentions.map(name).join(", ")}` : ""}`;
          return (
            <div
              key={event.id}
              style={{
                display: "flex",
                flexDirection: "column",
                height: liveOgEventHeight(event),
                padding: "9px 12px",
                border: "1px solid #332840",
                borderRadius: 12,
                background: "#1c1526",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, height: 20, flexShrink: 0 }}>
                {avatar(event.actor, 20)}
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    flex: 1,
                    minWidth: 0,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {heading}
                </span>
                <span style={{ fontSize: 10, color: "#ac9bbb", flexShrink: 0 }}>
                  {event.timestamp.slice(11, 19)} UTC
                </span>
              </div>
              {event.text && (
                <span
                  style={{
                    height: 18,
                    marginTop: 4,
                    fontSize: 15,
                    lineHeight: "18px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    flexShrink: 0,
                  }}
                >
                  {oneLine(event.text)}
                </span>
              )}
              {quote && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    height: 34,
                    marginTop: 6,
                    padding: "6px 9px",
                    borderLeft: "3px solid #855dcd",
                    borderRadius: 6,
                    background: "#120e19",
                    flexShrink: 0,
                  }}
                >
                  {avatar(quote.author, 16)}
                  <span
                    style={{
                      fontSize: 13,
                      flex: 1,
                      minWidth: 0,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {name(quote.author)}: {oneLine(quote.text ?? "Quoted cast is unavailable in captured history.")}
                    {(event.quotes?.length ?? 0) > 1 ? ` (+${event.quotes!.length - 1} more quotes)` : ""}
                  </span>
                </div>
              )}
            </div>
          );
        })}
        {!events.length && (
          <span style={{ fontSize: 17, color: "#ac9bbb" }}>
            {snapshot.events ? "No recent events for these filters." : "This snapshot contains daily metrics only."}
          </span>
        )}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          height: 24,
          marginTop: "auto",
          fontSize: 11,
          color: "#ac9bbb",
          flexShrink: 0,
        }}
      >
        <span>Captured history is incomplete.{snapshot.source.catchingUp ? " Source is catching up." : ""}</span>
        <span>created with viniapp</span>
      </div>
    </div>
  );
}
