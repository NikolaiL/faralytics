/* eslint-disable @next/next/no-img-element -- ImageResponse uses plain images. */
import { relativeEventTime } from "~~/lib/follow-timeline";
import { friendshipLabels, friendshipPeriods } from "~~/lib/friendship";
import type { loadFriendship } from "~~/lib/friendship-data";
import { OgLogo } from "./OgLogo";

const colors = ["#b596f2", "#82b7ff"];

export function FriendshipOg({
  data,
  avatars,
  height,
  ts,
}: {
  data: Awaited<ReturnType<typeof loadFriendship>>;
  avatars: (string | null)[];
  height: number;
  ts: number;
}) {
  const compact = height === 600;
  const names = data.profiles.map((profile) => {
    const name = profile.username ? `@${profile.username}` : `FID ${profile.fid}`;
    return name.length > 27 ? name.slice(0, 26) + "…" : name;
  });
  const events = data.events.slice(0, 10);
  const timelineHeight = compact ? 299 : 499;
  const firstTs = events[0]?.ts ?? 0;
  const duration = firstTs - (events.at(-1)?.ts ?? firstTs);
  const bubbleHeight = compact && events.length > 6 ? 26 : 40;
  const top = bubbleHeight / 2 + 2;
  const span = timelineHeight - top * 2;
  const dotY = (timestamp: number) => (duration ? top + ((firstTs - timestamp) / duration) * span : timelineHeight / 2);
  const bubbleY = (index: number) =>
    events.length > 1 ? top + (index / (events.length - 1)) * span : timelineHeight / 2;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: "34px 64px 28px",
        background: "#0d0b12",
        color: "#f3eff9",
        fontFamily: "FaralyticsSans",
      }}
    >
      <OgLogo />
      <div
        style={{
          display: "flex",
          position: "relative",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 10,
          height: 56,
        }}
      >
        {names.map((name, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              flexDirection: index === 0 ? "row" : "row-reverse",
              alignItems: "center",
              gap: 12,
              width: 390,
              color: colors[index],
              fontSize: 32,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 46,
                height: 46,
                flexShrink: 0,
                borderRadius: 23,
                border: "2px solid #855dcd",
                background: "#2a2037",
                fontSize: 18,
              }}
            >
              {avatars[index] ? (
                <img src={avatars[index]!} width={42} height={42} alt="" style={{ borderRadius: 21 }} />
              ) : (
                name.replace(/^@/, "").slice(0, 2)
              )}
            </div>
            <span
              style={{
                maxWidth: 332,
                fontWeight: 700,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {name}
            </span>
          </div>
        ))}
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 390,
            right: 390,
            justifyContent: "center",
            fontSize: 32,
            fontWeight: 700,
          }}
        >
          Friendship
        </div>
      </div>
      <div style={{ display: "flex", position: "relative", height: timelineHeight, margin: "8px 0" }}>
        {events.length > 0 && (
          <svg width={1072} height={timelineHeight} style={{ position: "absolute", top: 0, left: 0 }}>
            <line x1={536} x2={536} y1={4} y2={timelineHeight - 4} stroke="#41344f" strokeWidth={2} />
            {events.map((event, index) => {
              const actor = event.actor === data.profiles[0].fid ? 0 : 1;
              const x = actor === 0 ? 493 : 579;
              const midX = (536 + x) / 2;
              const startY = dotY(event.ts);
              const endY = bubbleY(index);
              return (
                <path
                  key={event.hash}
                  d={`M 536 ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${x} ${endY}`}
                  fill="none"
                  stroke={colors[actor]}
                  strokeWidth={1}
                />
              );
            })}
            {events.map((event) => (
              <circle
                key={event.hash}
                cx={536}
                cy={dotY(event.ts)}
                r={5}
                fill={colors[event.actor === data.profiles[0].fid ? 0 : 1]}
              />
            ))}
          </svg>
        )}
        {events.map((event, index) => {
          const actor = event.actor === data.profiles[0].fid ? 0 : 1;
          const y = bubbleY(index);
          return (
            <div
              key={event.hash}
              style={{
                display: "flex",
                position: "absolute",
                left: 0,
                top: y - bubbleHeight / 2,
                width: "100%",
                height: bubbleHeight,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  position: "absolute",
                  ...(actor === 0 ? { right: 579 } : { left: 579 }),
                  flexDirection: actor === 0 ? "row-reverse" : "row",

                  height: bubbleHeight,
                  alignItems: "center",
                  gap: 16,
                  padding: "0 16px",
                  border: `1px solid ${actor === 0 ? "#523b71" : "#2d4d6c"}`,
                  borderRadius: bubbleHeight / 2,
                  background: actor === 0 ? "#21172e" : "#142333",
                }}
              >
                <span style={{ color: colors[actor], fontSize: bubbleHeight === 26 ? 16 : 18, fontWeight: 700 }}>
                  {friendshipLabels[event.action]}
                </span>
                <span style={{ color: "#b5a7c5", fontSize: bubbleHeight === 26 ? 14 : 15 }}>
                  {relativeEventTime(new Date(event.ts * 1000).toISOString(), ts)}
                </span>
              </div>
            </div>
          );
        })}
        {!events.length && (
          <div
            style={{
              display: "flex",
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              color: "#b5a7c5",
              fontSize: 19,
            }}
          >
            No captured interactions
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        {friendshipPeriods.map(([period, label]) => {
          const [first, second] = data.profiles.map((profile) => data.counts[profile.fid]?.[period] ?? 0);
          return (
            <div
              key={period}
              style={{
                display: "flex",
                flex: 1,
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                padding: "12px 8px",
                border: "1px solid #332840",
                borderRadius: 10,
                background: "#191421",
              }}
            >
              <span style={{ fontSize: 16, color: "#b5a7c5" }}>{label}</span>
              <span style={{ fontSize: 30, fontWeight: 900 }}>{(first + second).toLocaleString("en-US")}</span>
              <div style={{ display: "flex", gap: 7, fontSize: 16, fontWeight: 900 }}>
                <span style={{ color: colors[0] }}>{first.toLocaleString("en-US")}</span>
                <span style={{ color: "#9586a6" }}>+</span>
                <span style={{ color: colors[1] }}>{second.toLocaleString("en-US")}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{ display: "flex", marginTop: "auto", justifyContent: "space-between", color: "#a497b2", fontSize: 13 }}
      >
        <span>Captured interactions · UTC</span>
        <span>{`created with viniapp · ${new Date(ts).toISOString().slice(0, 19).replace("T", " ")} UTC`}</span>
      </div>
    </div>
  );
}
