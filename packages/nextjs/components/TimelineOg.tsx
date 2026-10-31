/* eslint-disable @next/next/no-img-element -- ImageResponse renders plain image elements. */
import { OgLogo } from "./OgLogo";
import { NumberText } from "./NumberText";
import { relativeEventTime } from "~~/lib/follow-timeline";
import type { Profile } from "~~/lib/activity";
import type { TimelineShareData } from "~~/lib/timeline-share";

export function TimelineOg({
  data,
  height,
  avatars = [],
}: {
  data: TimelineShareData;
  height: number;
  avatars?: (string | null)[];
}) {
  const compact = height === 600;
  const { actor, target } = data.filters;
  const global = !actor && !target;
  const rowHeight = compact ? (global ? 70 : 64) : 100;
  const rowGap = compact && global ? 4 : 8;
  const rowTop = compact && global ? 180 : 190;
  const incoming = !!target && !actor,
    outgoing = !!actor && !target;
  const name = (profile: Profile) => (profile.username ? `@${profile.username}` : `FID ${profile.fid}`);
  const shorten = (text: string, length: number) => (text.length > length ? text.slice(0, length - 1) + "…" : text);
  const heading = incoming
    ? `Latest followers of ${name(target!)}`
    : actor
      ? `Latest followings by ${name(actor)}`
      : "Latest global followings.";
  const header = target || actor;
  function avatar(profile: Profile, index: number, size: number) {
    return (
      <div
        style={{
          display: "flex",
          width: size,
          height: size,
          flexShrink: 0,
          borderRadius: "50%",
          background: "#30243d",
          color: "#b594ee",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 15,
        }}
      >
        {avatars[index] ? (
          <img src={avatars[index]!} width={size} height={size} alt="" style={{ borderRadius: "50%" }} />
        ) : (
          (profile.username || "fc").slice(0, 2)
        )}
      </div>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#0d0b12",
        color: "#f3eff9",
        fontFamily: "FaralyticsSans",
      }}
    >
      <div style={{ display: "flex", position: "absolute", top: 36, left: 64 }}>
        <OgLogo />
      </div>
      {header && (
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 34,
            right: 64,
            alignItems: "center",
            gap: 12,
            color: "#d6ff3f",
            fontSize: 24,
          }}
        >
          {avatar(header, target ? 21 : 20, 38)}
          <span>{shorten(name(header), 35)}</span>
        </div>
      )}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 64,
          top: 98,
          fontSize: heading.length > 50 ? 27 : 36,
          fontWeight: 700,
        }}
      >
        {shorten(heading, 72)}
      </div>
      <div style={{ display: "flex", position: "absolute", left: 64, top: 147, fontSize: 15, color: "#a99aba" }}>
        {actor && target ? `Following ${name(target)}` : "Every new connection, a little more Farcaster."}
      </div>
      {data.events.map((event, index) => {
        const profile = outgoing ? event.target : event.actor;
        const pairs = !incoming && !outgoing;
        return (
          <div
            key={event.id}
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              position: "absolute",
              left: 64 + (index >= 5 ? 548 : 0),
              top: rowTop + (index % 5) * (rowHeight + rowGap),
              width: 524,
              height: rowHeight,
              background: "#17121f",
              borderRadius: 14,
              padding: global ? 0 : "0 16px",
              gap: compact ? 4 : 9,
            }}
          >
            {global ? (
              <div style={{ display: "flex", position: "relative", width: 524, height: rowHeight }}>
                <div
                  style={{
                    display: "flex",
                    position: "absolute",
                    left: 16,
                    top: (rowHeight - (compact ? 52 : 72)) / 2,
                  }}
                >
                  {avatar(event.actor, index, compact ? 52 : 72)}
                </div>
                <div
                  style={{
                    display: "flex",
                    position: "absolute",
                    right: 16,
                    top: (rowHeight - (compact ? 52 : 72)) / 2,
                  }}
                >
                  {avatar(event.target, index + 10, compact ? 52 : 72)}
                </div>
                <div
                  style={{
                    display: "flex",
                    position: "absolute",
                    left: compact ? 78 : 98,
                    top: compact ? 4 : 8,
                    maxWidth: compact ? 368 : 328,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    color: "#b594ee",
                    fontSize: compact ? 18 : 22,
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  {shorten(name(event.actor), 26)}
                </div>
                <div
                  style={{
                    display: "flex",
                    position: "absolute",
                    right: compact ? 78 : 98,
                    bottom: compact ? 4 : 8,
                    maxWidth: compact ? 368 : 328,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    color: "#82b7ff",
                    fontSize: compact ? 18 : 22,
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  {shorten(name(event.target), 26)}
                </div>
                <div
                  style={{
                    display: "flex",
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: 524,
                    height: rowHeight,
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: compact ? 2 : 3,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      color: "#48d9ac",
                      fontSize: compact ? 12 : 14,
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    followed
                  </div>
                  <div style={{ display: "flex", color: "#a99aba", fontSize: compact ? 11 : 12, lineHeight: 1 }}>
                    <NumberText preserveSpaces>
                      {relativeEventTime(event.timestamp, Date.parse(data.generatedAt))}
                    </NumberText>
                  </div>
                </div>
              </div>
            ) : pairs ? (
              <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: compact ? 4 : 9 }}>
                <div
                  style={{
                    display: "flex",
                    width: "100%",
                    alignItems: "center",
                    fontSize: compact ? 18 : 21,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      width: "44%",
                      flexShrink: 0,
                      alignItems: "center",
                      gap: 7,
                      color: "#b594ee",
                    }}
                  >
                    {avatar(event.actor, index, compact ? 32 : 42)}
                    <span
                      style={{
                        maxWidth: compact ? 174 : 164,
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {shorten(name(event.actor), 15)}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      width: "12%",
                      flexShrink: 0,
                      justifyContent: "center",
                      color: "#48d9ac",
                      fontSize: 12,
                    }}
                  >
                    followed
                  </div>
                  <div
                    style={{
                      display: "flex",
                      width: "44%",
                      flexShrink: 0,
                      justifyContent: "flex-end",
                      alignItems: "center",
                      gap: 7,
                      color: "#82b7ff",
                    }}
                  >
                    <span
                      style={{
                        maxWidth: compact ? 174 : 164,
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {shorten(name(event.target), 15)}
                    </span>
                    {avatar(event.target, index + 10, compact ? 32 : 42)}
                  </div>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "center", color: "#a99aba", fontSize: compact ? 12 : 15 }}
                >
                  <NumberText preserveSpaces>
                    {relativeEventTime(event.timestamp, Date.parse(data.generatedAt))}
                  </NumberText>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {avatar(profile, outgoing ? index + 10 : index, compact ? 52 : 68)}
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ color: "#b594ee", fontSize: compact ? 26 : 30, fontWeight: 700 }}>
                    {shorten(name(profile), 26)}
                  </span>
                  <div style={{ display: "flex", color: "#a99aba", fontSize: compact ? 14 : 17 }}>
                    <NumberText preserveSpaces>
                      {relativeEventTime(event.timestamp, Date.parse(data.generatedAt))}
                    </NumberText>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {!data.events.length && (
        <div style={{ display: "flex", position: "absolute", left: 64, top: 250, fontSize: 26, color: "#a99aba" }}>
          No captured follows yet.
        </div>
      )}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 64,
          right: 64,
          bottom: 20,
          justifyContent: "space-between",
          fontSize: 12,
          color: "#857594",
        }}
      >
        <span>Latest captured follows · UTC</span>
        <NumberText
          preserveSpaces
        >{`created with viniapp · ${data.generatedAt.slice(0, 19).replace("T", " ")} UTC`}</NumberText>
      </div>
    </div>
  );
}
