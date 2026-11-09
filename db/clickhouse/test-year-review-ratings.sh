#!/usr/bin/env bash
set -euo pipefail

sql_dir="$(cd "$(dirname "$0")" && pwd)"
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
{
  cat <<'SQL'
CREATE DATABASE snapchain ENGINE=Atomic;
CREATE DATABASE farcaster ENGINE=Atomic;
CREATE TABLE snapchain.action_messages (fid UInt64, timestamp DateTime('UTC'), action_type String)
ENGINE=ReplacingMergeTree ORDER BY (fid, timestamp, action_type);
CREATE TABLE snapchain.messages (
  fid UInt64, type UInt16, hash String, timestamp UInt32, operation String,
  parent_fid UInt64, parent_hash String, target_fid UInt64, target_hash String, reaction_type UInt16
) ENGINE=ReplacingMergeTree ORDER BY (fid,type,hash);
INSERT INTO snapchain.action_messages VALUES
  (1,'2026-01-01 00:00:00','cast'), (2,'2026-01-02 00:00:00','reply'), (2,'2026-01-02 00:00:00','like'),
  (2,'2026-01-03 00:00:00','like'), (3,'2026-01-02 00:00:00','follow'), (4,'2025-12-31 23:59:59','cast');
INSERT INTO snapchain.messages VALUES
  (1,1,'original',157766400,'merge',0,'',0,'',0),
  (2,1,'reply',157852800,'merge',1,'original',0,'',0),
  (2,3,'like',157852800,'merge',0,'',1,'original',1),
  (3,1,'old',157000000,'merge',0,'',0,'',0),
  (2,1,'reply-old',157852800,'merge',3,'old',0,'',0),
  (1,1,'self',157852800,'merge',1,'original',0,'',0);
SQL
  cat "$sql_dir/004_year_review_ratings.sql"
  cat <<'SQL'
SYSTEM REFRESH VIEW snapchain.year_review_activity_daily_refresh;
SYSTEM WAIT VIEW snapchain.year_review_activity_daily_refresh;
SYSTEM REFRESH VIEW snapchain.year_review_metric_scores_refresh;
SYSTEM WAIT VIEW snapchain.year_review_metric_scores_refresh;
SYSTEM REFRESH VIEW snapchain.year_review_metric_histogram_refresh;
SYSTEM WAIT VIEW snapchain.year_review_metric_histogram_refresh;
SELECT throwIf((SELECT scores FROM snapchain.year_review_metric_scores WHERE fid=1) != [1,0,0,0,1,0,1,1]);
SELECT throwIf((SELECT scores FROM snapchain.year_review_metric_scores WHERE fid=3) != [0,0,0,0,0,0,0,0]);
SELECT throwIf((SELECT scores FROM snapchain.year_review_metric_scores WHERE fid=2)[4] != 2);
SELECT throwIf((SELECT count() FROM snapchain.year_review_metric_scores WHERE fid=4) != 0);
SELECT throwIf((SELECT accounts FROM snapchain.year_review_metric_histogram WHERE metric=5 AND score=0) != 2);
SQL
} | "${CLICKHOUSE_BIN:-clickhouse}" local --path "$scratch" --multiquery
