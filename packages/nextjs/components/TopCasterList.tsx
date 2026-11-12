"use client";
import { sdk } from "@farcaster/miniapp-sdk";
import { AvatarImage } from "./AvatarImage";
import { useMiniapp } from "./MiniappProvider";
import { NumberText } from "./NumberText";
import { casterMetrics, type CasterList, type TopCasters } from "~~/lib/top-casters";

export function TopCasterList({
  list,
  profiles,
  user,
  viewerFid,
  onSelect,
  children,
}: {
  list: CasterList;
  profiles: TopCasters["profiles"];
  user?: string;
  viewerFid?: string;
  onSelect: (fid: string) => void;
  children?: React.ReactNode;
}) {
  const { isMiniApp } = useMiniapp();
  const userProfile = profiles.find((profile) => profile.fid === user);
  const own = !!user && user === viewerFid;
  return (
    <section className="timeline-feed caster-card" aria-labelledby={`caster-${list.metric}`}>
      <div className="caster-card-heading">
        <h2 id={`caster-${list.metric}`}>{casterMetrics[list.metric]}</h2>
        <span className="captured-badge">
          {user && list.userPosition === null
            ? "Top 10 · unranked"
            : user && list.userPosition! > 10
              ? `Top 5 + ${own ? "your" : "their"} position`
              : "Top 10"}
        </span>
      </div>
      <ol className="interaction-ranking">
        {list.rows.map((row, index) => {
          const profile = profiles.find((profile) => profile.fid === row.fid);
          const name = profile?.username ? `@${profile.username}` : `FID ${row.fid}`;
          const profileUrl = `https://farcaster.xyz/${profile?.username || `~/profiles/${row.fid}`}`;
          return (
            <li
              key={row.fid}
              value={row.position}
              className={`${row.fid === user ? "caster-self" : ""} ${index > 0 && row.position > list.rows[index - 1].position + 1 ? "caster-gap" : ""}`}
              aria-label={`Position ${row.position}, ${name}, ${row.score.toLocaleString("en-US")}${row.fid === user ? (own ? ", you" : ", selected account") : ""}`}
            >
              <span className="interaction-rank">
                <NumberText>{String(row.position)}</NumberText>
              </span>
              <span className="caster-account">
                <button
                  type="button"
                  className="timeline-account"
                  aria-label={`Show rankings for ${name}`}
                  onClick={() => onSelect(row.fid)}
                >
                  <span className="result-avatar timeline-avatar" aria-hidden="true">
                    <AvatarImage source={profile?.pfp_url} size={32} />
                  </span>
                  <span className="caster-name">
                    {name}
                    {row.fid === user && <small>{own ? "You" : "Selected account"}</small>}
                  </span>
                </button>
                <a
                  className="caster-profile-link"
                  href={profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${name} on Farcaster`}
                  title="Open Farcaster profile"
                  onClick={(event) => {
                    if (!isMiniApp) return;
                    event.preventDefault();
                    const fid = Number(row.fid);
                    void (
                      Number.isSafeInteger(fid) ? sdk.actions.viewProfile({ fid }) : sdk.actions.openUrl(profileUrl)
                    )
                      .catch(() => sdk.actions.openUrl(profileUrl))
                      .catch(() => {});
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M14 3h7v7m0-7L10 14M10 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-4" />
                  </svg>
                </a>
              </span>
              <strong>
                <NumberText>{row.score.toLocaleString("en-US")}</NumberText>
              </strong>
            </li>
          );
        })}
      </ol>
      {!list.rows.length && <p className="empty-note">No captured activity in this category.</p>}
      {user && list.userPosition === null && (
        <p className="timeline-note">
          {userProfile?.username ? `@${userProfile.username}` : `FID ${user}`} is unranked: no captured activity in this
          category for the selected period.
        </p>
      )}
      {children}
    </section>
  );
}
