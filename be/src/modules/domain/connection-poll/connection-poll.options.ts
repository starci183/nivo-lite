/** The intervals, thresholds and caps of the scheduler; every one is configurable. */
export interface PollScheduleOptions {
    /** The interval while the webhook delivers, in milliseconds. */
    readonly healthyIntervalMs: number
    /** The interval while the webhook is silent or failing. */
    readonly silentIntervalMs: number
    /** The interval while a connection is hot. */
    readonly hotIntervalMs: number
    /** The webhook counts as silent when it delivered nothing for this long. */
    readonly webhookSilentAfterMs: number
    /** How long a connection stays hot when the caller names no time. */
    readonly hotTtlMs: number
    /** The random spread of a planned time, as a share of the interval (0.2: plus or minus a fifth). */
    readonly jitterRatio: number
    /** The first wait after a failure; each further failure doubles it. */
    readonly backoffBaseMs: number
    /** The longest wait the backoff reaches. */
    readonly backoffCapMs: number
    /** Consecutive transient failures that open the breaker. */
    readonly breakerThreshold: number
    /** How long an open breaker waits before it lets one probe through. */
    readonly breakerCooldownMs: number
    /** The longest cool-down a breaker that keeps failing reaches. */
    readonly breakerCooldownCapMs: number
    /** How long a connection whose provider plan lacks the capability waits before it is tried again. */
    readonly unavailableRecheckMs: number
    /** How many due connections one tick claims. */
    readonly batchSize: number
    /** How long a claimed connection is kept from other workers; a worker that dies frees it by then. */
    readonly leaseMs: number
    /** The longest wait for a rate-limit token a poll sits through; a longer one is rescheduled instead. */
    readonly maxInlineWaitMs: number
    /** The pages one chunk of a first-connect backfill reads. */
    readonly backfillChunkPages: number
}

/** The Redis the limiter keeps its buckets in; absent when the app declares none. */
export interface PollRedisOptions {
    /** The host. */
    readonly host: string
    /** The port. */
    readonly port: number
    /** The database. */
    readonly db: number
    /** The prefix of every key. */
    readonly prefix: string
    /** The password, when the server needs one. */
    readonly password: string | undefined
}

/** The options of the connection-poll capability. */
export interface ConnectionPollOptions {
    /** The scheduler tunables. */
    readonly schedule: PollScheduleOptions
    /** Where the limiter keeps its state; undefined keeps it in this process (one replica, tests). */
    readonly redis: PollRedisOptions | undefined
}
