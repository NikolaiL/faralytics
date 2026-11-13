import assert from "node:assert/strict";
import { test } from "node:test";
import { casterMetrics, casterPath, casterRange, casterSelection, casterShareText, casterTitle, type CasterMetric, type TopCasters } from "../packages/nextjs/lib/top-casters.ts";

test("caster timeframes use inclusive UTC days and anchor yesterday separately", () => {
  const end="2026-11-12";
  for(const [period,start,through] of [
    ['today',end,end],['yesterday','2026-11-11','2026-11-11'],['days7','2026-11-06',end],
    ['days30','2026-10-14',end],['days365','2025-11-13',end],['all','2021-01-01',end],
  ]) assert.deepEqual(casterRange(casterSelection(new URLSearchParams({period,end}))),{start,through});
  assert.equal(casterRange(casterSelection(new URLSearchParams('period=days365&end=2024-03-01'))).start,'2023-03-03');
});
test("caster filters reject invalid input and preserve UInt64 identity in list shares",()=>{
  const selection=casterSelection(new URLSearchParams('user=18446744073709551615&period=yesterday&end=2026-11-12&metric=mentions_received'));
  const path=casterPath(selection,'1794450000000');
  assert.equal(path,'/top-casters?period=yesterday&end=2026-11-12&user=18446744073709551615&metric=mentions_received&ts=1794450000000');
  assert.deepEqual(casterSelection(new URLSearchParams(path.split('?')[1])),selection);
  for(const query of ['user=0','user=18446744073709551616','user=1 OR 1','period=week','metric=constructor','period=toString','end=2099-01-01','end=2026-02-30','user=1&user=2','ts=abc'])assert.throws(()=>casterSelection(new URLSearchParams(query)));
});

test("caster self-shares use the selected title, actual rank and platform credits", () => {
  const selection = {
    period: "all",
    end: "2026-11-12",
    user: "366713",
    metric: "likes_received",
  } as const;
  const data = {
    through: "2026-11-12",
    lists: [{ metric: "likes_received", userPosition: 276, rows: [] }],
  } as const;
  const review: Pick<
    import("../packages/nextjs/lib/top-casters.ts").TopCasters,
    "through" | "lists" | "profiles"
  > = {
    through: data.through,
    profiles: [],
    lists: [...data.lists].map((list) => ({ ...list, rows: [] })),
  };
  assert.equal(
    casterTitle(selection.metric, selection.period),
    "Top Casters · Most liked · All time",
  );
  assert.equal(
    casterShareText(selection, review, "farcaster", "366713"),
    "Top Casters · Most liked · All time\n\nI am ranked #276. How about you?\n\nfaralytics - created by @nikolaii.eth with @viniapp",
  );
  assert.ok(
    casterShareText(selection, review, "x", "366713").endsWith(
      "I am ranked #276. How about you?\n\nfaralytics - created by @NikolaiLeb with @viniapp_xyz",
    ),
  );
  assert.doesNotMatch(casterShareText(selection, review, "x", "366713"), /Through|UTC/);
  for (const viewer of [undefined, "3"])
    assert.ok(
      !casterShareText(selection, review, "farcaster", viewer).includes("I am"),
    );
  review.lists[0].userPosition = null;
  assert.ok(
    casterShareText(selection, review, "farcaster", "366713").includes(
      "I am unranked. How about you?",
    ),
  );
});

function shareFixture(
  metric: CasterMetric,
  position: number | null,
): Pick<TopCasters, "lists" | "profiles"> {
  const names: Record<number, string> = {
    1: "neynar",
    2: "clanker",
    3: "bizzarebeast",
    18: "lisashin",
    19: "nikolaii.eth",
    20: "adrienne",
  };
  const scores: Record<number, number> = {
    1: 1210,
    2: 990,
    3: 482,
    18: 69,
    19: 68,
    20: 67,
  };
  const all = Array.from({ length: 30 }, (_, index) => ({
    fid: position === index + 1 ? "366713" : String(index + 1),
    position: index + 1,
    score: scores[index + 1] ?? 100 - index,
  }));
  return {
    lists: [
      {
        metric,
        userPosition: position,
        rows: all.filter((row) =>
          !position || position <= 10
            ? row.position <= 10
            : row.position <= 5 || Math.abs(row.position - position) <= 2,
        ),
        nextRank: position === 10 ? all[10] : undefined,
      },
    ],
    profiles: all.map((row) => ({
      fid: row.fid,
      username: names[row.position] ?? `caster${row.position}`,
      display_name: null,
    })),
  };
}

test("all metric self-shares include top three and immediate neighbors with the requested copy", () => {
  for (const metric of Object.keys(casterMetrics) as CasterMetric[]) {
    const selection = {
      user: "366713",
      metric,
      period: "days7",
      end: "2026-11-13",
    } as const;
    const data = shareFixture(metric, 19);
    const text = casterShareText(selection, data, "farcaster", "366713");
    assert.equal(
      text,
      `Top Casters · ${casterMetrics[metric]} · 7 days\n#1 @neynar 1,210\n#2 @clanker 990\n#3 @bizzarebeast 482\n----------\n#18 @lisashin 69\n#19 @nikolaii.eth 68\n#20 @adrienne 67\n\nI am ranked #19. How about you?\n\nfaralytics - created by @nikolaii.eth with @viniapp`,
    );
    const x = casterShareText(selection, data, "x", "366713");
    assert.ok(x.includes("#1 neynar 1,210"));
    assert.ok(x.includes("#19 nikolaii.eth 68"));
    assert.ok(
      x.endsWith("faralytics - created by @NikolaiLeb with @viniapp_xyz"),
    );
    for (const viewer of [undefined, "3"])
      assert.equal(
        casterShareText(selection, data, "farcaster", viewer),
        `Top Casters · ${casterMetrics[metric]} · 7 days\n\nfaralytics - created by @nikolaii.eth with @viniapp`,
      );
  }
});

test("self-share positions avoid duplicates, preserve #11 beside #10, and handle missing neighbors", () => {
  const selection = {
    user: "366713",
    metric: "mentions_received",
    period: "days7",
    end: "2026-11-13",
  } as const;
  for (const [position, expected] of [
    [1, [1, 2, 3]],
    [2, [1, 2, 3]],
    [3, [1, 2, 3, 4]],
    [4, [1, 2, 3, 4, 5]],
    [5, [1, 2, 3, 4, 5, 6]],
    [6, [1, 2, 3, 5, 6, 7]],
    [10, [1, 2, 3, 9, 10, 11]],
    [11, [1, 2, 3, 10, 11, 12]],
    [30, [1, 2, 3, 29, 30]],
    [null, [1, 2, 3]],
  ] as const) {
    const text = casterShareText(
      selection,
      shareFixture(selection.metric, position),
      "farcaster",
      "366713",
    );
    assert.deepEqual(
      [...text.matchAll(/^#(\d+) /gm)].map((match) => Number(match[1])),
      expected,
    );
    assert.equal(
      text.includes("----------"),
      expected.some(
        (rank, index) => index > 0 && rank > expected[index - 1] + 1,
      ),
    );
    assert.ok(
      text.includes(position ? `I am ranked #${position}.` : "I am unranked."),
    );
  }
  const data = shareFixture(selection.metric, 19);
  data.profiles = [];
  assert.ok(
    casterShareText(selection, data, "farcaster", "366713").includes(
      "#19 FID 366713 68",
    ),
  );
});
