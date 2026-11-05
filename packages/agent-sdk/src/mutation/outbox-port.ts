import { z } from "../schema/zod-entry"
import { keyText } from "../schema/bounded.schema"
import type { JobRef } from "./job"
import { definePort } from "../port/port"
import type { PortDefinition } from "../port/port.types"

/** The port id of the outbox: enqueueing a declared job in the transaction of the write that causes it (BE-PERSISTENCE-5, BE-QUEUES-1). */
export const OUTBOX_PORT_ID = "engine.outbox"

/** The longest delay a job may be enqueued with: seven days. */
export const ENQUEUE_DELAY_MAX_MS: number = 7 * 24 * 60 * 60 * 1000

/** How the job is enqueued. */
export interface EnqueueOptions {
    /** The same key is the same job: a repeated enqueue is a no-op. */
    readonly dedupeKey?: string | undefined
    /** Milliseconds before the job may run, 0 to `ENQUEUE_DELAY_MAX_MS`. */
    readonly delayMs?: number | undefined
}

/** The zod schema of `EnqueueOptions`, bounded. */
export const enqueueOptionsSchema: z.ZodType<EnqueueOptions> = z.strictObject({
    dedupeKey: keyText.min(1).optional(),
    delayMs: z.int().min(0).max(ENQUEUE_DELAY_MAX_MS).optional(),
})

/** The api of the outbox port. A provider writes the queue outbox with the transaction the engine call holds. */
export interface OutboxApi {
    /** Writes the job to the queue outbox in the transaction of the write that causes it. */
    enqueue<I extends z.ZodObject>(job: JobRef<I>, input: z.input<I>, options?: EnqueueOptions): Promise<void>
}

/** The outbox port declaration a job or an action lists in its ports. */
export const outboxPort: PortDefinition<OutboxApi> = definePort<OutboxApi>(OUTBOX_PORT_ID)
