import Link from "next/link";
import { AvatarImage } from "./AvatarImage";
import { NumberText } from "./NumberText";
import { casterMetrics, type CasterList, type TopCasters } from "~~/lib/top-casters";

export function TopCasterList({
  list,
  profiles,
  user,
  children,
}: {
  list: CasterList;
  profiles: TopCasters["profiles"];
  user?: string;
  children?: React.ReactNode;
}) {
  const userProfile = profiles.find((profile) => profile.fid === user);
  return (
    <section className="timeline-feed caster-card" aria-labelledby={`caster-${list.metric}`}>
      <div className="caster-card-heading">
        <h2 id={`caster-${list.metric}`}>{casterMetrics[list.metric]}</h2>
        <span className="captured-badge">
          {user && list.userPosition === null
            ? "Top 10 · unranked"
            : user && list.userPosition! > 10
              ? "Top 5 + your position"
              : "Top 10"}
        </span>
      </div>
      <ol className="interaction-ranking">
        {list.rows.map((row, index) => {
          const profile = profiles.find((profile) => profile.fid === row.fid);
          const name = profile?.username ? `@${profile.username}` : `FID ${row.fid}`;
          return (
            <li
              key={row.fid}
              value={row.position}
              className={`${row.fid === user ? "caster-self" : ""} ${index > 0 && row.position > list.rows[index - 1].position + 1 ? "caster-gap" : ""}`}
              aria-label={`Position ${row.position}, ${name}, ${row.score.toLocaleString("en-US")}${row.fid === user ? ", you" : ""}`}
            >
              <span className="interaction-rank">
                <NumberText>{String(row.position)}</NumberText>
              </span>
              <Link className="timeline-account" href={`/?user=${row.fid}`}>
                <span className="timeline-avatar">
                  {name.replace("@", "").slice(0, 2).toUpperCase()}
                  <AvatarImage source={profile?.pfp_url} size={32} />
                </span>
                <span className="caster-name">
                  {name}
                  {row.fid === user && <small>You</small>}
                </span>
              </Link>
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
