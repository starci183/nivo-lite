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
    /** A live fenced claim delays this delivery without consuming a real attempt. */
    DeferredUntil = "QUEUE_DEFERRED_UNTIL",
    /** Redis must use a bounded memory limit and the noeviction policy before accepting work. */
    RedisConfigurationInvalid = "QUEUE_REDIS_CONFIGURATION_INVALID",
    /** A Redis operation did not finish before its bounded command deadline. */
    RedisDeadline = "QUEUE_REDIS_DEADLINE",
    /** A delivery did not settle before the shutdown deadline. */
    ShutdownDeadline = "QUEUE_SHUTDOWN_DEADLINE",
}

/** How each queue code travels. */
export const QUEUE_ERROR_KINDS: Record<QueueErrorCode, ErrorKind> = {
    [QueueErrorCode.Unrecoverable]: "internal",
    [QueueErrorCode.RetryAfter]: "internal",
    [QueueErrorCode.HandlerMissing]: "internal",
    [QueueErrorCode.HandlerDuplicated]: "internal",
    [QueueErrorCode.DeferredUntil]: "internal",
    [QueueErrorCode.RedisConfigurationInvalid]: "internal",
    [QueueErrorCode.RedisDeadline]: "internal",
    [QueueErrorCode.ShutdownDeadline]: "internal",
}

/** The one error class of the queue capability. */
export class QueueError extends DomainError<QueueErrorCode> {}
