import assert from "node:assert/strict";
import test from "node:test";
import { formatYearReviewPostTime, yearReviewEnd, yearReviewPath, yearReviewShareText } from "../packages/nextjs/lib/year-review.ts";

test("year review uses complete UTC days and stops at the end of 2026", () => {
  const now = new Date("2026-11-08T00:10:00Z");
  assert.equal(yearReviewEnd(undefined, now), "2026-11-07");
  assert.equal(yearReviewEnd("2026-01-01", now), "2026-01-01");
  assert.equal(yearReviewEnd(undefined, new Date("2027-02-01T00:00:00Z")), "2026-12-31");

  for (const input of ["2025-12-31", "2026-02-29", "2026-2-01", "2026-11-08", "2027-01-01", 2026]) {
    assert.throws(() => yearReviewEnd(input, now), /completed UTC day/);
  }
  assert.equal(
    yearReviewPath("18446744073709551615", "2026-11-07"),
    "/year-in-review?user=18446744073709551615&end=2026-11-07",
  );
});

test("top post time is shown in UTC even when its source time has an offset", () => {
  assert.match(formatYearReviewPostTime("2026-11-08T05:11:00+05:30"), /^Nov 7, 2026, 11:41\sPM UTC$/);
});

test("Farcaster self-shares mention up to seven peers and X keeps only its credit tags", () => {
  const data = {
    profile: { fid: "366713", username: "nikolaii.eth", display_name: null },
    mutual: Array.from({ length: 8 }, (_, index) => ({
      profile: { fid: String(index + 1), username: `peer${index + 1}`, display_name: null },
      sent: 10,
      received: 5,
      mutual: 5,
    })),
  };
  const own = yearReviewShareText(data, "farcaster", "366713");
  assert.match(own, /My Magnificent Seven\n@peer1 @peer2 @peer3 @peer4 @peer5 @peer6 @peer7\n/);
  assert.doesNotMatch(own, /@peer8/);
  assert.doesNotMatch(yearReviewShareText(data, "farcaster", "9"), /@peer/);
  assert.doesNotMatch(yearReviewShareText(data, "farcaster"), /@peer/);
  assert.deepEqual(yearReviewShareText(data, "x", "366713").match(/@\w+/g), ["@NikolaiLeb", "@viniapp_xyz"]);
  const long = {
    ...data,
    mutual: data.mutual.map((row, index) => ({
      ...row,
      profile: { ...row.profile, username: `peer${index}${"a".repeat(55)}` },
    })),
  };
  assert.ok(new TextEncoder().encode(yearReviewShareText(long, "farcaster", "366713")).length <= 320);
});
