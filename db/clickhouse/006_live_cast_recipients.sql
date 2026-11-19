CREATE TABLE IF NOT EXISTS snapchain.live_cast_recipients
(
    recipient_fid UInt64,
    fid UInt64,
    timestamp DateTime('UTC'),
    hash String,
    action_type LowCardinality(String),
    is_mention UInt8,
    version UInt64
)
ENGINE = ReplacingMergeTree(version)
PARTITION BY toYYYYMM(timestamp)
ORDER BY (recipient_fid, timestamp, hash, fid, action_type);

-- Keep an incoming index for cast mentions/quotes; canonical message metadata validates references at read time.
CREATE MATERIALIZED VIEW IF NOT EXISTS snapchain.live_cast_recipients_mv
TO snapchain.live_cast_recipients AS
WITH arrayMap(embed -> toUInt64OrZero(if(JSONType(embed,'castId','fid')='String',
    JSONExtractString(embed,'castId','fid'),JSONExtractRaw(embed,'castId','fid'))),
    arraySlice(JSONExtractArrayRaw(m.embeds_json),1,4)) AS quote_fids
SELECT arrayJoin(arrayDistinct(arrayFilter(target -> target>0,arrayConcat(m.mentions,quote_fids)))) AS recipient_fid,
    m.fid,toDateTime(m.timestamp+1609459200,'UTC') AS timestamp,
    concat('0x',m.hash) AS hash,if(m.parent_fid>0,'reply','cast') AS action_type,
    toUInt8(has(m.mentions,recipient_fid)) AS is_mention,m.version
FROM snapchain.messages AS m
WHERE m.type=1 AND m.operation IN ('merge','prune');
