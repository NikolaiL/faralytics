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
