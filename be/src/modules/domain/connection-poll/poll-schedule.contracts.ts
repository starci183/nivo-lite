import type {
    ConnectionPoller,
    PollFailure,
    PollLimits,
    PollSkipReason,
    UnavailableReason,
} from "./connection-poll.contracts"

/** How one poll of a connection ended, in the terms a scheduler plans the next one with. */
export type PollOutcome =
    | { readonly kind: "done"; readonly fetched: number; readonly recorded: number }
    | {
          readonly kind: "partial"
          readonly fetched: number
          readonly recorded: number
          /** The end of the next older page: where the next chunk of a backfill begins. */
          readonly resumeTo: Date
          /** The newest instant read so far, carried to the next chunk; the cursor moves only when the walk is done. */
          readonly newest: Date | undefined
      }
    | { readonly kind: "skipped"; readonly reason: PollSkipReason }
    | { readonly kind: "failed"; readonly cause: unknown }

/** Where a walk begins and how far one call goes: a chunk of a backfill resumes from the page end the last chunk stopped at. */
export interface PollWalkOptions {
    /** The end of the page to begin at; undefined begins at the newest. */
    readonly to?: Date | undefined
    /** The newest instant the earlier chunks read. */
    readonly newest?: Date | undefined
    /** The most pages this call reads; undefined reads up to the default cap and never resumes. */
    readonly maxPages?: number | undefined
}

/**
 * What a provider offers to be polled by the scheduler: its poller with the store of its inbox bound, what the provider allows one credential and
 * how its failures are classified. The provider adds nothing else: intervals, breakers, backoff, jitter and fairness are the scheduler's.
 */
export interface ScheduledPollSource {
    /** The provider key of the connections it reads. */
    readonly provider: string
    /** What the provider allows one credential. */
    readonly limits: PollLimits
    /** Reads one page of a connection and stores its items through the inbox the provider's webhook feeds. */
    readonly poller: ConnectionPoller<unknown>
    /** Maps what the poller threw to how the failure is handled. */
    classify(cause: unknown): PollFailure
}

/** Finds the scheduled sources of one capability (bank feeds, message inboxes) by provider key. */
export interface PollSourceDirectory {
    /** The provider keys it can read. */
    providers(): ReadonlyArray<string>
    /** The source of a provider, or undefined when it has none. */
    sourceOf(provider: string): ScheduledPollSource | undefined
}

/** Where the circuit breaker of a connection stands. */
export type BreakerState = "closed" | "open" | "half_open"

/** Why a connection is polled faster than its normal interval for a while. */
export type PollHotReason = "connection_ready" | "order_awaiting_payment" | "payment_claim_open" | (string & {})

/** The schedule row of one connection as the planner reads it. */
export interface PollScheduleRow {
    /** The connection. */
    readonly connectionId: string
    /** The workspace of the connection: the unit of fairness. */
    readonly workspaceId: string
    /** The provider of the connection. */
    readonly provider: string
    /** The interval the connection was last planned with, in milliseconds. */
    readonly intervalMs: number
    /** Consecutive failed polls. */
    readonly failures: number
    /** The breaker of the connection. */
    readonly breakerState: BreakerState
    /** When the breaker last opened; null while it never has. */
    readonly breakerOpenedAt: Date | null
    /** The provider refused the credential: nothing is polled until the owner connects again. */
    readonly needsReauth: boolean
    /** Polled fast until this instant; null when not hot. */
    readonly hotUntil: Date | null
    /** The last poll that ended well. */
    readonly lastSuccessAt: Date | null
    /** The last delivery the webhook of the provider made for this connection. */
    readonly lastWebhookAt: Date | null
    /** Why the provider cannot be read for this connection although it is connected (its plan lacks the capability); null while it can. */
    readonly unavailableReason: UnavailableReason | null
    /** Where an unfinished backfill resumes: the end of the next older page. */
    readonly backfillTo: Date | null
    /** The newest instant the unfinished backfill read. */
    readonly backfillNewest: Date | null
}

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
