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
  const rowHeight = compact ? 64 : 100;
  const { actor, target } = data.filters;
  const incoming = !!target && !actor,
    outgoing = !!actor && !target;
  const name = (profile: Profile) => (profile.username ? `@${profile.username}` : `FID ${profile.fid}`);
  const shorten = (text: string, length: number) => (text.length > length ? text.slice(0, length - 1) + "…" : text);
  const heading = incoming
    ? "Thanks to my latest followers."
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
              top: 190 + (index % 5) * (rowHeight + 8),
              width: 524,
              height: rowHeight,
              background: "#17121f",
              border: "1px solid #30263d",
              borderRadius: 14,
              padding: "0 16px",
              gap: compact ? 4 : 9,
            }}
          >
            {pairs ? (
              <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: compact ? 4 : 9 }}>
                <div
                  style={{
                    display: "flex",
                    width: "100%",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 6,
                    fontSize: compact ? 16 : 18,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#b594ee" }}>
                    {avatar(event.actor, index, compact ? 26 : 34)}
                    <span>{shorten(name(event.actor), 17)}</span>
                  </div>
                  <span style={{ color: "#48d9ac", fontSize: 12 }}>followed</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#82b7ff" }}>
                    <span>{shorten(name(event.target), 17)}</span>
                    {avatar(event.target, index + 10, compact ? 26 : 34)}
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
                {avatar(profile, outgoing ? index + 10 : index, compact ? 40 : 52)}
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ color: "#b594ee", fontSize: compact ? 20 : 23, fontWeight: 700 }}>
                    {shorten(name(profile), 29)}
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
