/* eslint-disable @next/next/no-img-element -- ImageResponse renders image elements. */
import "server-only";
import { OgLogo } from "~~/components/OgLogo";
import { loadAvatar } from "~~/lib/avatar";
import { casterTitle, type CasterSelection } from "~~/lib/top-casters";
import { loadTopCasters } from "~~/lib/top-casters-data";

export async function prepareTopCastersOg(selection: CasterSelection, height: number) {
  const data = await loadTopCasters(selection);
  const metric = selection.metric || "casts";
  const list = data.lists.find((list) => list.metric === metric)!;
  const profiles = list.rows.map((row) => data.profiles.find((profile) => profile.fid === row.fid));
  const avatars = await Promise.all(
    profiles.map(async (profile) => {
      const bytes = await loadAvatar(profile?.pfp_url);
      return bytes ? `data:image/png;base64,${bytes.toString("base64")}` : null;
    }),
  );
  const compact = height === 600;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: "30px 64px",
        background: "#0d0b12",
        color: "#f3eff9",
        fontFamily: "FaralyticsSans",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <OgLogo />
      </div>
      <div style={{ display: "flex", flexDirection: "column", margin: "18px 0", gap: 8 }}>
        <span style={{ color: "#d6ff3f", fontSize: 38, fontWeight: 700 }}>{casterTitle(metric, selection.period)}</span>
        <span style={{ color: "#ac9bbb", fontSize: 17 }}>
          {data.start} – {data.through} UTC
          {selection.user
            ? ` · FID ${selection.user}${list.userPosition ? ` · #${list.userPosition.toLocaleString("en-US")}` : " · unranked"}`
            : ""}
        </span>
      </div>
      <div style={{ display: "flex", gap: 20 }}>
        {(list.rows.length > 5 ? [0, 5] : [0]).map((start) => (
          <div
            key={start}
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              minWidth: 0,
              borderRadius: 14,
              padding: "8px 14px",
              background: "#17121e",
              border: "1px solid #332840",
            }}
          >
            {list.rows.slice(start, start + 5).map((row, offset) => {
              const index = start + offset;
              const name = profiles[index]?.username ? `@${profiles[index]!.username}` : `FID ${row.fid}`;
              return (
                <div
                  key={row.fid}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    height: compact ? 66 : 102,
                    borderBottom: offset < 4 ? "1px solid #2d2338" : "1px solid transparent",
                    background: row.fid === selection.user ? "#30243d" : "transparent",
                  }}
                >
                  <span style={{ display: "flex", width: 70, fontSize: 20, color: "#ac9bbb" }}>
                    #{row.position.toLocaleString("en-US")}
                  </span>
                  {avatars[index] && (
                    <img src={avatars[index]!} width={32} height={32} alt="" style={{ borderRadius: 16 }} />
                  )}
                  <span
                    style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: 22,
                      fontWeight: 700,
                    }}
                  >
                    {name}
                  </span>
                  <span style={{ fontSize: 28, color: "#d6ff3f", fontWeight: 700 }}>
                    {row.score.toLocaleString("en-US")}
                  </span>
                </div>
              );
            })}
            {!list.rows.length && (
              <span style={{ color: "#ac9bbb", fontSize: 24, padding: 30 }}>No captured activity.</span>
            )}
          </div>
        ))}
      </div>
      <div
        style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: "auto", color: "#ac9bbb", fontSize: 13 }}
      >
        <span>
          Captured history is incomplete.{data.partialDay ? " Includes today’s partial UTC day." : ""} Equal counts
          ordered by FID.{data.catchingUp ? " Source catching up." : ""}
        </span>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Summary refreshed {data.updatedAt} UTC</span>
          <span>created with viniapp</span>
        </div>
      </div>
    </div>
  );
}
