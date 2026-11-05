import { namesConnectionOrNone } from "@modules/platform/primitives"

/** The queue of the bank-feed reconcile job: the contract between the tick, the connection-ready trigger and the processor. */
export const BANK_FEED_POLL_QUEUE = "bank-feed-poll"

/** The job name inside the queue. */
export const RECONCILE_BANK_FEED_JOB = "reconcile-bank-feed"

/** The payload of one reconcile job: one connection when it names one, else every connection that can be polled. */
export interface BankFeedPollPayload {
    /** The connection to reconcile; absent on the scheduler tick. */
    readonly connectionId?: string
    /** The workspace of that connection; present exactly when the connection is. */
    readonly workspaceId?: string
}

/** True when a job payload is the payload of a bank-feed reconcile job. */
export const isBankFeedPollPayload = (value: unknown): value is BankFeedPollPayload => namesConnectionOrNone(value)
