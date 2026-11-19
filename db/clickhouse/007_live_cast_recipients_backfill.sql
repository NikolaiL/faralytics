-- Install migration 006 before backfilling. Run partitions 0..15 sequentially on the writer.
INSERT INTO snapchain.live_cast_recipients
WITH arrayMap(embed -> toUInt64OrZero(if(JSONType(embed,'castId','fid')='String',
    JSONExtractString(embed,'castId','fid'),JSONExtractRaw(embed,'castId','fid'))),
    arraySlice(JSONExtractArrayRaw(m.embeds_json),1,4)) AS quote_fids
SELECT arrayJoin(arrayDistinct(arrayFilter(target -> target>0,arrayConcat(m.mentions,quote_fids)))) AS recipient_fid,
    m.fid,toDateTime(m.timestamp+1609459200,'UTC') AS timestamp,
    concat('0x',m.hash) AS hash,if(m.parent_fid>0,'reply','cast') AS action_type,
    toUInt8(has(m.mentions,recipient_fid)) AS is_mention,m.version
FROM snapchain.messages AS m FINAL
PREWHERE (m.fid%16)={partition:UInt8} AND m.type=1
WHERE m.operation IN ('merge','prune') AND m.timestamp<=toUnixTimestamp(now('UTC'))-1609459200
SETTINGS max_threads=2,max_memory_usage=6000000000,max_execution_time=600,
    optimize_move_to_prewhere_if_final=0,do_not_merge_across_partitions_select_final=1;
