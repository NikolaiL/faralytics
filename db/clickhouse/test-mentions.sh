#!/usr/bin/env bash
set -euo pipefail

sql_dir="$(cd "$(dirname "$0")" && pwd)"
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT

{
  cat <<'SQL'
CREATE DATABASE snapchain ENGINE = Atomic;
CREATE DATABASE farcaster ENGINE = Atomic;
CREATE TABLE snapchain.messages
(
    fid UInt64, type UInt16, hash String, timestamp UInt32, version UInt64,
    operation LowCardinality(String), mentions Array(UInt64), target_hash String
)
ENGINE = ReplacingMergeTree(version) PARTITION BY fid % 16 ORDER BY (fid, type, hash);
CREATE TABLE snapchain.cast_removals
(
    fid UInt64, hash String, target_hash String, version UInt64, operation LowCardinality(String)
)
ENGINE = ReplacingMergeTree(version) PARTITION BY fid % 16 ORDER BY (fid, hash);
CREATE MATERIALIZED VIEW snapchain.cast_removals_mv TO snapchain.cast_removals AS
SELECT fid, hash, target_hash, version, operation FROM snapchain.messages WHERE type = 2;

INSERT INTO snapchain.messages VALUES
    (1, 1, 'a', 157766400, 1, 'merge', [2, 2, 3, 1, 0], ''),
    (2, 1, 'b', 157766400, 1, 'merge', [1], ''),
    (3, 1, 'c', 157766400, 1, 'merge', [2], ''),
    (1, 1, 'p', 157852800, 1, 'prune', [2], ''),
    (1, 3, 'reaction', 157766400, 1, 'merge', [99], '');
SQL
  cat "$sql_dir/001_mention_messages.sql"
  cat <<'SQL'
INSERT INTO snapchain.messages VALUES
    (1, 1, 'a', 157766400, 1, 'merge', [2, 2, 3, 1, 0], ''),
    (1, 1, 'f', 160444800, 1, 'merge', [3], ''),
    (1, 1, 'future', 4294967295, 1, 'merge', [99], '');
SQL
  for partition in 1 2 3 1; do
    sed "s/{partition:UInt8}/$partition/g" "$sql_dir/002_mention_messages_backfill.sql"
  done
  cat "$sql_dir/003_mention_totals.sql"
  cat <<'SQL'
SYSTEM REFRESH VIEW snapchain.mention_totals_refresh;
SYSTEM WAIT VIEW snapchain.mention_totals_refresh;
SELECT throwIf(
    (SELECT sum(mentions_sent) FROM farcaster.mention_totals_daily) != 6
    OR (SELECT sum(mentions_received) FROM farcaster.mention_totals_daily) != 6,
    'Initial backfill and insert overlap must count each valid mention once'
);
SELECT throwIf(
    (SELECT mentions_sent FROM farcaster.mention_totals_daily WHERE fid = 1 AND day = '2026-01-01') != 2,
    'Repeated tags, FID zero and self-tags must be skipped'
);

INSERT INTO snapchain.messages VALUES
    (1, 1, 'a', 157766400, 2, 'merge', [], ''),
    (2, 1, 'b', 157766400, 2, 'revoke', [], ''),
    (3, 2, 'remove-c', 157852800, 1, 'merge', [], 'c'),
    (4, 1, 'late', 157766400, 1, 'merge', [2, 4], '');
INSERT INTO snapchain.messages VALUES
    (1, 1, 'a', 157766400, 1, 'merge', [2, 2, 3, 1, 0], '');

SYSTEM REFRESH VIEW snapchain.mention_totals_refresh;
SYSTEM WAIT VIEW snapchain.mention_totals_refresh;
SELECT throwIf(
    (SELECT count() FROM farcaster.mention_totals_daily) != 6
    OR (SELECT sum(mentions_sent) FROM farcaster.mention_totals_daily) != 3
    OR (SELECT sum(mentions_received) FROM farcaster.mention_totals_daily) != 3
    OR (SELECT count() FROM farcaster.mention_totals_daily WHERE fid = 1 AND day = '2026-01-01') != 0,
    'Late removals must replace earlier totals and a late insert must reach its original UTC day'
);
SELECT throwIf(
    (SELECT sum(mentions_sent) FROM farcaster.mention_totals_monthly WHERE fid = 1 AND month = '2026-01-01') != 1
    OR (SELECT sum(mentions_sent) FROM farcaster.mention_totals_monthly WHERE fid = 1 AND month = '2026-02-01') != 1
    OR (SELECT mentions_received FROM farcaster.mention_totals_yearly WHERE fid = 2 AND year = '2026-01-01') != 2,
    'Month and year views must sum the corrected daily counters'
);
SQL
} | "${CLICKHOUSE_BIN:-clickhouse}" local --path "$scratch" --multiquery
