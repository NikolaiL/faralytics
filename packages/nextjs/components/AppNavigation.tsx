import Link from "next/link";
export function AppNavigation({
  active,
  fids = [],
  end,
}: {
  active: "activity" | "followers";
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
    </nav>
  );
}
