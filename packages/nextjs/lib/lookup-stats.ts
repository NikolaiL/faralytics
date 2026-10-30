export type LookupStats = {
  updatedAt: string;
  totals: { sessions: string; lookups: string; fids: string };
  latest: {
    lookupId: string;
    tool: string;
    startedAt: string;
    lastViewedAt: string;
    viewerFid: string | null;
    fids: string[];
    accountCount: string;
  }[];
  popular: { fid: string; lookups: string }[];
  topUsers: { fid: string; lookups: string }[];
  profiles: { fid: string; username: string | null; display_name: string | null }[];
  namesAvailable: boolean;
};
