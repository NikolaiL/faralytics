CREATE TABLE IF NOT EXISTS snapchain.year_review_activity_daily
(
    end Date,
    day Date,
    fid UInt64,
    actions UInt64,
    casts UInt64,
    replies UInt64,
    recasts UInt64,
    likes UInt64
)
ENGINE = MergeTree ORDER BY (end, fid, day);

CREATE MATERIALIZED VIEW IF NOT EXISTS snapchain.year_review_activity_daily_refresh
REFRESH EVERY 1 DAY OFFSET 2 HOUR
TO snapchain.year_review_activity_daily EMPTY AS
WITH least(toDate(now('UTC')), toDate('2027-01-01')) AS ends_before
SELECT
    ends_before - 1 AS end,
    toDate(timestamp, 'UTC') AS day,
    fid,
    count() AS actions,
    countIf(action_type = 'cast') AS casts,
    countIf(action_type = 'reply') AS replies,
    countIf(action_type = 'recast') AS recasts,
    countIf(action_type = 'like') AS likes
FROM snapchain.action_messages FINAL
WHERE fid > 0 AND timestamp >= toDateTime('2026-01-01', 'UTC')
  AND timestamp < toDateTime(ends_before, 'UTC')
GROUP BY fid, day
SETTINGS
    max_threads = 4,
    max_memory_usage = 4294967296,
    max_bytes_before_external_group_by = 536870912,
    max_temporary_data_on_disk_size_for_query = 10737418240,
    max_execution_time = 180;

CREATE TABLE IF NOT EXISTS snapchain.year_review_metric_scores
(
    end Date,
    generated_at DateTime64(3, 'UTC'),
    fid UInt64,
    scores Array(UInt64)
)
ENGINE = MergeTree ORDER BY (end, fid);

CREATE MATERIALIZED VIEW IF NOT EXISTS snapchain.year_review_metric_scores_refresh
REFRESH EVERY 1 DAY OFFSET 2 HOUR DEPENDS ON snapchain.year_review_activity_daily_refresh
TO snapchain.year_review_metric_scores EMPTY AS
WITH
    toDate('2026-01-01') AS starts_on,
    least(toDate(now('UTC')), toDate('2027-01-01')) AS ends_before,
    toUnixTimestamp(toDateTime(starts_on, 'UTC')) - 1609459200 AS start_second,
    toUnixTimestamp(toDateTime(ends_before, 'UTC')) - 1609459200 AS end_second,
    outgoing AS (
        SELECT fid,
            sum(casts) AS casts,
            sum(replies) AS replies,
            sum(recasts) AS recasts,
            sum(likes) AS likes
        FROM snapchain.year_review_activity_daily
        WHERE end = ends_before - 1
        GROUP BY fid
    ),
    incoming AS (
        SELECT event.recipient AS fid,
            countIf(event.type = 1) AS replies,
            countIf(event.type = 3 AND event.reaction_type = 2) AS recasts,
            countIf(event.type = 3 AND event.reaction_type = 1) AS likes,
            uniqExact(event.actor) AS people
        FROM (
            SELECT fid AS actor, type, reaction_type,
                if(type = 1, parent_fid, target_fid) AS recipient,
                if(type = 1, parent_hash, target_hash) AS cast_hash
            FROM snapchain.messages FINAL
            PREWHERE type IN (1, 3) AND timestamp >= start_second AND timestamp < end_second
            WHERE operation IN ('merge', 'prune')
              AND (type = 1 OR reaction_type IN (1, 2))
              AND recipient > 0 AND recipient != actor AND notEmpty(cast_hash)
        ) AS event
        ALL INNER JOIN (
            SELECT fid, hash
            FROM snapchain.messages FINAL
            PREWHERE type = 1 AND timestamp >= start_second AND timestamp < end_second
            WHERE operation IN ('merge', 'prune') AND empty(parent_hash)
        ) AS original ON event.recipient = original.fid AND event.cast_hash = original.hash
        GROUP BY event.recipient
    )
SELECT
    ends_before - 1 AS end,
    now64(3, 'UTC') AS generated_at,
    sent.fid AS fid,
    [sent.casts, sent.replies, sent.recasts, sent.likes,
     received.replies, received.recasts, received.likes, received.people] AS scores
FROM outgoing AS sent
LEFT JOIN incoming AS received ON sent.fid = received.fid
SETTINGS
    optimize_move_to_prewhere_if_final = 0,
    max_threads = 4,
    max_final_threads = 1,
    join_algorithm = 'grace_hash',
    max_bytes_in_join = 805306368,
    max_memory_usage = 6442450944,
    max_bytes_before_external_group_by = 536870912,
    max_temporary_data_on_disk_size_for_query = 21474836480,
    max_execution_time = 900;

CREATE TABLE IF NOT EXISTS snapchain.year_review_metric_histogram
(
    end Date,
    generated_at DateTime64(3, 'UTC'),
    metric UInt64,
    score UInt64,
    accounts UInt64
)
ENGINE = MergeTree ORDER BY (end, generated_at, metric, score);

CREATE MATERIALIZED VIEW IF NOT EXISTS snapchain.year_review_metric_histogram_refresh
REFRESH EVERY 1 DAY OFFSET 2 HOUR DEPENDS ON snapchain.year_review_metric_scores_refresh
TO snapchain.year_review_metric_histogram EMPTY AS
SELECT end, generated_at, metric, score, count() AS accounts
FROM snapchain.year_review_metric_scores
ARRAY JOIN arrayEnumerate(scores) AS metric, scores AS score
GROUP BY end, generated_at, metric, score
SETTINGS max_threads = 2, max_memory_usage = 2147483648;
