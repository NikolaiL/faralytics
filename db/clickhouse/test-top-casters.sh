#!/usr/bin/env bash
set -euo pipefail
sql_dir="$(cd "$(dirname "$0")" && pwd)"
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
{
cat <<'SQL'
CREATE DATABASE snapchain ENGINE=Atomic;
CREATE DATABASE farcaster ENGINE=Atomic;
CREATE TABLE snapchain.action_messages (fid UInt64, hash String, timestamp DateTime('UTC'), action_type String)
ENGINE=ReplacingMergeTree ORDER BY (timestamp, hash, fid, action_type);
CREATE TABLE snapchain.received_actions (recipient_fid UInt64, fid UInt64, hash String, timestamp DateTime('UTC'), action_type String)
ENGINE=ReplacingMergeTree ORDER BY (recipient_fid, timestamp, hash, fid, action_type);
CREATE TABLE snapchain.mention_messages (fid UInt64, hash String, timestamp UInt32, operation String, mentions Array(UInt64), version UInt64)
ENGINE=ReplacingMergeTree(version) ORDER BY (fid, hash);
CREATE TABLE snapchain.cast_removals (fid UInt64, target_hash String, operation String)
ENGINE=ReplacingMergeTree ORDER BY (fid, target_hash);
INSERT INTO snapchain.action_messages VALUES
(1,'a','2026-01-01 23:59:59','cast'),(1,'a','2026-01-01 23:59:59','cast'),
(1,'b','2026-01-02 00:00:00','reply'),(1,'c','2026-01-02 00:00:00','like'),
(1,'d','2026-01-02 00:00:00','recast'),(1,'e','2026-01-02 00:00:00','unlike'),
(1,'future','2099-01-01 00:00:00','cast');
INSERT INTO snapchain.received_actions VALUES
(2,1,'b','2026-01-02 00:00:00','reply'),(2,1,'b','2026-01-02 00:00:00','reply'),
(2,1,'c','2026-01-02 00:00:00','like'),(2,1,'d','2026-01-02 00:00:00','recast'),
(2,1,'e','2026-01-02 00:00:00','unlike'),(2,2,'self','2026-01-02 00:00:00','reply'),
(2,1,'future','2099-01-01 00:00:00','reply');
INSERT INTO snapchain.mention_messages VALUES
(1,'a',157766400,'merge',[2,2,1,0],1),(1,'a',157766400,'merge',[2,2,1,0],1),
(2,'b',157766400,'prune',[1],1),(3,'c',157766400,'revoke',[2],1),
(4,'d',157766400,'merge',[2],1),(5,'e',4294967295,'merge',[2],1);
INSERT INTO snapchain.cast_removals VALUES (4,'d','merge');
SQL
cat "$sql_dir/005_top_casters.sql"
cat <<'SQL'
SYSTEM REFRESH VIEW snapchain.top_casters_outgoing_refresh;
SYSTEM WAIT VIEW snapchain.top_casters_outgoing_refresh;
SYSTEM REFRESH VIEW snapchain.top_casters_incoming_refresh;
SYSTEM WAIT VIEW snapchain.top_casters_incoming_refresh;
SYSTEM REFRESH VIEW snapchain.top_casters_mentions_refresh;
SYSTEM WAIT VIEW snapchain.top_casters_mentions_refresh;
SYSTEM REFRESH VIEW snapchain.top_casters_daily_refresh;
SYSTEM WAIT VIEW snapchain.top_casters_daily_refresh;
SELECT throwIf((SELECT sum(casts) FROM farcaster.top_casters_daily) != 1, 'Deduplicate casts and exclude future events');
SELECT throwIf((SELECT sum(replies_sent + recasts_sent + likes_sent) FROM farcaster.top_casters_daily) != 3, 'Count positive actions only');
SELECT throwIf((SELECT sum(replies_received + recasts_received + likes_received) FROM farcaster.top_casters_daily) != 3, 'Deduplicate received actions and exclude self and future events');
SELECT throwIf((SELECT sum(casts) FROM farcaster.top_casters_daily WHERE fid=1 AND day='2026-01-01') != 1 OR (SELECT sum(replies_sent) FROM farcaster.top_casters_daily WHERE fid=1 AND day='2026-01-02') != 1, 'Respect UTC midnight');
SELECT throwIf((SELECT sum(mentions_sent) FROM farcaster.top_casters_daily) != 2 OR (SELECT sum(mentions_received) FROM farcaster.top_casters_daily) != 2, 'Distinct valid tags only and retain prune and exclude revoke and removals');
INSERT INTO snapchain.mention_messages VALUES (1,'a',157766400,'merge',[],2);
SYSTEM REFRESH VIEW snapchain.top_casters_outgoing_refresh;
SYSTEM WAIT VIEW snapchain.top_casters_outgoing_refresh;
SYSTEM REFRESH VIEW snapchain.top_casters_incoming_refresh;
SYSTEM WAIT VIEW snapchain.top_casters_incoming_refresh;
SYSTEM REFRESH VIEW snapchain.top_casters_mentions_refresh;
SYSTEM WAIT VIEW snapchain.top_casters_mentions_refresh;
SYSTEM REFRESH VIEW snapchain.top_casters_daily_refresh;
SYSTEM WAIT VIEW snapchain.top_casters_daily_refresh;
SELECT throwIf((SELECT sum(mentions_sent) FROM farcaster.top_casters_daily) != 1 OR (SELECT sum(mentions_received) FROM farcaster.top_casters_daily) != 1, 'Replacement refresh corrects old tags without accumulating snapshots');
TRUNCATE TABLE snapchain.top_casters_daily;
INSERT INTO snapchain.top_casters_daily SELECT toDate('2026-01-02'), number+1, 100-intDiv(number,2),0,0,0,0,0,0,0,0,now64(3) FROM numbers(20);
CREATE TABLE farcaster.fixture_ranks (metric UInt64,fid String,score String,position String,user_position String,generated_at DateTime64(3,'UTC')) ENGINE=Memory;
SQL
for user in 0 1 11 20 999; do
  printf 'TRUNCATE TABLE farcaster.fixture_ranks;\nINSERT INTO farcaster.fixture_ranks\n'
  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --input-type=module - "$sql_dir" "$user" <<'JS'
import {pathToFileURL} from 'node:url';
const {casterRankingSql}=await import(pathToFileURL(process.argv[2]+'/../../packages/nextjs/lib/top-casters.ts'));
console.log(casterRankingSql.replaceAll('{start:Date}',"toDate('2026-01-01')").replaceAll('{through:Date}',"toDate('2026-01-02')").replaceAll('{user:UInt64}',process.argv[3])+';');
JS
  case "$user" in
    0|1) expected="[1,2,3,4,5,6,7,8,9,10]";;
    11) expected="[1,2,3,4,5,9,10,11,12,13]";;
    20) expected="[1,2,3,4,5,18,19,20]";;
    999) expected="[1,2,3,4,5]";;
  esac
  printf "SELECT throwIf((SELECT arraySort(groupArray(toUInt64(position))) FROM farcaster.fixture_ranks) != %s, 'Incorrect personalized positions for FID %s');\n" "$expected" "$user"
done
} | "${CLICKHOUSE_BIN:-clickhouse}" local --path "$scratch" --multiquery
