import { namesConnectionOrNone } from "@modules/platform/primitives"

/** The queue of the Zalo inbox reconcile job: the contract between the scheduler tick, the connection-ready trigger and the processor. */
export const ZALO_INBOX_POLL_QUEUE = "zalo-inbox-poll"

/** The job name inside the queue. */
export const RECONCILE_ZALO_INBOX_JOB = "reconcile-zalo-inbox"

/** The payload of one reconcile job: one connection when it names one, else every Zalo connection. */
export interface ZaloInboxPollPayload {
    /** The connection to reconcile; absent on the scheduler tick. */
    readonly connectionId?: string
    /** The workspace of that connection; present exactly when the connection is. */
    readonly workspaceId?: string
}

/** True when a job payload is the payload of a Zalo inbox reconcile job. */
export const isZaloInboxPollPayload = (value: unknown): value is ZaloInboxPollPayload => namesConnectionOrNone(value)
