CREATE TABLE IF NOT EXISTS snapchain.mention_totals_daily
(
    fid UInt64,
    day Date,
    mentions_sent UInt64,
    mentions_received UInt64
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(day)
ORDER BY (fid, day);

CREATE MATERIALIZED VIEW IF NOT EXISTS snapchain.mention_totals_refresh
REFRESH EVERY 1 DAY OFFSET 1 HOUR
TO snapchain.mention_totals_daily EMPTY AS
SELECT
    side.1 AS fid,
    day,
    countIf(side.2 = 1) AS mentions_sent,
    countIf(side.2 = 0) AS mentions_received
FROM
(
    SELECT
        fid AS author,
        toDate(fromUnixTimestamp64Second(toInt64(timestamp) + 1609459200, 'UTC')) AS day,
        arrayJoin(arrayDistinct(arrayFilter(target -> target > 0 AND target != fid, mentions))) AS target
    FROM snapchain.mention_messages FINAL
    WHERE fid > 0
      AND operation IN ('merge', 'prune')
      AND notEmpty(mentions)
      AND toInt64(timestamp) + 1609459200 < toUnixTimestamp(now('UTC'))
      AND (fid, hash) NOT IN
      (
          SELECT fid, target_hash
          FROM snapchain.cast_removals FINAL
          WHERE operation = 'merge'
      )
)
ARRAY JOIN [(author, 1), (target, 0)] AS side
GROUP BY fid, day
SETTINGS
    optimize_move_to_prewhere_if_final = 0,
    max_threads = 2,
    max_final_threads = 1,
    max_memory_usage = 4294967296,
    max_bytes_before_external_group_by = 536870912,
    max_temporary_data_on_disk_size_for_query = 8589934592,
    max_execution_time = 900;

CREATE VIEW IF NOT EXISTS farcaster.mention_totals_daily AS
SELECT fid, day, mentions_sent, mentions_received
FROM snapchain.mention_totals_daily;

CREATE VIEW IF NOT EXISTS farcaster.mention_totals_monthly AS
SELECT
    fid,
    toStartOfMonth(day) AS month,
    sum(mentions_sent) AS mentions_sent,
    sum(mentions_received) AS mentions_received
FROM snapchain.mention_totals_daily
GROUP BY fid, month;

CREATE VIEW IF NOT EXISTS farcaster.mention_totals_yearly AS
SELECT
    fid,
    toStartOfYear(day) AS year,
    sum(mentions_sent) AS mentions_sent,
    sum(mentions_received) AS mentions_received
FROM snapchain.mention_totals_daily
GROUP BY fid, year;
