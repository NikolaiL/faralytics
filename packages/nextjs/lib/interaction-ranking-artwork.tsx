/* eslint-disable @next/next/no-img-element -- ImageResponse renders image elements. */
import "server-only";
import { OgLogo } from "~~/components/OgLogo";
import { loadAvatar } from "~~/lib/avatar";
import { friendshipPeriods } from "~~/lib/friendship";
import { interactionMetrics, type InteractionPeriod, type InteractionMetric } from "~~/lib/interaction-ranking";
import { readInteractionRanking } from "~~/lib/interaction-ranking-data";

export async function prepareRankingArtwork(
  fid: string,
  period: InteractionPeriod,
  metric: InteractionMetric,
  height: number,
) {
  const compact = height === 600;
  const data = await readInteractionRanking(fid);
  const rows = data.rankings[period][metric].slice(0, 10);
  const profiles = rows.map((row) => data.profiles.find((profile) => profile.fid === row.fid));
  const avatars = await Promise.all(
    [data.profile, ...profiles].map(async (profile) => {
      const bytes = await loadAvatar(profile?.pfp_url).catch(() => null);
      return bytes ? `data:image/png;base64,${bytes.toString("base64")}` : null;
    }),
  );
  const label = friendshipPeriods.find(([key]) => key === period)?.[1];
  const name = (username: string | null | undefined, id: string) =>
    username ? `@${username.length > 26 ? username.slice(0, 25) + "…" : username}` : `FID ${id}`;
  const avatar = (index: number, size: number) =>
    avatars[index] ? (
      <img src={avatars[index]!} width={size} height={size} alt="" style={{ borderRadius: size / 2 }} />
    ) : (
      <div style={{ display: "flex", width: size, height: size, borderRadius: size / 2, background: "#30243d" }} />
    );
  const artwork = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: compact ? "20px 64px 16px" : "36px 64px 28px",
        background: "#0d0b12",
        color: "#f3eff9",
        fontFamily: "FaralyticsSans",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <OgLogo />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "#b596f2",
            fontSize: 37.5,
            fontWeight: 700,
          }}
        >
          {avatar(0, 54)}
          <span style={{ maxWidth: 750, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {name(data.profile.username, fid)}
          </span>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          margin: compact ? "10px 0" : "20px 0",
        }}
      >
        <span style={{ fontSize: 32, fontWeight: 700 }}>Top interactions</span>
        <span
          style={{ color: "#cbb7e7", fontSize: 19 }}
        >{`${label} · Ranked by ${interactionMetrics[metric].toLowerCase()}`}</span>
      </div>
      {rows.length > 0 && (
        <div style={{ display: "flex", gap: 20, justifyContent: "center" }}>
          {(rows.length > 5 ? [0, 5] : [0]).map((start) => (
            <div
              key={start}
              style={{
                display: "flex",
                flexDirection: "column",
                width: 526,
                padding: "7px 16px",
                background: "#17121e",
                border: "1px solid #332840",
                borderRadius: 14,
              }}
            >
              {rows.slice(start, start + 5).map((row, offset) => {
                const index = start + offset;
                return (
                  <div
                    key={row.fid}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      height: compact ? 82 : 112,
                      borderBottom:
                        offset < 4 && index < rows.length - 1 ? "1px solid #2d2338" : "1px solid transparent",
                      gap: 12,
                    }}
                  >
                    <span style={{ width: 35, flexShrink: 0, color: "#ac9bbb", fontSize: 24, fontWeight: 900 }}>
                      {index + 1}
                    </span>
                    {avatar(index + 1, compact ? 31 : 42)}
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: "#e9dff6",
                        fontSize: compact ? 22.8 : 26.4,
                        fontWeight: 700,
                      }}
                    >
                      {name(profiles[index]?.username, row.fid)}
                    </span>
                    <span style={{ flexShrink: 0, fontSize: compact ? 31.5 : 39, color: "#d6ff3f", fontWeight: 900 }}>
                      {row[metric].toLocaleString("en-US")}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
      {!rows.length && (
        <span style={{ color: "#ac9bbb", fontSize: 22 }}>No captured interactions for this selection.</span>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "auto",
          color: "#a497b2",
          fontSize: 13,
        }}
      >
        <span>Captured interactions · UTC</span>
        <span>created with viniapp</span>
      </div>
    </div>
  );
  return { artwork, profile: data.profile, rows, label };
}
