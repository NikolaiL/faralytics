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
  const events = data.events.slice(0, compact ? 5 : 8);
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
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "16px 0", height: 42 }}
      >
        <span style={{ fontSize: 30 }}>Friendship</span>
        <div style={{ display: "flex", alignItems: "center", gap: 15, fontSize: 22 }}>
          {names.map((name, index) => (
            <div key={index} style={{ display: "flex", alignItems: "center", gap: 8, color: colors[index] }}>
              {avatars[index] ? (
                <img src={avatars[index]!} width={34} height={34} alt="" style={{ borderRadius: 17 }} />
              ) : (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    background: "#2a2037",
                    fontSize: 15,
                  }}
                >
                  {name.replace(/^@/, "").slice(0, 2)}
                </span>
              )}
              <span>{name}</span>
            </div>
          ))}
        </div>
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
      <div style={{ display: "flex", margin: "17px 0 7px", fontSize: 19 }}>Latest interactions</div>
      {events.map((event) => {
        const actor = event.actor === data.profiles[0].fid ? 0 : 1;
        return (
          <div
            key={event.hash}
            style={{
              display: "flex",
              alignItems: "center",
              height: compact ? 44 : 50,
              borderBottom: "1px solid #292131",
              fontSize: 18,
            }}
          >
            <span style={{ width: 310, color: colors[actor] }}>{names[actor]}</span>
            <span style={{ width: 265, color: "#ded0ec" }}>{friendshipLabels[event.action]}</span>
            <span style={{ width: 300, color: colors[1 - actor] }}>{names[1 - actor]}</span>
            <span style={{ marginLeft: "auto", color: "#b5a7c5", fontSize: 15 }}>
              {relativeEventTime(new Date(event.ts * 1000).toISOString(), ts)}
            </span>
          </div>
        );
      })}
      {!events.length && (
        <span style={{ color: "#b5a7c5", fontSize: 17, marginTop: 10 }}>No captured interactions</span>
      )}
      <div
        style={{ display: "flex", marginTop: "auto", justifyContent: "space-between", color: "#a497b2", fontSize: 13 }}
      >
        <span>Captured interactions · UTC</span>
        <span>{`created with viniapp · ${new Date(ts).toISOString().slice(0, 19).replace("T", " ")} UTC`}</span>
      </div>
    </div>
  );
}
