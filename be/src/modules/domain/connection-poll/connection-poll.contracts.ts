import type { ConnectionRecord, ConnectionsService } from "@modules/domain/connections"
import type { Clock } from "@modules/platform/clock"
import type { Logger } from "@modules/platform/logging"
import type { Timer } from "@modules/platform/retry"

/** The time window and size of one page a poller reads. */
export interface PollWindow {
    /** Only items at or after this instant. */
    readonly from: Date
    /** Only items at or before this instant; undefined reads up to now. */
    readonly to: Date | undefined
    /** The most rows one page holds. */
    readonly limit: number
}

/** Why a connection was left out of a poll. */
export type PollSkipReason = "no_token" | "no_account" | "test_environment" | "not_ready"

/** What a poller read: the items of a page, or the reason it did not read. */
export type PollPage<Item> =
    | {
          readonly kind: "page"
          /** The items worth storing; a row that carries nothing is left out. */
          readonly items: ReadonlyArray<Item>
          /** How many rows the page held, stored or not: a full page means an older page may follow. */
          readonly fetched: number
          /** When the oldest row of the page happened; undefined for an empty page. */
          readonly oldestAt: Date | undefined
          /** When the newest row of the page happened; undefined for an empty page. */
          readonly newestAt: Date | undefined
      }
    | { readonly kind: "skipped"; readonly reason: PollSkipReason }

/**
 * What a provider adds to the generic poll: how to read one page of its connection and how to hand one item to the same inbox its
 * webhook feeds. `store` answers true when the item was new, that is when the webhook never delivered it.
 */
export interface ConnectionPoller<Item> {
    /** The provider of the connections it reads. */
    readonly provider: string
    /** Reads one page of one connection. */
    fetch(connection: ConnectionRecord, window: PollWindow): Promise<PollPage<Item>>
    /** Stores one item through the receipt path the webhook takes, under the webhook's key; false for a repeat. */
    store(connection: ConnectionRecord, item: Item): Promise<boolean>
}

/**
 * How a failed provider call must be treated by the scheduler: wait the named seconds, stop using the credential, retry later, or give up.
 * The provider classifies its own errors; core never reads a provider error code.
 */
export type PollFailure =
    | { readonly kind: "rate_limited"; readonly retryAfterSeconds: number }
    | { readonly kind: "auth_failed" }
    | { readonly kind: "transient" }
    | { readonly kind: "fatal" }

/** What a provider allows one credential: the scheduler spends a token bucket and a concurrency gate built from it. */
export interface PollLimits {
    /** Calls per second the provider allows one credential. */
    readonly ratePerSecond: number
    /** The most calls in one burst. */
    readonly burst: number
    /** The most calls in flight at once for one credential. */
    readonly concurrency: number
}

/** What one poll run did, never a value. */
export interface PollSummary {
    /** Connections the run looked at. */
    connections: number
    /** Rows read from providers. */
    fetched: number
    /** Items stored that the webhook had not delivered. */
    recorded: number
    /** Connections left out (no token, no account, test environment). */
    skipped: number
    /** Connections whose read failed. */
    failed: number
}

/** What the generic poll needs from its host. */
export interface ConnectionPollDeps {
    /** The time source. */
    readonly clock: Clock
    /** The log port. */
    readonly logger: Logger
    /** The pause between two calls to a provider. */
    readonly timer: Timer
    /** The connections: the cursor lives in their public facts. */
    readonly connections: ConnectionsService
    /** Runs before every call to the provider, for example to take a rate-limit token; a throw ends the walk and is the outcome of the poll. */
    readonly beforeFetch?: (connection: ConnectionRecord) => Promise<void>
}
