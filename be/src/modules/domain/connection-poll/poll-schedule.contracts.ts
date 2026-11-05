import type { ConnectionReadyPayload } from "@modules/events/api"
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

/** The source of a provider, or undefined when none has it. */
export type OptionalPollSource = ScheduledPollSource | undefined

/** Finds the scheduled sources of one capability (bank feeds, message inboxes) by provider key. */
export interface PollSourceDirectory {
    /** The provider keys it can read. */
    providers(): ReadonlyArray<string>
    /** The source of a provider, or undefined when it has none. */
    sourceOf(provider: string): OptionalPollSource
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

/** Where the first poll of a connection that just became ready goes: the queue and job of its provider, and the delivered event. */
export interface FirstPollTarget {
    /** The queue of the provider's reconcile job. */
    readonly queue: string
    /** The job name inside that queue. */
    readonly job: string
    /** The connection_ready fact: the connection, its workspace and the delivery's dedupe key. */
    readonly ready: Pick<ConnectionReadyPayload, "connectionId" | "workspaceId" | "dedupeKey">
}
