import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { N8N_EMIT_JOB, N8N_QUEUE } from "./n8n.contracts"
import type { N8nEmitPayload } from "./n8n.contracts"

/** True when a job payload is the payload of an n8n delivery job. */
export const isN8nEmitPayload = (value: unknown): value is N8nEmitPayload =>
    typeof value === "object" &&
    value !== null &&
    "workspaceId" in value &&
    typeof value.workspaceId === "string" &&
    "runId" in value &&
    typeof value.runId === "string" &&
    "event" in value &&
    typeof value.event === "string" &&
    "urls" in value &&
    Array.isArray(value.urls) &&
    "paths" in value &&
    Array.isArray(value.paths) &&
    "data" in value &&
    typeof value.data === "object" &&
    value.data !== null

@Injectable()
/** The typed producer of the n8n queue: the one way a delivery job starts. */
export class N8nQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Enqueues one delivery in the caller's transaction: the job exists exactly when the run row commits, and once per run. */
    enqueueEmit(payload: N8nEmitPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, N8N_QUEUE, payload, {
            job: N8N_EMIT_JOB,
            dedupeKey: `${N8N_EMIT_JOB}:${payload.runId}`,
        })
    }
}
