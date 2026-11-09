INSERT INTO snapchain.mention_messages (fid, hash, timestamp, version, operation, mentions)
SELECT fid, hash, timestamp, version, operation, mentions
FROM snapchain.messages FINAL
PREWHERE type = 1
WHERE fid % 16 = {partition:UInt8}
SETTINGS
    max_threads = 2,
    max_final_threads = 1,
    max_memory_usage = 2147483648,
    max_execution_time = 180;
