import { QueueError, QueueErrorCode } from "./errors/queue.error"
import { DomainError } from "@modules/platform/errors"
import type {
    QueueDelivery,
    QueueHandler,
    QueueJob,
    QueueSchedulerDefinition,
    QueueWriteOptions,
} from "./queue.contracts"
import type { QueueMessageRow, QueueReadRow } from "./persistence/queue.rows"

/** How many starts a job gets before it is archived as failed. */
export const ATTEMPTS = 4

/** The pause after the first failed start; it doubles with every further failure (5 s, 10 s, 20 s). */
export const BACKOFF_MS = 5000

/** The visibility timeout is renewed this many times while a handler runs (every third of it). */
export const TOUCHES_PER_TIMEOUT = 3

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

/** Whole seconds, rounded up: pgmq counts visibility timeouts in seconds. */
export const secondsOf = (ms: number): number => Math.ceil(ms / 1000)

/** The pause before the next start of a job that failed on its `attempt`-th start: BACKOFF_MS doubled per failure, in seconds. */
export const backoffSecondsOf = (attempt: number): number => secondsOf(BACKOFF_MS * 2 ** Math.max(0, attempt - 1))

/** True when the start that just failed was the last one the job gets. */
export const isExhausted = (attempt: number): boolean => attempt >= ATTEMPTS

/** True for a failure that ends the job at once, without retries: an unrecoverable error, or a job no handler names. */
export const isUnrecoverable = (cause: unknown): boolean =>
    cause instanceof QueueError &&
    (cause.code === QueueErrorCode.Unrecoverable || cause.code === QueueErrorCode.HandlerMissing)

/** The pause a handler asked for with a retry-after error, in whole seconds, or undefined for the default backoff. */
export const retryAfterSecondsOf = (cause: unknown): number | undefined => {
    if (cause instanceof DomainError && Number.isFinite(Number(cause.params.retryAfterSeconds))) {
        return Math.max(0, Math.ceil(Number(cause.params.retryAfterSeconds)))
    }
    if (!(cause instanceof QueueError) || cause.code !== QueueErrorCode.RetryAfter) return undefined
    const seconds = Number(cause.params.seconds)
    return Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds)) : undefined
}

/** Why a delivery failed, as the outbox row keeps it: the reason of a queue error, else the message of the failure. */
export const reasonOf = (cause: unknown): string => {
    if (cause instanceof QueueError) return String(cause.params.reason ?? cause.code)
    return cause instanceof Error ? cause.message : String(cause)
}

/** The workspace a payload names (`workspaceId`, a uuid), or null: only those jobs count against the workspace limit. */
export const workspaceOf = (payload: object): string | null => {
    const value = "workspaceId" in payload ? payload.workspaceId : undefined
    return typeof value === "string" && UUID.test(value) ? value : null
}

/** The job a producer's write resolves to: the job name defaults to the queue; with no dedupe key the database mints a fresh one. */
export const jobOf = (queue: string, payload: object, options: QueueWriteOptions): QueueJob => ({
    queue,
    job: options.job ?? queue,
    dedupeKey: options.dedupeKey ?? null,
    workspaceId: workspaceOf(payload),
    payload,
})

/** The message of a scheduler tick: the same body job_enqueue sends, without an outbox row. */
export const tickOf = (scheduler: QueueSchedulerDefinition): QueueMessageRow => ({
    name: scheduler.job ?? scheduler.queue,
    payload: scheduler.payload ?? {},
})

/** The delivery a handler receives for one read message; a scheduler tick carries no outbox id and is known by its message id. */
export const deliveryOf = (queue: string, row: QueueReadRow, signal: AbortSignal): QueueDelivery => ({
    id: row.message.outbox_id ?? row.msg_id,
    queue,
    job: row.message.name ?? queue,
    payload: row.message.payload ?? {},
    attempt: row.attempt,
    signal,
})

/** The handler a delivery goes to: the one of its job, else the one of the whole queue, else none. */
export const routeOf = (handlers: ReadonlyArray<QueueHandler>, delivery: QueueDelivery): QueueHandler | undefined =>
    handlers.find((handler) => handler.job === delivery.job) ?? handlers.find((handler) => handler.job === undefined)

/** The pg_cron schedule of an interval: seconds below a minute, whole minutes below an hour, whole hours otherwise (rounded, at least one). */
export const cronScheduleOf = (everyMs: number): string => {
    const seconds = Math.max(1, Math.round(everyMs / 1000))
    if (seconds < 60) return `${seconds} seconds`
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `*/${minutes} * * * *`
    return `0 */${Math.min(23, Math.round(minutes / 60))} * * *`
}
