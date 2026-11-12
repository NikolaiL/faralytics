CREATE TABLE IF NOT EXISTS snapchain.top_casters_daily
(
    day Date,
    fid UInt64,
    casts UInt64,
    replies_sent UInt64,
    recasts_sent UInt64,
    likes_sent UInt64,
    mentions_sent UInt64,
    replies_received UInt64,
    recasts_received UInt64,
    likes_received UInt64,
    mentions_received UInt64,
    generated_at DateTime64(3, 'UTC')
)
ENGINE = MergeTree PARTITION BY toYYYYMM(day) ORDER BY (day, fid);

-- Separate replacement jobs prevent one aggregation from forcing tiny spills in another.
CREATE TABLE IF NOT EXISTS snapchain.top_casters_outgoing_daily AS snapchain.top_casters_daily;
CREATE MATERIALIZED VIEW IF NOT EXISTS snapchain.top_casters_outgoing_refresh
REFRESH EVERY 1 HOUR OFFSET 20 MINUTE
TO snapchain.top_casters_outgoing_daily EMPTY AS
WITH now64(3, 'UTC') AS cutoff
SELECT day, fid,
    scores[1] AS casts,
    scores[2] AS replies_sent,
    scores[3] AS recasts_sent,
    scores[4] AS likes_sent,
    scores[5] AS mentions_sent,
    scores[6] AS replies_received,
    scores[7] AS recasts_received,
    scores[8] AS likes_received,
    scores[9] AS mentions_received, cutoff AS generated_at
FROM (
    SELECT toDate(timestamp, 'UTC') AS day, fid,
        [countIf(action_type = 'cast'), countIf(action_type = 'reply'),
         countIf(action_type = 'recast'), countIf(action_type = 'like'),
         toUInt64(0), toUInt64(0), toUInt64(0), toUInt64(0), toUInt64(0)] AS scores
    FROM snapchain.action_messages FINAL
    WHERE fid > 0 AND action_type IN ('cast', 'reply', 'recast', 'like')
      AND timestamp >= toDateTime('2021-01-01', 'UTC') AND timestamp <= cutoff
    GROUP BY day, fid
)
SETTINGS optimize_move_to_prewhere_if_final = 0, max_threads = 2, max_final_threads = 1,
    do_not_merge_across_partitions_select_final = 1,
    max_block_size = 8192, aggregation_memory_efficient_merge_threads = 1,
    max_memory_usage = 6442450944, max_bytes_before_external_group_by = 3221225472,
    max_temporary_data_on_disk_size_for_query = 21474836480, max_execution_time = 900;

CREATE TABLE IF NOT EXISTS snapchain.top_casters_incoming_daily AS snapchain.top_casters_daily;
CREATE MATERIALIZED VIEW IF NOT EXISTS snapchain.top_casters_incoming_refresh
REFRESH EVERY 1 HOUR OFFSET 20 MINUTE DEPENDS ON snapchain.top_casters_outgoing_refresh
TO snapchain.top_casters_incoming_daily EMPTY AS
WITH (SELECT max(generated_at) FROM snapchain.top_casters_outgoing_daily) AS cutoff
SELECT day, fid,
    scores[1] AS casts,
    scores[2] AS replies_sent,
    scores[3] AS recasts_sent,
    scores[4] AS likes_sent,
    scores[5] AS mentions_sent,
    scores[6] AS replies_received,
    scores[7] AS recasts_received,
    scores[8] AS likes_received,
    scores[9] AS mentions_received, cutoff AS generated_at
