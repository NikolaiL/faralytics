# Mention totals

Each signed cast or reply contributes one mention per distinct tagged FID. FID zero and self-mentions are excluded. The latest version of a message determines its tags. Captured pruned messages count, and deleted or revoked messages and casts with an active CastRemove are excluded.

The insert-triggered view copies all cast and reply versions, including empty mention arrays. A replacement refresh publishes the UTC daily counts at 01:00 UTC. Monthly and yearly views sum those daily counts. Coverage is limited to captured Snapchain history.

Faralytics uses the compact message table for incoming mentions in Top Interactions and the Year in Review peer rankings. Install and backfill it before deploying those queries. They use individual events so they can rank peers, preserve the selected time window, and count a reply that also mentions its recipient once.

## Install on the ClickHouse writer

Run the migration with the existing writer or administrator connection using the sync host's schema maintenance procedure. The application connection has SELECT access to the resulting views.

1. Run [001_mention_messages.sql](001_mention_messages.sql) to install the capture table and view before backfilling.
2. Run [002_mention_messages_backfill.sql](002_mention_messages_backfill.sql) for each partition from 0 through 15, sequentially. Pass `--param_partition=N` to `clickhouse-client` for each run. Completed partitions can be rerun because the destination keeps the latest version by FID and hash.
3. Run [003_mention_totals.sql](003_mention_totals.sql) after the backfill succeeds. Start and wait for the initial snapshot, then check the refresh status.

```sql
SYSTEM REFRESH VIEW snapchain.mention_totals_refresh;
SYSTEM WAIT VIEW snapchain.mention_totals_refresh;

SELECT status, last_success_time, read_rows, written_rows
FROM system.view_refreshes
WHERE database = 'snapchain' AND view = 'mention_totals_refresh';

SELECT year, mentions_sent, mentions_received
FROM farcaster.mention_totals_yearly
WHERE fid = 366713
ORDER BY year;
```

The refresh rebuilds the captured mention history so late changes can correct old buckets. Measure the initial backfill and refresh on the writer before increasing the cadence.

## Verify locally

```sh
CLICKHOUSE_BIN=/path/to/clickhouse bash db/clickhouse/test-mentions.sh
```

The test creates an isolated ClickHouse database and runs the migration with historical rows, duplicate deliveries, new inserts, repeated tags, empty-array replacements, revocations, explicit cast removals and late arrivals.

## Year in Review ratings

Install [004_year_review_ratings.sql](004_year_review_ratings.sql) on the writer and run the refreshes in order:

```sql
SYSTEM REFRESH VIEW snapchain.year_review_activity_daily_refresh;
SYSTEM WAIT VIEW snapchain.year_review_activity_daily_refresh;
SYSTEM REFRESH VIEW snapchain.year_review_metric_scores_refresh;
SYSTEM WAIT VIEW snapchain.year_review_metric_scores_refresh;
SYSTEM REFRESH VIEW snapchain.year_review_metric_histogram_refresh;
SYSTEM WAIT VIEW snapchain.year_review_metric_histogram_refresh;
```

The daily activity snapshot refreshes at 02:00 UTC. The score snapshot and histogram refresh in that order. The cohort is distinct FIDs with at least one captured action in the review year through the cutoff. An active account can have zero for a specific metric. The app shows a rating when the snapshot covers the selected cutoff and its score matches the displayed count. The eight scores are stored in the order displayed in the first two recap chapters, four per chapter.

Run the isolated score and histogram fixture with `CLICKHOUSE_BIN=/path/to/clickhouse bash db/clickhouse/test-year-review-ratings.sh`.

## Top Casters

[005_top_casters.sql](005_top_casters.sql) adds the general `farcaster.top_casters_daily` summary needed for `/top-casters`. Earlier recap work created the **2026-only** `year_review_activity_daily` and eight yearly scores, plus daily/monthly/yearly mention totals. Those do not provide all nine metrics over arbitrary timeframes. The new summary leaves those jobs unchanged.

Each UTC day/FID has up to three non-overlapping metric rows (outgoing, incoming and mentions), summed by the reader: original casts, replies/recasts/likes given, distinct mentions given, and replies/recasts/likes/mentions received. Outgoing and received figures count distinct captured positive signed actions, even when later undone; unlike/unrecast events do not subtract. Received actions exclude self-actions, include responses to replies and older posts, and belong to the response day. This differs deliberately from Year in Review's responses-to-original-posts-in-the-year rule. Mentions reuse migration 003's corrected-message semantics (distinct valid tags per cast/reply, no zero/self tags, latest versions, prune retained, revoke and active cast removals excluded).

The hourly replacement chain starts at **:20 UTC**: `top_casters_outgoing_refresh` → `top_casters_incoming_refresh` → `top_casters_mentions_refresh` → `top_casters_daily_refresh`. Each source replaces its own staging table, then the final job atomically publishes their union. Outgoing chooses the UTC cutoff; incoming and mentions reuse it. Today is partial and future timestamps are excluded. Rebuilding history corrects late arrivals and mention changes without additive counters or insert-triggered pipelines.

Source jobs run sequentially with two threads, a 6 GiB memory limit, a 3 GiB aggregation spill threshold, one spill-merge thread and a 15-minute runtime limit. The publication job has a 2 GiB/three-minute bound. Separating jobs prevents another aggregation's retained memory from forcing thousands of tiny spill files; the combined historical query exceeded 12 GiB while merging 233,018 spills. `FINAL` can process partitions independently because every source's replacement key fixes its partition; see [ClickHouse's FINAL guidance](https://clickhouse.com/resources/engineering/clickhouse-optimize-table-final). Inspect initial refresh cost before changing cadence.

Install with the existing writer connection, then wait and verify:

```sql
SYSTEM REFRESH VIEW snapchain.top_casters_outgoing_refresh;
SYSTEM WAIT VIEW snapchain.top_casters_outgoing_refresh;
SYSTEM REFRESH VIEW snapchain.top_casters_incoming_refresh;
SYSTEM WAIT VIEW snapchain.top_casters_incoming_refresh;
SYSTEM REFRESH VIEW snapchain.top_casters_mentions_refresh;
SYSTEM WAIT VIEW snapchain.top_casters_mentions_refresh;
SYSTEM REFRESH VIEW snapchain.top_casters_daily_refresh;
SYSTEM WAIT VIEW snapchain.top_casters_daily_refresh;
SELECT view, status, last_success_time, exception, read_rows, written_rows
FROM system.view_refreshes
WHERE database = 'snapchain' AND startsWith(view, 'top_casters_');
SELECT count(), max(generated_at) FROM farcaster.top_casters_daily;
```

Maintenance uses the existing sync checkout at `/home/forge/snapchain/clickhouse-sync` on the writer host. Load its server configuration through `src/config.mjs` and use `src/clickhouse.mjs`; do not alter the app's read-only credentials or the sync service/cursors. The local key is `~/Sites/forge`; if SSH authentication fails, unlock it in the owner's Mac Terminal with `ssh-add -t 1h ~/Sites/forge`. Never print credentials or copy server configuration into the app.

Verify with `CLICKHOUSE_BIN=/path/to/clickhouse bash db/clickhouse/test-top-casters.sh`. The isolated fixture covers duplicates, positive-action semantics, self/future exclusions, UTC midnight, corrected tags, equal-score ordering, anonymous Top 10, personalized Top 10/Top 5 plus neighbors, bottom-of-list truncation and unranked accounts.
