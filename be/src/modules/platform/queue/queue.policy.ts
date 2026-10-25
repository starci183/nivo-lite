import { QueueError, QueueErrorCode } from "./errors/queue.error"
import { DomainError } from "@modules/platform/errors"
import type { QueueDelivery, QueueDeliverySource, QueueHandler, QueueJob, QueueWriteOptions } from "./queue.contracts"

/** How many starts a job gets before it is dead-lettered as failed. */
export const ATTEMPTS = 4

/** The pause after the first failed start; it doubles with every further failure (5 s, 10 s, 20 s). */
export const BACKOFF_MS = 5000

/** How long a completed job stays in the broker. */
export const KEEP_COMPLETED_SECONDS = 3600

/** Failed broker copies are bounded independently of the durable failure history. */
export const KEEP_FAILED_SECONDS = 7 * 24 * 3600

/** Every producer command and the final shutdown settlement have a finite deadline. */
export const REDIS_DEADLINE_MS = 5000

/** Redis must have a memory ceiling and reject writes rather than evicting admitted jobs. */
export const isQueueMemoryBounded = (info: string): boolean => {
    const memory = /^maxmemory:(\d+)\r?$/mu.exec(info)
    return Number(memory?.[1]) > 0 && /^maxmemory_policy:noeviction\r?$/mu.test(info)
}

/** The workspace slot is renewed this many times while a handler runs (every third of it). */
export const TOUCHES_PER_TIMEOUT = 3

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

/** Whole seconds, rounded up: the database counts slot leases and retry pauses in seconds. */
export const secondsOf = (ms: number): number => Math.ceil(ms / 1000)

/** A few seconds of spread derived from the job id, so deferred jobs of one workspace do not retry in lockstep. */
const spreadOf = (id: string): number => {
    let spread = 0
    for (const char of id) spread = (spread * 31 + Number(char.codePointAt(0))) % 2000
    return spread
}

/** The pause of a job deferred because its workspace is already at the slot limit (a few seconds, spread by the job id). */
export const deferMsOf = (id: string): number => 3000 + spreadOf(id)

/** The pause before the next start of a job that failed on its `attempt`-th start: BACKOFF_MS doubled per failure, in seconds. */
export const backoffSecondsOf = (attempt: number): number => secondsOf(BACKOFF_MS * 2 ** Math.max(0, attempt - 1))

/** True when the start that just failed was the last one the job gets. */
export const isExhausted = (attempt: number): boolean => attempt >= ATTEMPTS

/** Ends a job on an existing queue refusal or an owning domain error that explicitly marks its server-created failure unrecoverable. */
export const isUnrecoverable = (cause: unknown): boolean =>
    cause instanceof QueueError
        ? cause.code === QueueErrorCode.Unrecoverable || cause.code === QueueErrorCode.HandlerMissing
        : cause instanceof DomainError && cause.params.unrecoverable === 1

/** Keeps existing queue retry behavior and honors owning domain errors with a finite retryAfterSeconds hint of 1 to 3600 seconds. */
export const retryAfterSecondsOf = (cause: unknown): number | undefined => {
    if (cause instanceof QueueError) {
        if (cause.code !== QueueErrorCode.RetryAfter) return undefined
        const seconds = Number(cause.params.seconds)
        return Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds)) : undefined
    }
    if (!(cause instanceof DomainError)) return undefined
    const seconds = Number(cause.params.retryAfterSeconds)
    return Number.isFinite(seconds) && seconds >= 1 && seconds <= 3600 ? Math.ceil(seconds) : undefined
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

/** The pause between two tries of one delivery, in milliseconds: a retry hint of the failing error, else the backoff. */
export const backoffMsOf = (attemptsMade: number, cause?: unknown): number => {
    const hinted = retryAfterSecondsOf(cause)
    return hinted !== undefined ? hinted * 1000 : BACKOFF_MS * 2 ** Math.max(0, attemptsMade - 1)
}

/**
 * The delivery a handler receives for one broker job: the id is the outbox row id the relay published it under, the
 * job name routes it to its handler and the attempt is the durable start count the database kept.
 */
export const deliveryOf = (
    queue: string,
    job: QueueDeliverySource,
    attempt: number,
    signal: AbortSignal,
): QueueDelivery => ({
    id: job.id ?? `${queue}:unknown`,
    queue,
    job: job.name || queue,
    payload: job.data,
    attempt,
    signal,
})

/** The handler a delivery goes to: the one of its job, else the one of the whole queue, else none. */
export const routeOf = (handlers: ReadonlyArray<QueueHandler>, delivery: QueueDelivery): QueueHandler | undefined =>
    handlers.find((handler) => handler.job === delivery.job) ?? handlers.find((handler) => handler.job === undefined)
