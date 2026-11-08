import assert from "node:assert/strict";
import test from "node:test";
import { yearReviewEnd, yearReviewPath } from "../packages/nextjs/lib/year-review.ts";

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
