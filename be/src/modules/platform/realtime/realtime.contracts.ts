/** How many frames of one topic a hub keeps for a reconnecting client (the oldest is dropped first). */
export const REPLAY_FRAMES = 64

/** How many topics the memory hub keeps frames for (the topic published to least recently is dropped first). */
export const REPLAY_TOPICS = 1024

/** How long a shared hub keeps a frame for a reconnecting client: the fenced sweep deletes rows older than this. */
export const REPLAY_TTL_MS = 15 * 60 * 1000

/** The most rows one batch of the retention sweep deletes. */
export const SWEEP_BATCH = 1000

/** The most batches one scheduled pass runs, each under the job fence; a table fuller than that is continued by the next pass. */
export const SWEEP_MAX_BATCHES = 100

/** The most rows one query of a reload after a lost connection reads; a full batch is followed by the next, so nothing missed is skipped. */
export const CATCH_UP_ROWS = 1024

/** The NOTIFY channel the Postgres hub publishes to and every replica LISTENs on. */
export const NOTIFY_CHANNEL = "realtime_events"

/** The statement that subscribes a connection to the hub channel. */
export const LISTEN_STATEMENT = `LISTEN ${NOTIFY_CHANNEL}`

/** The start of the payload of the probe the hub sends from another session after LISTEN: a connection that never hears its own probe cannot carry the hub. */
export const PROBE_PREFIX = "probe:"

/** The prefix of the advisory-lock key of a topic, apart from the locks of any other capability. */
export const REALTIME_LOCK_NAMESPACE = "realtime.topic:"

/** How long a new LISTEN connection waits to hear its own probe before the hub refuses it (a transaction pooler accepts LISTEN and delivers nothing). */
export const PROBE_TIMEOUT_MS = 5000

/** The pause before the hub opens its LISTEN connection again after it was lost. */
export const RECONNECT_DELAY_MS = 1000

/**
 * The name the Redis hub prefixes its Pub/Sub channel (`<prefix>`), its stream keys (`<prefix>:<topic>`) with, when the app declares none. Pub/Sub is server-wide, so two apps or environments on one Redis server declare
 * different prefixes.
 */
export const REDIS_DEFAULT_PREFIX = "realtime"

/**
 * Appends one frame to the stream of its topic, bounds and expires the stream, and publishes the frame with the stream id to every
 * replica, all in one atomic step (KEYS[1] stream key; ARGV: max length, frame id, frame JSON, time to live ms, channel, topic).
 * It answers the stream id.
 */
export const RETAIN_AND_PUBLISH_SCRIPT = [
    "local id = redis.call('XADD', KEYS[1], 'MAXLEN', '~', ARGV[1], '*', 'id', ARGV[2], 'data', ARGV[3])",
    "redis.call('PEXPIRE', KEYS[1], ARGV[4])",
    "redis.call('PUBLISH', ARGV[5], cjson.encode({ topic = ARGV[6], position = id, frame = ARGV[3] }))",
    "return id",
].join("\n")
