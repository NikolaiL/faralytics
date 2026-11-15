import "server-only";
import { OgLogo } from "~~/components/OgLogo";
import { liveMetricLabels, type LiveCounts, type LiveSnapshot } from "~~/lib/live-view";

export function LiveViewOg({ snapshot, height }: { snapshot: LiveSnapshot; height: number }) {
  const compact = height === 600;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: "36px 64px",
        background: "#0d0b12",
        color: "#f3eff9",
        fontFamily: "FaralyticsSans",
      }}
    >
      <OgLogo />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "22px 0" }}>
        <span style={{ fontSize: 42, fontWeight: 700, color: "#d6ff3f" }}>Farcaster today · Live View</span>
        <span style={{ fontSize: 20, color: "#ac9bbb" }}>
          {snapshot.date} · as of {snapshot.totals.asOf.slice(11, 19)} UTC
          {snapshot.profile
            ? ` · ${snapshot.profile.username ? `@${snapshot.profile.username}` : `FID ${snapshot.profile.fid}`}`
            : ""}
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {(Object.keys(liveMetricLabels) as (keyof LiveCounts)[]).map((key) => (
          <div
            key={key}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: compact ? 8 : 16,
              width: 346,
              padding: compact ? 18 : 24,
              border: "1px solid #332840",
              borderRadius: 14,
              background: "#17121e",
            }}
          >
            <span style={{ fontSize: 22, color: "#ac9bbb" }}>
              {liveMetricLabels[key]}
              {key === "dau" ? " · unique FIDs" : ""}
            </span>
            <span style={{ fontSize: compact ? 43 : 56, fontWeight: 700, color: "#d6ff3f" }}>
              {snapshot.totals.today[key].toLocaleString("en-US")}
            </span>
            <span style={{ fontSize: 17, color: "#ac9bbb" }}>
              Yesterday {snapshot.totals.yesterday[key].toLocaleString("en-US")}
            </span>
          </div>
        ))}
      </div>
      <div
        style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: "auto", fontSize: 14, color: "#ac9bbb" }}
      >
        <span>DAU counts unique FIDs with any captured action. Captured history is incomplete.</span>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>{snapshot.source.catchingUp ? "Source is catching up." : ""}</span>
          <span>created with viniapp</span>
        </div>
      </div>
    </div>
  );
}
