CREATE TABLE IF NOT EXISTS snapchain.mention_messages
(
    fid UInt64,
    hash String,
    timestamp UInt32,
    version UInt64,
    operation LowCardinality(String),
    mentions Array(UInt64)
)
ENGINE = ReplacingMergeTree(version)
PARTITION BY fid % 16
ORDER BY (fid, hash);

-- Keep empty arrays and removal states so a newer version can replace an earlier mention.
CREATE MATERIALIZED VIEW IF NOT EXISTS snapchain.mention_messages_mv
TO snapchain.mention_messages AS
SELECT fid, hash, timestamp, version, operation, mentions
FROM snapchain.messages
WHERE type = 1;
