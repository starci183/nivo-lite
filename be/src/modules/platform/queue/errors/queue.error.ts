import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the queue capability. */
export enum QueueErrorCode {
    /** A handler ends its job now, without retries: a bad payload, a subject that no longer exists, a refusal that will not change. */
    Unrecoverable = "QUEUE_UNRECOVERABLE",
    /** A handler asks for its job to run again after a pause of its own instead of the default backoff. */
    RetryAfter = "QUEUE_RETRY_AFTER",
    /** A message reached a queue no handler consumes, or a job no handler of its queue names. */
    HandlerMissing = "QUEUE_HANDLER_MISSING",
    /** Two handlers were registered for the same queue and job: a wiring bug. */
    HandlerDuplicated = "QUEUE_HANDLER_DUPLICATED",
}

/** How each queue code travels. */
export const QUEUE_ERROR_KINDS: Record<QueueErrorCode, ErrorKind> = {
    [QueueErrorCode.Unrecoverable]: "internal",
    [QueueErrorCode.RetryAfter]: "internal",
    [QueueErrorCode.HandlerMissing]: "internal",
    [QueueErrorCode.HandlerDuplicated]: "internal",
}

/** The one error class of the queue capability. */
export class QueueError extends DomainError<QueueErrorCode> {}
