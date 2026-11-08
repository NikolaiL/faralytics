import Link from "next/link";
export function AppNavigation({
  active,
  fids = [],
  end,
}: {
  active: "activity" | "followers" | "follow-timeline" | "friendship" | "word-cloud";
  fids?: string[];
  end?: string;
}) {
  const activity = new URLSearchParams();
  if (fids[0]) activity.set("user", fids[0]);
  if (fids[1]) activity.set("compare", fids[1]);
  if (end) activity.set("end", end);
  const followers = new URLSearchParams();
  if (fids.length) followers.set("fids", fids.join(","));
  if (end) followers.set("end", end);
  const friendship = new URLSearchParams();
  if (fids[0]) friendship.set("first", fids[0]);
  if (fids[1]) friendship.set("second", fids[1]);
  return (
    <nav className="app-navigation" aria-label="Faralytics sections">
      <Link
        href={activity.size ? `/?${activity}` : "/"}
        aria-current={active === "activity" ? "page" : undefined}
        data-testid="tab-activity"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
        Activity
      </Link>
      <Link
        href={followers.size ? `/followers?${followers}` : "/followers"}
        aria-current={active === "followers" ? "page" : undefined}
        data-testid="tab-followers"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M3 3v18h18M5 17l5-6 4 2 7-9" />
        </svg>
        Followers
      </Link>
      <Link
        href={fids[0] ? `/follow-timeline?target=${fids[0]}` : "/follow-timeline"}
        aria-current={active === "follow-timeline" ? "page" : undefined}
        data-testid="tab-follow-timeline"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M7 3v18M11 6h10M11 12h7M11 18h10" />
          <circle cx="7" cy="6" r="2" />
          <circle cx="7" cy="18" r="2" />
        </svg>
        <span className="navigation-wide-label">Follow timeline</span>
        <span className="navigation-short-label">Timeline</span>
      </Link>
      <Link
        href={friendship.size ? `/friendship?${friendship}` : "/friendship"}
        aria-current={active === "friendship" ? "page" : undefined}
        data-testid="tab-friendship"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M12 20S3 14.5 3 8.8A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 9 1.8C21 14.5 12 20 12 20Z" />
        </svg>
        Friendship
      </Link>
      <Link
        href={fids[0] ? `/word-cloud?user=${fids[0]}` : "/word-cloud"}
        aria-current={active === "word-cloud" ? "page" : undefined}
        data-testid="tab-word-cloud"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M7 17h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.4 1A3.5 3.5 0 0 0 7 17Z" />
        </svg>
        Word Cloud
      </Link>
    </nav>
  );
}
