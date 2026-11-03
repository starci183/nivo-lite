import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"

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
export const isZaloInboxPollPayload = (value: unknown): value is ZaloInboxPollPayload => {
    if (typeof value !== "object" || value === null) return false
    const named = [Reflect.get(value, "connectionId"), Reflect.get(value, "workspaceId")]
    return named.every((id) => id === undefined) || named.every((id) => typeof id === "string" && id.length > 0)
}

/** One minute in milliseconds: requests for the same connection inside it are one job. */
const REQUEST_BUCKET_MS = 60_000

@Injectable()
/** The typed producer of the Zalo inbox reconcile queue: the one way the connection-ready trigger starts a job. */
export class ZaloInboxPollQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Enqueues the reconcile of one connection in the caller's transaction; asking again within the same minute is one job. */
    enqueueReconcile(payload: Required<ZaloInboxPollPayload>, at: Date, tx: EntityManager): Promise<void> {
        const bucket = Math.floor(at.getTime() / REQUEST_BUCKET_MS)
        return this.outbox.write(tx, ZALO_INBOX_POLL_QUEUE, payload, {
            job: RECONCILE_ZALO_INBOX_JOB,
            dedupeKey: `${ZALO_INBOX_POLL_QUEUE}:${payload.connectionId}:${bucket}`,
        })
    }
}
