import { DomainError, type ErrorKind } from "@modules/platform/errors"

/**
 * Codes of the Shotstack integration (Edit API), by WHERE a call failed: `Unreachable` (the request may have left), an answered status
 * (`AuthFailed` 401/403, `RateLimited` 429 whose error type the docs name `rate_limit_error`
 * https://shotstack.io/docs/guide/architecting-an-application/limitations/, `NotFound` 404, `Rejected` any other 4xx: Shotstack refused
 * and did nothing, `Failed` 5xx: it may have acted) or `Malformed` (a success that cannot be read). The status and Shotstack's words ride
 * in the params.
 */
export enum ShotstackErrorCode {
    /** The request may not have reached Shotstack: a caller may try it again. */
    Unreachable = "SHOTSTACK_UNREACHABLE",
    /** The key was refused: the caller tells the founder to fix the connection instead of retrying. */
    AuthFailed = "SHOTSTACK_AUTH_FAILED",
    /** Shotstack asked for a pause: the caller waits for `retryAfterSeconds` before trying again. */
    RateLimited = "SHOTSTACK_RATE_LIMITED",
    /** Shotstack has no such render: the caller stops asking about it. */
    NotFound = "SHOTSTACK_NOT_FOUND",
    /** Shotstack refused the request and did nothing: a retry with the same body fails the same way. */
    Rejected = "SHOTSTACK_REJECTED",
    /** Shotstack failed and may have acted: the caller checks before sending the same render again. */
    Failed = "SHOTSTACK_FAILED",
    /** The answer was a success that cannot be read: the caller treats the render as unknown. */
    Malformed = "SHOTSTACK_MALFORMED",
}

/** How each Shotstack code travels. */
export const SHOTSTACK_ERROR_KINDS: Record<ShotstackErrorCode, ErrorKind> = {
    [ShotstackErrorCode.Unreachable]: "unavailable",
    [ShotstackErrorCode.AuthFailed]: "unavailable",
    [ShotstackErrorCode.RateLimited]: "rate-limited",
    [ShotstackErrorCode.NotFound]: "not-found",
    [ShotstackErrorCode.Rejected]: "invalid",
    [ShotstackErrorCode.Failed]: "unavailable",
    [ShotstackErrorCode.Malformed]: "unavailable",
}

/** The one error class of the Shotstack integration. */
export class ShotstackError extends DomainError<ShotstackErrorCode> {}
