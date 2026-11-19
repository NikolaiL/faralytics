/* eslint-disable @next/next/no-img-element -- ImageResponse renders image elements. */
import "server-only";
import { OgLogo } from "~~/components/OgLogo";
import { loadAvatar } from "~~/lib/avatar";
import {
  liveEventAction,
  liveActionColors,
  liveMetricLabels,
  liveOgEventHeight,
  liveOgEvents,
  type LiveCounts,
  type LiveSnapshot,
} from "~~/lib/live-view";
import { relativeEventTime } from "~~/lib/follow-timeline";
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
  const capturedAt = snapshot.now
    ? Date.parse(snapshot.now)
    : Math.max(Date.parse(snapshot.totals.asOf), ...events.map((event) => Date.parse(event.timestamp)));
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
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 38, flexShrink: 0 }}
      >
        <OgLogo />
        <span style={{ fontSize: 32, fontWeight: 700 }}>
          Live View<span style={{ color: "#d6ff3f" }}>.</span>
        </span>
      </div>
      <span style={{ height: 28, marginTop: 8, fontSize: 20, lineHeight: "28px", color: "#ac9bbb", flexShrink: 0 }}>
        {snapshot.date} · metrics as of {snapshot.totals.asOf.slice(11, 19)} UTC
        {snapshot.profile
          ? ` · ${name(snapshot.profile)}${snapshot.direction === "target" ? " · incoming events" : snapshot.direction === "both" ? " · both directions" : ""}`
          : ""}
      </span>
      <div style={{ display: "flex", gap: 8, marginTop: 12, height: 120, flexShrink: 0 }}>
        {(Object.keys(liveMetricLabels) as (keyof LiveCounts)[]).map((key) => (
          <div
            key={key}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              alignItems: "center",
              textAlign: "center",
              flex: 1,
              minWidth: 0,
              height: 120,
              padding: "10px 8px",
              border: "1px solid #332840",
              borderRadius: 12,
              background: "#17121e",
            }}
          >
            <span style={{ fontSize: 18, lineHeight: "22px", color: "#ac9bbb" }}>{liveMetricLabels[key]}</span>
            <span style={{ fontSize: 34, lineHeight: "38px", fontWeight: 900, color: "#d6ff3f" }}>
              {snapshot.totals.today[key].toLocaleString("en-US")}
            </span>
            <span style={{ fontSize: 16, lineHeight: "22px", color: "#ac9bbb" }}>
              Yesterday {snapshot.totals.yesterday[key].toLocaleString("en-US")}
            </span>
          </div>
        ))}
      </div>
      <div
        style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16, padding: "0 24px", flexShrink: 0 }}
      >
        {events.map((event, index) => {
          const action = liveEventAction(event),
            quote = event.quotes?.[0];
          const reference = action.castHash
            ? `${action.connector}cast${action.target ? ` by ${name(action.target)}` : ""}`
            : action.profileAction && action.target
              ? ` ${name(action.target)}`
              : event.action === "mention"
                ? ` ${event.mentions.map(name).join(", ")}`
                : "";
          return (
            <div
              key={event.id}
              style={{
                display: "flex",
                width: "80%",
                alignSelf: index % 2 ? "flex-end" : "flex-start",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: liveOgEventHeight(event),
                  maxWidth: "100%",
                  padding: "14px",
                  border: "1px solid #332840",
                  borderRadius: 12,
                  background: "#1c1526",
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, height: 28, flexShrink: 0 }}>
                  {avatar(event.actor, 20)}
                  <span
                    style={{
                      display: "flex",
                      gap: 6,
                      fontSize: 22,
                      fontWeight: 700,
                      flexShrink: 1,
                      minWidth: 0,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    <span style={{ color: "#d7c1f4", flexShrink: 0 }}>{name(event.actor)}</span>
                    <span style={{ color: liveActionColors[event.action], flexShrink: 0 }}>{action.verb}</span>
                    {reference && (
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {reference.trim()}
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: 16, color: "#ac9bbb", flexShrink: 0 }}>
                    {relativeEventTime(event.timestamp, capturedAt)}
                  </span>
                </div>
                {event.text && (
                  <span
                    style={{
                      height: 26,
                      marginTop: 4,
                      fontSize: 22,
                      lineHeight: "26px",
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
                      height: 44,
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
                        fontSize: 20,
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
            </div>
          );
        })}
        {!events.length && (
          <span style={{ fontSize: 22, color: "#ac9bbb" }}>
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
          fontSize: 14,
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
