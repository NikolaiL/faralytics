#!/usr/bin/env bash
set -euo pipefail
sql_dir="$(cd "$(dirname "$0")" && pwd)"
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
{
cat <<'SQL'
CREATE DATABASE snapchain ENGINE=Atomic;
CREATE TABLE snapchain.messages (
 fid UInt64,type UInt16,hash String,timestamp UInt32,version UInt64,
 operation LowCardinality(String),mentions Array(UInt64),parent_fid UInt64,embeds_json String
) ENGINE=ReplacingMergeTree(version) PARTITION BY fid%16 ORDER BY (fid,type,hash);
INSERT INTO snapchain.messages VALUES (1,1,'a',123,1,'merge',[2,2,0],0,'[]');
SQL
cat "$sql_dir/006_live_cast_recipients.sql"
cat <<'SQL'
INSERT INTO snapchain.messages VALUES
 (1,1,'a',123,1,'merge',[2,2,0],0,'[]'),
 (3,1,'b',124,1,'prune',[2],4,'[{"castId":{"fid":2}},{"castId":{"fid":18446744073709551615}}]'),
 (5,3,'reaction',125,1,'merge',[99],0,'[]'),
 (6,1,'revoked',125,1,'revoke',[99],0,'[]'),
 (7,1,'future',4294967295,1,'merge',[99],0,'[]');
SQL
for partition in 1 3 3; do
 sed "s/{partition:UInt8}/$partition/g" "$sql_dir/007_live_cast_recipients_backfill.sql"
done
cat <<'SQL'
SELECT throwIf((SELECT count() FROM snapchain.live_cast_recipients FINAL WHERE timestamp<=now('UTC'))!=3,
 'Live inserts and repeated backfill must deduplicate mentions and quoted recipients');
SELECT throwIf((SELECT count() FROM snapchain.live_cast_recipients FINAL WHERE recipient_fid=18446744073709551615 AND action_type='reply' AND hash='0xb')!=1,
 'Quote FIDs must retain full UInt64 precision and replies must retain their type');
SELECT throwIf((SELECT count() FROM snapchain.live_cast_recipients FINAL WHERE recipient_fid IN (0,99) AND timestamp<=now('UTC'))!=0,
 'Zero targets, reactions, revoked and future messages must not enter current recipient reads');
INSERT INTO snapchain.messages VALUES (3,1,'b',124,2,'merge',[],4,'[]');
SELECT throwIf((SELECT length(mentions)+length(JSONExtractArrayRaw(embeds_json)) FROM snapchain.messages FINAL WHERE fid=3 AND type=1 AND hash='b')!=0,
 'Latest canonical metadata must clear old references even if the sparse recipient index retains an old pointer');
SELECT 'PASS live cast recipients: UInt64 quotes, repeated tags, overlap/repeated backfill, replies, future/revoked/non-cast exclusion and corrected metadata';
SQL
} | "${CLICKHOUSE_BIN:-clickhouse}" local --path "$scratch" --multiquery