FROM (
    SELECT toDate(r.timestamp, 'UTC') AS day, r.recipient_fid AS fid,
        [toUInt64(0), toUInt64(0), toUInt64(0), toUInt64(0), toUInt64(0),
         countIf(action_type = 'reply'), countIf(action_type = 'recast'),
         countIf(action_type = 'like'), toUInt64(0)] AS scores
    FROM snapchain.received_actions AS r FINAL
    WHERE r.recipient_fid > 0 AND r.fid > 0 AND r.recipient_fid != r.fid
      AND action_type IN ('reply', 'recast', 'like')
      AND timestamp >= toDateTime('2021-01-01', 'UTC') AND timestamp <= cutoff
    GROUP BY day, r.recipient_fid
)
SETTINGS optimize_move_to_prewhere_if_final = 0, max_threads = 2, max_final_threads = 1,
    do_not_merge_across_partitions_select_final = 1,
    max_block_size = 8192, aggregation_memory_efficient_merge_threads = 1,
    max_memory_usage = 6442450944, max_bytes_before_external_group_by = 3221225472,
    max_temporary_data_on_disk_size_for_query = 21474836480, max_execution_time = 900;

CREATE TABLE IF NOT EXISTS snapchain.top_casters_mentions_daily AS snapchain.top_casters_daily;
CREATE MATERIALIZED VIEW IF NOT EXISTS snapchain.top_casters_mentions_refresh
REFRESH EVERY 1 HOUR OFFSET 20 MINUTE DEPENDS ON snapchain.top_casters_incoming_refresh
TO snapchain.top_casters_mentions_daily EMPTY AS
WITH (SELECT max(generated_at) FROM snapchain.top_casters_outgoing_daily) AS cutoff
SELECT day, fid,
    scores[1] AS casts,
    scores[2] AS replies_sent,
    scores[3] AS recasts_sent,
    scores[4] AS likes_sent,
    scores[5] AS mentions_sent,
    scores[6] AS replies_received,
    scores[7] AS recasts_received,
    scores[8] AS likes_received,
    scores[9] AS mentions_received, cutoff AS generated_at
FROM (
    SELECT day, side.1 AS fid,
        [toUInt64(0), toUInt64(0), toUInt64(0), toUInt64(0), countIf(side.2 = 1),
         toUInt64(0), toUInt64(0), toUInt64(0), countIf(side.2 = 0)] AS scores
    FROM (
        SELECT fid AS author,
            toDate(fromUnixTimestamp64Second(toInt64(timestamp) + 1609459200, 'UTC')) AS day,
            arrayJoin(arrayDistinct(arrayFilter(target -> target > 0 AND target != fid, mentions))) AS target
        FROM snapchain.mention_messages FINAL
        WHERE fid > 0 AND operation IN ('merge', 'prune') AND notEmpty(mentions)
          AND toInt64(timestamp) + 1609459200 <= toUnixTimestamp(cutoff)
          AND (fid, hash) NOT IN (
              SELECT fid, target_hash FROM snapchain.cast_removals FINAL WHERE operation = 'merge'
          )
    )
    ARRAY JOIN [(author, 1), (target, 0)] AS side
    GROUP BY day, fid
)
SETTINGS optimize_move_to_prewhere_if_final = 0, max_threads = 2, max_final_threads = 1,
    do_not_merge_across_partitions_select_final = 1,
    max_block_size = 8192, aggregation_memory_efficient_merge_threads = 1,
    max_memory_usage = 6442450944, max_bytes_before_external_group_by = 3221225472,
    max_temporary_data_on_disk_size_for_query = 21474836480, max_execution_time = 900;

CREATE MATERIALIZED VIEW IF NOT EXISTS snapchain.top_casters_daily_refresh
REFRESH EVERY 1 HOUR OFFSET 20 MINUTE DEPENDS ON snapchain.top_casters_mentions_refresh
TO snapchain.top_casters_daily EMPTY AS
SELECT * FROM snapchain.top_casters_outgoing_daily
UNION ALL SELECT * FROM snapchain.top_casters_incoming_daily
UNION ALL SELECT * FROM snapchain.top_casters_mentions_daily
SETTINGS max_threads = 2, max_memory_usage = 2147483648, max_execution_time = 180;

CREATE VIEW IF NOT EXISTS farcaster.top_casters_daily AS
SELECT * FROM snapchain.top_casters_daily;
